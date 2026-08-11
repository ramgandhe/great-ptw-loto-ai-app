import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, inArray, lte, SQL } from 'drizzle-orm';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  incidents,
  isolationExecution,
  lototoPlans,
  permits,
  simopsConflicts,
} from '../../database/schema';

export type OperationalFilters = {
  status?: string;
  plantId?: string;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
};

/**
 * Tenant-scoped source-of-truth counters/rows for FR-DAS-002…008.
 * All queries include tenant_id; optional operational filters for FR-DAS-008.
 */
@Injectable()
export class OperationalMetricsService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  validatePeriod(filters: OperationalFilters): void {
    if (filters.periodStart && filters.periodEnd) {
      const start = new Date(filters.periodStart).getTime();
      const end = new Date(filters.periodEnd).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
        throw new BadRequestException('Invalid date range: periodStart must be <= periodEnd');
      }
    }
  }

  async permitCounts(tenantId: string, filters: OperationalFilters = {}) {
    this.validatePeriod(filters);
    const base = this.permitConditions(tenantId, filters);
    const [active] = await this.db
      .select({ value: count() })
      .from(permits)
      .where(and(...base, inArray(permits.status, ['active', 'approved'])));
    const [pending] = await this.db
      .select({ value: count() })
      .from(permits)
      .where(and(...base, eq(permits.status, 'pending_approval')));
    const [suspended] = await this.db
      .select({ value: count() })
      .from(permits)
      .where(and(...base, eq(permits.status, 'suspended')));
    const [closed] = await this.db
      .select({ value: count() })
      .from(permits)
      .where(and(...base, eq(permits.status, 'closed')));
    return {
      active: Number(active?.value ?? 0),
      pending: Number(pending?.value ?? 0),
      suspended: Number(suspended?.value ?? 0),
      closed: Number(closed?.value ?? 0),
    };
  }

  async listPermits(tenantId: string, filters: OperationalFilters = {}, limit = 500) {
    this.validatePeriod(filters);
    return this.db
      .select({
        id: permits.id,
        reference: permits.reference,
        status: permits.status,
        title: permits.title,
        plantId: permits.plantId,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        createdAt: permits.createdAt,
      })
      .from(permits)
      .where(and(...this.permitConditions(tenantId, filters)))
      .limit(limit);
  }

  async incidentCounts(tenantId: string, filters: OperationalFilters = {}) {
    this.validatePeriod(filters);
    const base = this.incidentConditions(tenantId, filters);
    const [open] = await this.db
      .select({ value: count() })
      .from(incidents)
      .where(
        and(...base, inArray(incidents.status, ['open', 'investigating', 'pending_verification'])),
      );
    const [closed] = await this.db
      .select({ value: count() })
      .from(incidents)
      .where(and(...base, eq(incidents.status, 'closed')));
    return {
      open: Number(open?.value ?? 0),
      closed: Number(closed?.value ?? 0),
    };
  }

  async listIncidents(tenantId: string, filters: OperationalFilters = {}, limit = 500) {
    this.validatePeriod(filters);
    return this.db
      .select({
        id: incidents.id,
        reference: incidents.reference,
        status: incidents.status,
        incidentType: incidents.incidentType,
        severityPath: incidents.severityPath,
        title: incidents.title,
        plantId: incidents.plantId,
        occurredAt: incidents.occurredAt,
      })
      .from(incidents)
      .where(and(...this.incidentConditions(tenantId, filters)))
      .limit(limit);
  }

  async simopsCounts(tenantId: string, filters: OperationalFilters = {}) {
    this.validatePeriod(filters);
    const base = this.simopsConditions(tenantId, filters);
    const [open] = await this.db
      .select({ value: count() })
      .from(simopsConflicts)
      .where(and(...base, eq(simopsConflicts.status, 'open')));
    const [resolved] = await this.db
      .select({ value: count() })
      .from(simopsConflicts)
      .where(and(...base, inArray(simopsConflicts.status, ['approved', 'rejected', 'resolved'])));
    return {
      open: Number(open?.value ?? 0),
      resolved: Number(resolved?.value ?? 0),
    };
  }

  async listSimops(tenantId: string, filters: OperationalFilters = {}, limit = 500) {
    this.validatePeriod(filters);
    return this.db
      .select({
        id: simopsConflicts.id,
        status: simopsConflicts.status,
        severity: simopsConflicts.severity,
        conflictType: simopsConflicts.conflictType,
        summary: simopsConflicts.summary,
        createdAt: simopsConflicts.createdAt,
      })
      .from(simopsConflicts)
      .where(and(...this.simopsConditions(tenantId, filters)))
      .limit(limit);
  }

  async lototoCounts(tenantId: string, filters: OperationalFilters = {}) {
    this.validatePeriod(filters);
    const baseExec = this.lototoExecutionConditions(tenantId, filters);
    const [activeExec] = await this.db
      .select({ value: count() })
      .from(isolationExecution)
      .where(
        and(
          ...baseExec,
          inArray(isolationExecution.status, ['in_progress', 'isolated', 'verified']),
        ),
      );
    const [plans] = await this.db
      .select({ value: count() })
      .from(lototoPlans)
      .where(and(eq(lototoPlans.tenantId, tenantId), eq(lototoPlans.status, 'ready')));
    return {
      activeExecutions: Number(activeExec?.value ?? 0),
      readyPlans: Number(plans?.value ?? 0),
    };
  }

  async listLototoExecutions(tenantId: string, filters: OperationalFilters = {}, limit = 500) {
    this.validatePeriod(filters);
    return this.db
      .select({
        id: isolationExecution.id,
        planId: isolationExecution.planId,
        status: isolationExecution.status,
        createdAt: isolationExecution.createdAt,
      })
      .from(isolationExecution)
      .where(and(...this.lototoExecutionConditions(tenantId, filters)))
      .limit(limit);
  }

  async organizationalBundle(tenantId: string, filters: OperationalFilters = {}) {
    const [permit, incident, simops, lototo] = await Promise.all([
      this.permitCounts(tenantId, filters),
      this.incidentCounts(tenantId, filters),
      this.simopsCounts(tenantId, filters),
      this.lototoCounts(tenantId, filters),
    ]);
    return {
      permits: permit,
      incidents: incident,
      simops,
      lototo,
      empty:
        permit.active +
          permit.pending +
          incident.open +
          simops.open +
          lototo.activeExecutions ===
        0,
    };
  }

  private permitConditions(tenantId: string, filters: OperationalFilters): SQL[] {
    const conditions: SQL[] = [eq(permits.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(permits.status, filters.status));
    if (filters.plantId) conditions.push(eq(permits.plantId, filters.plantId));
    if (filters.periodStart) {
      conditions.push(gte(permits.createdAt, new Date(filters.periodStart)));
    }
    if (filters.periodEnd) {
      conditions.push(lte(permits.createdAt, new Date(filters.periodEnd)));
    }
    return conditions;
  }

  private incidentConditions(tenantId: string, filters: OperationalFilters): SQL[] {
    const conditions: SQL[] = [eq(incidents.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(incidents.status, filters.status));
    if (filters.plantId) conditions.push(eq(incidents.plantId, filters.plantId));
    if (filters.periodStart) {
      conditions.push(gte(incidents.occurredAt, new Date(filters.periodStart)));
    }
    if (filters.periodEnd) {
      conditions.push(lte(incidents.occurredAt, new Date(filters.periodEnd)));
    }
    return conditions;
  }

  private simopsConditions(tenantId: string, filters: OperationalFilters): SQL[] {
    const conditions: SQL[] = [eq(simopsConflicts.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(simopsConflicts.status, filters.status));
    if (filters.periodStart) {
      conditions.push(gte(simopsConflicts.createdAt, new Date(filters.periodStart)));
    }
    if (filters.periodEnd) {
      conditions.push(lte(simopsConflicts.createdAt, new Date(filters.periodEnd)));
    }
    return conditions;
  }

  private lototoExecutionConditions(tenantId: string, filters: OperationalFilters): SQL[] {
    const conditions: SQL[] = [eq(isolationExecution.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(isolationExecution.status, filters.status));
    if (filters.periodStart) {
      conditions.push(gte(isolationExecution.createdAt, new Date(filters.periodStart)));
    }
    if (filters.periodEnd) {
      conditions.push(lte(isolationExecution.createdAt, new Date(filters.periodEnd)));
    }
    return conditions;
  }
}
