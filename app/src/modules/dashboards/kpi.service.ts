import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  DashboardKind,
  incidents,
  kpiCache,
  permits,
} from '../../database/schema';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardLogService } from './dashboard-log.service';
import { DASHBOARD_KIND_ROLES } from './dashboards.constants';
import { KPIFilterDto } from './dto/dashboard.dto';

@Injectable()
export class KpiService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: DashboardCacheService,
    private readonly logService: DashboardLogService,
  ) {}

  async getKpis(user: AuthenticatedUser, query: KPIFilterDto) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const kind = query.kind ?? 'personal';
    this.assertKindAccess(user.roles, kind);
    const periodLabel = query.periodLabel ?? 'current';

    const redisHit = await this.cache.getKpi<unknown>(tenantId, `bundle:${kind}`, periodLabel);
    if (redisHit) {
      return redisHit;
    }

    const computed = await this.computeBundle(tenantId, kind, periodLabel);
    await this.upsertCacheRows(tenantId, actorId, kind, periodLabel, computed.items);
    await this.cache.setKpi(tenantId, `bundle:${kind}`, periodLabel, computed);

    this.logService.logEvent({
      action: 'dashboard.kpi-read',
      tenantId,
      userId: actorId,
      metadata: { kind, periodLabel },
    });

    return computed;
  }

  async refreshTenantKpis(tenantId: string, actorId = '00000000-0000-0000-0000-000000000000') {
    for (const kind of Object.keys(DASHBOARD_KIND_ROLES) as DashboardKind[]) {
      const computed = await this.computeBundle(tenantId, kind, 'current');
      await this.upsertCacheRows(tenantId, actorId, kind, 'current', computed.items);
      await this.cache.setKpi(tenantId, `bundle:${kind}`, 'current', computed);
    }
  }

  private async computeBundle(tenantId: string, kind: DashboardKind, periodLabel: string) {
    const activePermits = await this.countPermits(tenantId, ['active', 'approved']);
    const pendingApprovals = await this.countPermits(tenantId, ['pending_approval']);
    const suspendedPermits = await this.countPermits(tenantId, ['suspended']);
    const openIncidents = await this.countIncidents(tenantId, [
      'open',
      'investigating',
      'pending_verification',
    ]);
    const closedIncidents = await this.countIncidents(tenantId, ['closed']);

    const items = [
      { key: 'active_permits', value: { count: activePermits } },
      { key: 'pending_approvals', value: { count: pendingApprovals } },
      { key: 'suspended_permits', value: { count: suspendedPermits } },
      { key: 'open_incidents', value: { count: openIncidents } },
      { key: 'closed_incidents', value: { count: closedIncidents } },
    ];

    return {
      kind,
      periodLabel,
      items,
      computedAt: new Date().toISOString(),
    };
  }

  private async upsertCacheRows(
    tenantId: string,
    actorId: string,
    kind: DashboardKind,
    periodLabel: string,
    items: Array<{ key: string; value: Record<string, unknown> }>,
  ) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    for (const item of items) {
      const [existing] = await this.db
        .select({ id: kpiCache.id })
        .from(kpiCache)
        .where(
          and(
            eq(kpiCache.tenantId, tenantId),
            eq(kpiCache.kpiKey, item.key),
            eq(kpiCache.periodLabel, periodLabel),
          ),
        )
        .limit(1);

      if (existing) {
        await this.db
          .update(kpiCache)
          .set({
            value: item.value,
            dashboardKind: kind,
            computedAt: new Date(),
            expiresAt,
            updatedBy: actorId,
            updatedAt: new Date(),
          })
          .where(eq(kpiCache.id, existing.id));
      } else {
        await this.db.insert(kpiCache).values({
          tenantId,
          kpiKey: item.key,
          dashboardKind: kind,
          periodLabel,
          value: item.value,
          computedAt: new Date(),
          expiresAt,
          createdBy: actorId,
          updatedBy: actorId,
        });
      }
    }
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

  private assertKindAccess(roles: string[], kind: DashboardKind): void {
    const allowed = DASHBOARD_KIND_ROLES[kind];
    if (!roles.some((role) => allowed.includes(role))) {
      throw new ForbiddenException(`Role not permitted for ${kind} KPIs`);
    }
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
