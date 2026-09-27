import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  correctiveActions,
  departments,
  incidents,
  locations,
  machineryCatalogue as machinery,
  permitApprovals,
  permitStatusHistory,
  permitTypes,
  permits,
  simopsConflicts,
} from '../../database/schema';

const DAY_MS = 86_400_000;
const OPEN_INCIDENT_STATUSES = ['open', 'pending_hod_decision', 'investigating', 'pending_verification', 'verified'];
const OPEN_CONFLICT_STATUSES = ['open', 'assessed', 'mitigation_planned'];
const LIVE_PERMIT_STATUSES = ['pending_approval', 'approved', 'active', 'suspended'];

type Bucket = { key: string; label: string; count: number };

/**
 * Live aggregates behind the in-app analytics dashboard. Everything is computed on read and
 * scoped to the caller's tenant, so figures always match what the lists show.
 */
@Injectable()
export class InsightsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  /** Report rows for on-screen reading (replaces file exports). */
  async viewReport(user: AuthenticatedUser, type: 'permit_summary' | 'incident_summary', days = 30): Promise<ReportView> {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    const now = new Date();
    const from = periodStart(days, now);
    const period = { days, from: from.toISOString(), to: now.toISOString() };

    if (type === 'incident_summary') {
      const rows = await this.db
        .select({
          id: incidents.id,
          reference: incidents.reference,
          title: incidents.title,
          type: incidents.incidentType,
          priority: incidents.priority,
          status: incidents.status,
          occurredAt: incidents.occurredAt,
          place: incidents.locationDescription,
        })
        .from(incidents)
        .where(and(eq(incidents.tenantId, user.tenantId), gte(incidents.occurredAt, from)))
        .orderBy(sql`${incidents.occurredAt} desc`);
      return { type, period, rows };
    }

    const rows = await this.db
      .select({
        id: permits.id,
        reference: permits.reference,
        title: permits.title,
        status: permits.status,
        type: permitTypes.name,
        typeColor: permitTypes.color,
        department: departments.name,
        place: sql<string | null>`coalesce(${machinery.name}, ${locations.name})`,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        createdAt: permits.createdAt,
      })
      .from(permits)
      .leftJoin(permitTypes, eq(permits.permitTypeId, permitTypes.id))
      .leftJoin(departments, eq(permits.departmentId, departments.id))
      .leftJoin(machinery, eq(permits.machineryId, machinery.id))
      .leftJoin(locations, eq(permits.locationId, locations.id))
      .where(and(eq(permits.tenantId, user.tenantId), gte(permits.createdAt, from)))
      .orderBy(sql`${permits.createdAt} desc`);
    return { type, period, rows };
  }

  async getInsights(user: AuthenticatedUser, days = 30) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    const tenantId = user.tenantId;
    const now = new Date();
    const from = periodStart(days, now);

    const [
      byStatus,
      byType,
      byDepartment,
      hotspots,
      raised,
      closed,
      decisions,
      pending,
      overdueActive,
      incidentRows,
      conflictRows,
      actionRows,
    ] = await Promise.all([
      this.db
        .select({ key: permits.status, count: count() })
        .from(permits)
        .where(eq(permits.tenantId, tenantId))
        .groupBy(permits.status),
      this.db
        .select({ key: permitTypes.id, label: permitTypes.name, color: permitTypes.color, count: count() })
        .from(permits)
        .innerJoin(permitTypes, eq(permits.permitTypeId, permitTypes.id))
        .where(and(eq(permits.tenantId, tenantId), gte(permits.createdAt, from)))
        .groupBy(permitTypes.id, permitTypes.name, permitTypes.color),
      this.db
        .select({ key: departments.id, label: departments.name, count: count() })
        .from(permits)
        .innerJoin(departments, eq(permits.departmentId, departments.id))
        .where(and(eq(permits.tenantId, tenantId), gte(permits.createdAt, from)))
        .groupBy(departments.id, departments.name),
      this.db
        .select({
          key: sql<string>`coalesce(${machinery.id}::text, ${locations.id}::text)`,
          label: sql<string>`coalesce(${machinery.name}, ${locations.name})`,
          count: count(),
        })
        .from(permits)
        .leftJoin(machinery, eq(permits.machineryId, machinery.id))
        .leftJoin(locations, eq(permits.locationId, locations.id))
        .where(
          and(
            eq(permits.tenantId, tenantId),
            inArray(permits.status, LIVE_PERMIT_STATUSES),
            sql`coalesce(${machinery.name}, ${locations.name}) is not null`,
          ),
        )
        .groupBy(sql`1`, sql`2`),
      this.db
        .select({ day: sql<string>`to_char(date_trunc('day', ${permits.createdAt}), 'YYYY-MM-DD')`, count: count() })
        .from(permits)
        .where(and(eq(permits.tenantId, tenantId), gte(permits.createdAt, from)))
        .groupBy(sql`1`),
      this.db
        .select({ day: sql<string>`to_char(date_trunc('day', ${permitStatusHistory.createdAt}), 'YYYY-MM-DD')`, count: count() })
        .from(permitStatusHistory)
        .innerJoin(permits, eq(permitStatusHistory.permitId, permits.id))
        .where(
          and(
            eq(permits.tenantId, tenantId),
            eq(permitStatusHistory.toStatus, 'closed'),
            gte(permitStatusHistory.createdAt, from),
          ),
        )
        .groupBy(sql`1`),
      this.db
        .select({ decision: permitApprovals.decision, decidedAt: permitApprovals.decidedAt, submittedAt: permits.submittedAt })
        .from(permitApprovals)
        .innerJoin(permits, eq(permitApprovals.permitId, permits.id))
        .where(and(eq(permits.tenantId, tenantId), gte(permitApprovals.decidedAt, from))),
      this.db
        .select({ submittedAt: permits.submittedAt })
        .from(permits)
        .where(and(eq(permits.tenantId, tenantId), eq(permits.status, 'pending_approval'), isNotNull(permits.submittedAt))),
      this.db
        .select({ count: count() })
        .from(permits)
        .where(and(eq(permits.tenantId, tenantId), eq(permits.status, 'active'), lt(permits.plannedEndAt, now))),
      this.db
        .select({
          type: incidents.incidentType,
          priority: incidents.priority,
          status: incidents.status,
          occurredAt: incidents.occurredAt,
        })
        .from(incidents)
        .where(and(eq(incidents.tenantId, tenantId), gte(incidents.occurredAt, from))),
      this.db
        .select({ severity: simopsConflicts.severity, status: simopsConflicts.status })
        .from(simopsConflicts)
        .where(eq(simopsConflicts.tenantId, tenantId)),
      this.db
        .select({ status: correctiveActions.status, dueDate: correctiveActions.dueDate })
        .from(correctiveActions)
        .where(eq(correctiveActions.tenantId, tenantId)),
    ]);

    const hours = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 3_600_000;
    const decisionHours = decisions
      .filter((d) => d.submittedAt)
      .map((d) => hours(d.decidedAt, d.submittedAt!))
      .filter((h) => h >= 0)
      .sort((a, b) => a - b);
    const ageBuckets: Bucket[] = [
      { key: 'lt4h', label: 'Under 4 h', count: 0 },
      { key: '4to24h', label: '4 to 24 h', count: 0 },
      { key: '1to3d', label: '1 to 3 days', count: 0 },
      { key: 'gt3d', label: 'Over 3 days', count: 0 },
    ];
    for (const row of pending) {
      const age = hours(now, row.submittedAt!);
      ageBuckets[age < 4 ? 0 : age < 24 ? 1 : age < 72 ? 2 : 3].count += 1;
    }

    const today = now.toISOString().slice(0, 10);
    const actionsOverdue = actionRows.filter((a) => a.status !== 'completed' && a.status !== 'cancelled' && a.dueDate < today).length;
    const openIncidents = incidentRows.filter((i) => OPEN_INCIDENT_STATUSES.includes(i.status));
    const openConflicts = conflictRows.filter((c) => OPEN_CONFLICT_STATUSES.includes(c.status));

    return {
      period: { days, from: from.toISOString(), to: now.toISOString() },
      attention: {
        overdueActivePermits: Number(overdueActive[0]?.count ?? 0),
        approvalsWaitingOverDay: ageBuckets[2].count + ageBuckets[3].count,
        highSeverityConflicts: openConflicts.filter((c) => c.severity === 'high').length,
        criticalIncidentsOpen: openIncidents.filter((i) => i.priority === 'critical' || i.priority === 'high').length,
        overdueCorrectiveActions: actionsOverdue,
        suspendedPermits: Number(byStatus.find((s) => s.key === 'suspended')?.count ?? 0),
      },
      permits: {
        byStatus: byStatus.map((r) => ({ key: r.key, count: Number(r.count) })),
        byType: sortDesc(byType.map((r) => ({ key: r.key, label: r.label, color: r.color, count: Number(r.count) }))),
        byDepartment: sortDesc(byDepartment.map((r) => ({ key: r.key, label: r.label, count: Number(r.count) }))),
        hotspots: sortDesc(hotspots.map((r) => ({ key: r.key, label: r.label, count: Number(r.count) }))).slice(0, 6),
        timeline: dailySeries(from, now, { raised, closed }),
      },
      approvals: {
        decisions: countBy(decisions.map((d) => d.decision)),
        decided: decisionHours.length,
        medianHoursToDecision: median(decisionHours),
        waitingByAge: ageBuckets,
      },
      incidents: {
        total: incidentRows.length,
        open: openIncidents.length,
        byType: countBy(incidentRows.map((i) => i.type)),
        byPriority: countBy(incidentRows.map((i) => i.priority)),
        timeline: dailySeries(from, now, {
          reported: Object.entries(countBy(incidentRows.map((i) => i.occurredAt.toISOString().slice(0, 10)))).map(
            ([day, n]) => ({ day, count: n }),
          ),
        }),
      },
      simops: {
        open: openConflicts.length,
        bySeverity: ['high', 'medium', 'low'].map((severity) => ({
          key: severity,
          open: openConflicts.filter((c) => c.severity === severity).length,
          resolved: conflictRows.filter((c) => c.severity === severity && !OPEN_CONFLICT_STATUSES.includes(c.status)).length,
        })),
      },
      actions: {
        open: actionRows.filter((a) => a.status === 'open' || a.status === 'in_progress').length,
        overdue: actionsOverdue,
        completed: actionRows.filter((a) => a.status === 'completed').length,
      },
    };
  }
}

export type ReportView = { type: string; period: { days: number; from: string; to: string }; rows: Record<string, unknown>[] };

export function periodStart(days: number, now = new Date()): Date {
  const from = new Date(now.getTime() - days * DAY_MS);
  from.setUTCHours(0, 0, 0, 0);
  return from;
}

function sortDesc<T extends { count: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.count - a.count);
}

function countBy(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

export function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

/** One row per day in the period, filling missing days with zero so charts keep their shape. */
export function dailySeries(
  from: Date,
  to: Date,
  series: Record<string, { day: string; count: number | string }[]>,
): Record<string, string | number>[] {
  const lookup = Object.fromEntries(
    Object.entries(series).map(([name, rows]) => [name, new Map(rows.map((r) => [r.day, Number(r.count)]))]),
  );
  const rows: Record<string, string | number>[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    const row: Record<string, string | number> = { day };
    for (const name of Object.keys(series)) row[name] = lookup[name].get(day) ?? 0;
    rows.push(row);
  }
  return rows;
}
