import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
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
import {
  OperationalFilters,
  OperationalMetricsService,
} from './operational-metrics.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: DashboardCacheService,
    private readonly logService: DashboardLogService,
    private readonly metrics: OperationalMetricsService,
  ) {}

  async getAnalytics(user: AuthenticatedUser, query: AnalyticsQueryDto) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const scope = query.scope ?? 'operational';
    const filters = this.toFilters(query);
    this.metrics.validatePeriod(filters);

    // Live filtered reads skip snapshot cache so FR-DAS-008 filters apply.
    const hasFilters = Boolean(filters.status || filters.plantId || filters.periodStart || filters.periodEnd);
    if (!hasFilters) {
      const cached = await this.cache.getAnalytics<unknown>(tenantId, scope);
      if (cached) {
        return cached;
      }
    }

    const payload = hasFilters
      ? {
          scope,
          source: 'live' as const,
          snapshot: null,
          payload: await this.computeLivePayload(tenantId, scope, filters),
          capturedAt: new Date().toISOString(),
          filters,
          requirementId: 'FR-DAS-007',
        }
      : await this.readSnapshotOrLive(tenantId, scope);

    if (!hasFilters) {
      await this.cache.setAnalytics(tenantId, scope, payload);
    }

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
      empty: rows.length === 0,
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

  private async readSnapshotOrLive(tenantId: string, scope: AnalyticsSnapshotScope) {
    const [latest] = await this.db
      .select()
      .from(analyticsSnapshots)
      .where(and(eq(analyticsSnapshots.tenantId, tenantId), eq(analyticsSnapshots.scope, scope)))
      .orderBy(desc(analyticsSnapshots.capturedAt))
      .limit(1);

    if (latest) {
      return {
        scope,
        source: 'snapshot' as const,
        snapshot: latest,
        capturedAt: latest.capturedAt,
        requirementId: 'FR-DAS-007',
      };
    }

    return {
      scope,
      source: 'live' as const,
      snapshot: null,
      payload: await this.computeLivePayload(tenantId, scope),
      capturedAt: new Date().toISOString(),
      requirementId: 'FR-DAS-007',
    };
  }

  private async computeLivePayload(
    tenantId: string,
    scope: AnalyticsSnapshotScope,
    filters: OperationalFilters = {},
  ): Promise<Record<string, unknown>> {
    if (scope === 'permits') {
      return this.metrics.permitCounts(tenantId, filters);
    }
    if (scope === 'incidents') {
      return this.metrics.incidentCounts(tenantId, filters);
    }
    if (scope === 'simops') {
      return this.metrics.simopsCounts(tenantId, filters);
    }
    if (scope === 'lototo') {
      return this.metrics.lototoCounts(tenantId, filters);
    }
    return this.metrics.organizationalBundle(tenantId, filters);
  }

  private toFilters(query: AnalyticsQueryDto): OperationalFilters {
    return {
      status: query.status,
      plantId: query.plantId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
    };
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
