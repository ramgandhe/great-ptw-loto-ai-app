import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, inArray } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  DASHBOARD_KINDS,
  DashboardKind,
  dashboardPreferences,
  incidents,
  permits,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardLogService } from './dashboard-log.service';
import { DASHBOARD_KIND_ROLES } from './dashboards.constants';
import { KpiService } from './kpi.service';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly cache: DashboardCacheService,
    private readonly logService: DashboardLogService,
    private readonly auditService: AuditService,
    private readonly kpiService: KpiService,
  ) {}

  async getDashboard(user: AuthenticatedUser, kind?: DashboardKind) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const resolvedKind = kind ?? this.defaultKind(user.roles);
    this.assertKindAccess(user.roles, resolvedKind);

    const cached = await this.cache.getDashboard<unknown>(tenantId, actorId, resolvedKind);
    if (cached) {
      return cached;
    }

    const preferences = await this.ensurePreferences(tenantId, actorId, resolvedKind);
    const summary = await this.buildSummary(tenantId, actorId, resolvedKind);
    const kpis = await this.kpiService.getKpis(user, {
      kind: resolvedKind,
      periodLabel: 'current',
    });

    const payload = {
      kind: resolvedKind,
      preferences,
      summary,
      kpis,
      refreshedAt: new Date().toISOString(),
    };

    await this.cache.setDashboard(tenantId, actorId, resolvedKind, payload);
    this.logService.logEvent({
      action: 'dashboard.view',
      tenantId,
      userId: actorId,
      metadata: { kind: resolvedKind },
    });
    await this.auditService.log({
      action: 'dashboard.view',
      entityType: 'dashboard',
      entityId: `${resolvedKind}:${actorId}`,
      userId: actorId,
      tenantId,
      metadata: { kind: resolvedKind },
    });

    return payload;
  }

  assertKindAccess(roles: string[], kind: DashboardKind): void {
    const allowed = DASHBOARD_KIND_ROLES[kind];
    if (!roles.some((role) => allowed.includes(role))) {
      throw new ForbiddenException(`Role not permitted for ${kind} dashboard`);
    }
  }

  defaultKind(roles: string[]): DashboardKind {
    if (roles.some((r) => DASHBOARD_KIND_ROLES.management.includes(r))) {
      return 'management';
    }
    if (roles.some((r) => DASHBOARD_KIND_ROLES.safety.includes(r))) {
      return 'safety';
    }
    if (roles.some((r) => DASHBOARD_KIND_ROLES.supervisor.includes(r))) {
      return 'supervisor';
    }
    return 'personal';
  }

  private async ensurePreferences(
    tenantId: string,
    userId: string,
    kind: DashboardKind,
  ) {
    const [existing] = await this.db
      .select()
      .from(dashboardPreferences)
      .where(
        and(
          eq(dashboardPreferences.tenantId, tenantId),
          eq(dashboardPreferences.userId, userId),
          eq(dashboardPreferences.dashboardKind, kind),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await this.db
      .insert(dashboardPreferences)
      .values({
        tenantId,
        userId,
        dashboardKind: kind,
        layout: { widgets: ['summary', 'kpis'] },
        filters: {},
        refreshSeconds: 60,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return created;
  }

  private async buildSummary(tenantId: string, actorId: string, kind: DashboardKind) {
    const activePermits = await this.countPermits(tenantId, ['active', 'approved']);
    const pendingApprovals = await this.countPermits(tenantId, ['pending_approval']);
    const openIncidents = await this.countIncidents(tenantId, [
      'open',
      'investigating',
      'pending_verification',
    ]);

    if (kind === 'personal') {
      const mine = await this.db
        .select({ value: count() })
        .from(permits)
        .where(
          and(
            eq(permits.tenantId, tenantId),
            eq(permits.createdBy, actorId),
            inArray(permits.status, ['draft', 'pending_approval', 'approved', 'active', 'suspended']),
          ),
        );
      return {
        myOpenPermits: Number(mine[0]?.value ?? 0),
        activePermits,
        pendingApprovals,
        openIncidents,
      };
    }

    return { activePermits, pendingApprovals, openIncidents };
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

  requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }

  isValidKind(kind: string): kind is DashboardKind {
    return (DASHBOARD_KINDS as readonly string[]).includes(kind);
  }
}
