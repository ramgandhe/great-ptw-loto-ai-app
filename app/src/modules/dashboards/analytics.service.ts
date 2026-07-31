import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  ANALYTICS_SNAPSHOT_SCOPES,
  AnalyticsSnapshotScope,
  analyticsSnapshots,
  incidents,
  permits,
} from '../../database/schema';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardLogService } from './dashboard-log.service';
import { AnalyticsQueryDto, AnalyticsTrendsQueryDto } from './dto/dashboard.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: DashboardCacheService,
    private readonly logService: DashboardLogService,
  ) {}

  async getAnalytics(user: AuthenticatedUser, query: AnalyticsQueryDto) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const scope = query.scope ?? 'operational';

    const cached = await this.cache.getAnalytics<unknown>(tenantId, scope);
    if (cached) {
      return cached;
    }

    const [latest] = await this.db
      .select()
      .from(analyticsSnapshots)
      .where(and(eq(analyticsSnapshots.tenantId, tenantId), eq(analyticsSnapshots.scope, scope)))
      .orderBy(desc(analyticsSnapshots.capturedAt))
      .limit(1);

    const payload = latest
      ? {
          scope,
          source: 'snapshot' as const,
          snapshot: latest,
          capturedAt: latest.capturedAt,
        }
      : {
          scope,
          source: 'live' as const,
          snapshot: null,
          payload: await this.computeLivePayload(tenantId, scope),
          capturedAt: new Date().toISOString(),
        };

    await this.cache.setAnalytics(tenantId, scope, payload);

    this.logService.logEvent({
      action: 'dashboard.analytics-read',
      tenantId,
      userId: actorId,
      scope,
    });

    return payload;
  }

  async getTrends(user: AuthenticatedUser, query: AnalyticsTrendsQueryDto) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const scope = query.scope ?? 'operational';
    const limit = query.limit ?? 14;

    const rows = await this.db
      .select()
      .from(analyticsSnapshots)
      .where(and(eq(analyticsSnapshots.tenantId, tenantId), eq(analyticsSnapshots.scope, scope)))
      .orderBy(desc(analyticsSnapshots.capturedAt))
      .limit(limit);

    this.logService.logEvent({
      action: 'dashboard.analytics-trends',
      tenantId,
      userId: actorId,
      scope,
      metadata: { count: rows.length },
    });

    return {
      scope,
      points: rows.reverse(),
    };
  }

  async captureSnapshotsForTenant(
    tenantId: string,
    actorId = '00000000-0000-0000-0000-000000000000',
  ): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

    let written = 0;
    for (const scope of ANALYTICS_SNAPSHOT_SCOPES) {
      const payload = await this.computeLivePayload(tenantId, scope);
      const [existing] = await this.db
        .select({ id: analyticsSnapshots.id })
        .from(analyticsSnapshots)
        .where(
          and(
            eq(analyticsSnapshots.tenantId, tenantId),
            eq(analyticsSnapshots.scope, scope),
            eq(analyticsSnapshots.periodStart, periodStart),
            eq(analyticsSnapshots.periodEnd, periodEnd),
          ),
        )
        .limit(1);

      if (existing) {
        continue;
      }

      await this.db.insert(analyticsSnapshots).values({
        tenantId,
        scope,
        periodStart,
        periodEnd,
        capturedAt: now,
        payload,
        source: 'system',
        createdBy: actorId,
        updatedBy: actorId,
      });
      await this.cache.setAnalytics(tenantId, scope, {
        scope,
        source: 'snapshot',
        payload,
        capturedAt: now.toISOString(),
      });
      written += 1;
    }
    return written;
  }

  async listTenantIdsWithActivity(): Promise<string[]> {
    const permitTenants = await this.db
      .selectDistinct({ tenantId: permits.tenantId })
      .from(permits);
    const incidentTenants = await this.db
      .selectDistinct({ tenantId: incidents.tenantId })
      .from(incidents);
    const ids = new Set<string>();
    for (const row of permitTenants) ids.add(row.tenantId);
    for (const row of incidentTenants) ids.add(row.tenantId);
    return [...ids];
  }

  private async computeLivePayload(
    tenantId: string,
    scope: AnalyticsSnapshotScope,
  ): Promise<Record<string, unknown>> {
    if (scope === 'permits' || scope === 'operational') {
      const active = await this.countPermits(tenantId, ['active', 'approved']);
      const pending = await this.countPermits(tenantId, ['pending_approval']);
      const closed = await this.countPermits(tenantId, ['closed']);
      if (scope === 'permits') {
        return { active, pending, closed };
      }
      const openIncidents = await this.countIncidents(tenantId, [
        'open',
        'investigating',
        'pending_verification',
      ]);
      return { activePermits: active, pendingApprovals: pending, openIncidents };
    }

    if (scope === 'incidents') {
      return {
        open: await this.countIncidents(tenantId, [
          'open',
          'investigating',
          'pending_verification',
        ]),
        closed: await this.countIncidents(tenantId, ['closed']),
      };
    }

    return { scope, status: 'available', note: 'Aggregate pending dedicated module metrics' };
  }

  private async countPermits(tenantId: string, statuses: string[]): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(permits)
      .where(and(eq(permits.tenantId, tenantId), inArray(permits.status, statuses)));
    return Number(row?.value ?? 0);
  }

  private async countIncidents(tenantId: string, statuses: string[]): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(incidents)
      .where(and(eq(incidents.tenantId, tenantId), inArray(incidents.status, statuses)));
    return Number(row?.value ?? 0);
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
