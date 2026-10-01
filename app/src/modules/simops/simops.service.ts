import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalHistory,
  permitHazards,
  permitLototo,
  permitPpe,
  permits,
  simopsCaseControls,
  simopsCaseHistory,
  simopsCaseInteractions,
  simopsCasePermits,
  simopsCases,
  tenantUsers,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { CanonicalNotificationService } from '../notifications/canonical-notification.service';
import { ANALYSABLE_PERMIT_STATUSES } from './simops.constants';
import { ConflictSearchDto, ResolveSimopsCaseDto } from './dto/simops.dto';
import {
  clusterConflicts,
  clusterFingerprint,
  detectConflicts,
  excludeResolvedOverlaps,
  type DetectedConflict,
  type PermitForAnalysis,
} from './conflict-detection.service';

const LIVE_DEFAULT_ALLOW = ['approved', 'active', 'suspended'] as const;

@Injectable()
export class SimopsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly canonicalNotificationService: CanonicalNotificationService,
  ) {}

  async listConflicts(user: AuthenticatedUser, query: ConflictSearchDto = {}) {
    const cases = await this.listCases(user, query);
    return cases.map((row) => this.toConflictListItem(row));
  }

  async listCases(user: AuthenticatedUser, query: ConflictSearchDto = {}) {
    const tenantId = this.requireTenant(user);
    const status = this.normalizeListStatus(query.status);
    const conditions = [eq(simopsCases.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(simopsCases.status, status));
    }
    if (query.severity) {
      conditions.push(eq(simopsCases.severity, query.severity));
    }

    const rows = await this.db
      .select()
      .from(simopsCases)
      .where(and(...conditions))
      .orderBy(desc(simopsCases.detectedAt));

    if (!query.permitId) {
      return rows;
    }

    const members = await this.db
      .select({ caseId: simopsCasePermits.caseId })
      .from(simopsCasePermits)
      .where(
        and(eq(simopsCasePermits.tenantId, tenantId), eq(simopsCasePermits.permitId, query.permitId)),
      );
    const ids = new Set(members.map((row) => row.caseId));
    return rows.filter((row) => ids.has(row.id));
  }

  async findConflict(id: string, user: AuthenticatedUser) {
    const detail = await this.findCase(id, user);
    const dominant = this.dominantInteraction(detail.interactions);
    return {
      conflict: this.toConflictListItem(detail.case, dominant?.conflictType ?? 'location'),
      participants: detail.members.map((member) => ({
        id: member.id,
        conflictId: detail.case.id,
        permitId: member.permitId,
        permit: member.permit,
      })),
      alerts: [],
      assessment: null,
      mitigation: null,
      resolution:
        detail.case.status === 'resolved'
          ? {
              id: detail.case.id,
              conflictId: detail.case.id,
              outcome: detail.members.some((m) => m.decision === 'reject') ? 'rejected' : 'approved',
              comments: detail.members
                .map((m) => m.comments)
                .filter(Boolean)
                .join(' '),
              resolvedBy: detail.case.resolvedBy,
              resolvedAt: detail.case.resolvedAt,
            }
          : null,
      history: detail.history.map((row) => ({
        id: row.id,
        conflictId: detail.case.id,
        action: row.action,
        actorUserId: row.actorUserId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })),
      case: detail,
    };
  }

  async findCase(id: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const [row] = await this.db
      .select()
      .from(simopsCases)
      .where(and(eq(simopsCases.id, id), eq(simopsCases.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('SIMOPS case not found');
    }

    const memberRows = await this.db
      .select({ member: simopsCasePermits, permit: permits })
      .from(simopsCasePermits)
      .innerJoin(permits, eq(simopsCasePermits.permitId, permits.id))
      .where(eq(simopsCasePermits.caseId, row.id));

    const permitIds = memberRows.map((item) => item.permit.id);
    const [hazards, ppe, lototo, interactions, controls, history, people] = await Promise.all([
      permitIds.length
        ? this.db.select().from(permitHazards).where(inArray(permitHazards.permitId, permitIds))
        : Promise.resolve([]),
      permitIds.length
        ? this.db.select().from(permitPpe).where(inArray(permitPpe.permitId, permitIds))
        : Promise.resolve([]),
      permitIds.length
        ? this.db.select().from(permitLototo).where(inArray(permitLototo.permitId, permitIds))
        : Promise.resolve([]),
      this.db
        .select()
        .from(simopsCaseInteractions)
        .where(eq(simopsCaseInteractions.caseId, row.id)),
      this.db.select().from(simopsCaseControls).where(eq(simopsCaseControls.caseId, row.id)),
      this.db
        .select()
        .from(simopsCaseHistory)
        .where(eq(simopsCaseHistory.caseId, row.id))
        .orderBy(desc(simopsCaseHistory.createdAt)),
      this.db
        .select({
          id: tenantUsers.id,
          firstName: tenantUsers.firstName,
          lastName: tenantUsers.lastName,
          email: tenantUsers.email,
          status: tenantUsers.status,
        })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.status, 'active'))),
    ]);

    return {
      case: row,
      members: memberRows.map((item) => ({
        ...item.member,
        permit: item.permit,
        hazards: hazards.filter((h) => h.permitId === item.permit.id),
        ppe: ppe.filter((p) => p.permitId === item.permit.id),
        lototo: lototo.filter((l) => l.permitId === item.permit.id),
      })),
      interactions,
      controls,
      history,
      people,
    };
  }

  async findOpenCaseForPermit(permitId: string, tenantId: string) {
    const members = await this.db
      .select({ caseId: simopsCasePermits.caseId })
      .from(simopsCasePermits)
      .innerJoin(simopsCases, eq(simopsCasePermits.caseId, simopsCases.id))
      .where(
        and(
          eq(simopsCasePermits.permitId, permitId),
          eq(simopsCases.tenantId, tenantId),
          eq(simopsCases.status, 'review_required'),
        ),
      )
      .limit(1);
    if (members.length === 0) {
      return null;
    }
    return this.db
      .select()
      .from(simopsCases)
      .where(eq(simopsCases.id, members[0].caseId))
      .then((rows) => rows[0] ?? null);
  }

  async assertNoOpenCase(permitId: string, tenantId: string) {
    const open = await this.findOpenCaseForPermit(permitId, tenantId);
    if (open) {
      throw new ConflictException(
        'SIMOPS case must be resolved before this permit can be approved',
      );
    }
  }

  async listAlerts() {
    return [];
  }

  async listHistory(user: AuthenticatedUser) {
    const rows = await this.listCases(user, { status: 'resolved' });
    return rows.map((row) => ({
      conflict: this.toConflictListItem(row),
      resolution: {
        id: row.id,
        conflictId: row.id,
        outcome: 'approved' as const,
        comments: row.summary,
        resolvedBy: row.resolvedBy,
        resolvedAt: row.resolvedAt,
      },
    }));
  }

  async getHistoryRecord(id: string, user: AuthenticatedUser) {
    return this.findConflict(id, user);
  }

  async analyse(user: AuthenticatedUser, permitId?: string) {
    return this.syncCases(user, permitId);
  }

  async syncOnSubmit(permitId: string, user: AuthenticatedUser) {
    return this.syncCases(user, permitId);
  }

  async resolveCase(id: string, dto: ResolveSimopsCaseDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const detail = await this.findCase(id, user);
    if (detail.case.status !== 'review_required') {
      throw new BadRequestException('Case is already resolved');
    }

    const byPermit = new Map(dto.decisions.map((item) => [item.permitId, item]));
    for (const member of detail.members) {
      const decision = byPermit.get(member.permitId);
      if (!decision) {
        throw new BadRequestException('Every permit in the case needs a decision');
      }
      if (decision.decision === 'reject' && !decision.comments?.trim()) {
        throw new BadRequestException('Rejected permits need comments');
      }
      if (decision.decision === 'allow_with_controls') {
        const hasControl = (dto.controls ?? []).some((c) => c.permitId === member.permitId);
        if (!hasControl) {
          throw new BadRequestException('Allow with controls needs at least one control');
        }
      }
    }

    for (const control of dto.controls ?? []) {
      if (!byPermit.has(control.permitId)) {
        throw new BadRequestException('Control must belong to a permit in this case');
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(simopsCaseControls).where(eq(simopsCaseControls.caseId, id));
      if (dto.controls?.length) {
        await tx.insert(simopsCaseControls).values(
          dto.controls.map((control) => ({
            tenantId,
            caseId: id,
            permitId: control.permitId,
            controlText: control.controlText.trim(),
            responsibleUserId: control.responsibleUserId,
            comments: control.comments?.trim() || null,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        );
      }

      for (const member of detail.members) {
        const decision = byPermit.get(member.permitId)!;
        await tx
          .update(simopsCasePermits)
          .set({
            decision: decision.decision,
            comments: decision.comments?.trim() || null,
            updatedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(simopsCasePermits.id, member.id));

        if (decision.decision === 'reject') {
          const fromStatus = member.permit.status;
          await tx
            .update(permits)
            .set({ status: 'rejected', updatedBy: user.id, updatedAt: new Date() })
            .where(and(eq(permits.id, member.permitId), eq(permits.tenantId, tenantId)));
          await tx.insert(approvalHistory).values({
            permitId: member.permitId,
            action: 'rejected',
            fromStatus,
            toStatus: 'rejected',
            actorId: user.id,
            comment: decision.comments?.trim() ?? null,
            createdBy: user.id,
          });
        }
      }

      await tx
        .update(simopsCases)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: user.id,
          updatedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(simopsCases.id, id));

      await tx.insert(simopsCaseHistory).values({
        tenantId,
        caseId: id,
        action: 'resolved',
        actorUserId: user.id,
        metadata: { decisions: dto.decisions },
        createdBy: user.id,
        updatedBy: user.id,
      });
    });

    await this.auditService.log({
      action: 'simops.case_resolved',
      entityType: 'simops_case',
      entityId: id,
      tenantId,
      userId: user.id,
    });

    await this.syncCases(user);
    return this.findCase(id, user);
  }

  private async syncCases(user: AuthenticatedUser, focusPermitId?: string) {
    const tenantId = this.requireTenant(user);
    const analysablePermits = await this.loadAnalysablePermits(tenantId);
    const detected = detectConflicts(analysablePermits);
    const resolvedSets = await this.loadResolvedPermitSets(tenantId);
    const remaining = excludeResolvedOverlaps(detected, resolvedSets);
    const clusters = clusterConflicts(remaining).filter((cluster) =>
      focusPermitId ? cluster.permitIds.includes(focusPermitId) : true,
    );

    const openCases = await this.db
      .select()
      .from(simopsCases)
      .where(and(eq(simopsCases.tenantId, tenantId), eq(simopsCases.status, 'review_required')));
    const openMembers = openCases.length
      ? await this.db
          .select()
          .from(simopsCasePermits)
          .where(inArray(simopsCasePermits.caseId, openCases.map((row) => row.id)))
      : [];

    let created = 0;
    let skipped = 0;

    for (const cluster of clusters) {
      const overlapping = openCases.filter((row) =>
        openMembers.some(
          (member) => member.caseId === row.id && cluster.permitIds.includes(member.permitId),
        ),
      );
      if (overlapping.length > 0) {
        await this.mergeIntoCase(tenantId, overlapping, cluster, analysablePermits, user.id);
        skipped += 1;
        continue;
      }

      const fingerprint = clusterFingerprint(cluster.permitIds);
      const [existing] = await this.db
        .select({ id: simopsCases.id })
        .from(simopsCases)
        .where(and(eq(simopsCases.tenantId, tenantId), eq(simopsCases.fingerprint, fingerprint)))
        .limit(1);
      if (existing) {
        skipped += 1;
        continue;
      }

      await this.insertCase(tenantId, cluster, analysablePermits, user.id);
      created += 1;
    }

    await this.auditService.log({
      action: 'simops.analyse',
      entityType: 'simops_case',
      tenantId,
      userId: user.id,
      metadata: {
        permitId: focusPermitId ?? null,
        analysedPermitCount: analysablePermits.length,
        created,
        skipped,
      },
    });

    return {
      analysedPermitCount: analysablePermits.length,
      detectedCount: remaining.length,
      createdCount: created,
      skippedCount: skipped,
    };
  }

  private async insertCase(
    tenantId: string,
    cluster: { permitIds: string[]; interactions: DetectedConflict[] },
    permitsForAnalysis: PermitForAnalysis[],
    userId: string,
  ) {
    const severity = this.highestSeverity(cluster.interactions);
    const summary = `${cluster.permitIds.length} permits interact during overlapping work.`;
    const fingerprint = clusterFingerprint(cluster.permitIds);
    const [created] = await this.db
      .insert(simopsCases)
      .values({
        tenantId,
        status: 'review_required',
        severity,
        summary,
        fingerprint,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await this.replaceMembersAndInteractions(tenantId, created.id, cluster, permitsForAnalysis, userId);

    await this.db.insert(simopsCaseHistory).values({
      tenantId,
      caseId: created.id,
      action: 'detected',
      actorUserId: userId,
      metadata: { permitIds: cluster.permitIds },
      createdBy: userId,
      updatedBy: userId,
    });

    await this.canonicalNotificationService.fromSimopsConflict({
      tenantId,
      conflictId: created.id,
      actorId: userId,
      permitIds: cluster.permitIds,
      severity,
      summary,
    });
  }

  private async mergeIntoCase(
    tenantId: string,
    overlapping: (typeof simopsCases.$inferSelect)[],
    cluster: { permitIds: string[]; interactions: DetectedConflict[] },
    permitsForAnalysis: PermitForAnalysis[],
    userId: string,
  ) {
    const survivor = overlapping.sort(
      (a, b) => a.detectedAt.getTime() - b.detectedAt.getTime(),
    )[0];
    const extras = overlapping.filter((row) => row.id !== survivor.id);
    const extraMembers = extras.length
      ? await this.db
          .select()
          .from(simopsCasePermits)
          .where(inArray(simopsCasePermits.caseId, extras.map((row) => row.id)))
      : [];

    const permitIds = [
      ...new Set([
        ...cluster.permitIds,
        ...extraMembers.map((row) => row.permitId),
        ...(await this.db
          .select({ permitId: simopsCasePermits.permitId })
          .from(simopsCasePermits)
          .where(eq(simopsCasePermits.caseId, survivor.id))
        ).map((row) => row.permitId),
      ]),
    ].sort();

    const interactions = detectConflicts(
      permitsForAnalysis.filter((p) => permitIds.includes(p.id)),
    );
    const merged = { permitIds, interactions };

    for (const extra of extras) {
      await this.db.delete(simopsCases).where(eq(simopsCases.id, extra.id));
    }

    await this.db
      .update(simopsCases)
      .set({
        fingerprint: clusterFingerprint(permitIds),
        severity: this.highestSeverity(interactions),
        summary: `${permitIds.length} permits interact during overlapping work.`,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(simopsCases.id, survivor.id));

    await this.replaceMembersAndInteractions(tenantId, survivor.id, merged, permitsForAnalysis, userId);
  }

  private async replaceMembersAndInteractions(
    tenantId: string,
    caseId: string,
    cluster: { permitIds: string[]; interactions: DetectedConflict[] },
    permitsForAnalysis: PermitForAnalysis[],
    userId: string,
  ) {
    const existing = await this.db
      .select()
      .from(simopsCasePermits)
      .where(eq(simopsCasePermits.caseId, caseId));
    const existingByPermit = new Map(existing.map((row) => [row.permitId, row]));

    await this.db.delete(simopsCaseInteractions).where(eq(simopsCaseInteractions.caseId, caseId));
    await this.db.delete(simopsCasePermits).where(eq(simopsCasePermits.caseId, caseId));

    await this.db.insert(simopsCasePermits).values(
      cluster.permitIds.map((permitId) => {
        const prior = existingByPermit.get(permitId);
        const permit = permitsForAnalysis.find((row) => row.id === permitId);
        const liveDefault =
          permit && LIVE_DEFAULT_ALLOW.includes(permit.status as (typeof LIVE_DEFAULT_ALLOW)[number])
            ? 'allow'
            : null;
        return {
          tenantId,
          caseId,
          permitId,
          decision: prior?.decision ?? liveDefault,
          comments: prior?.comments ?? null,
          createdBy: userId,
          updatedBy: userId,
        };
      }),
    );

    if (cluster.interactions.length > 0) {
      await this.db.insert(simopsCaseInteractions).values(
        cluster.interactions.map((item) => ({
          tenantId,
          caseId,
          permitIdA: item.permitIds[0],
          permitIdB: item.permitIds[1],
          conflictType: item.conflictType,
          severity: item.severity,
          summary: item.summary,
          details: item.details,
          createdBy: userId,
          updatedBy: userId,
        })),
      );
    }
  }

  private async loadResolvedPermitSets(tenantId: string): Promise<string[][]> {
    const resolved = await this.db
      .select({ id: simopsCases.id })
      .from(simopsCases)
      .where(and(eq(simopsCases.tenantId, tenantId), eq(simopsCases.status, 'resolved')));
    if (resolved.length === 0) {
      return [];
    }
    const members = await this.db
      .select()
      .from(simopsCasePermits)
      .where(inArray(simopsCasePermits.caseId, resolved.map((row) => row.id)));
    const byCase = new Map<string, string[]>();
    for (const member of members) {
      const list = byCase.get(member.caseId) ?? [];
      list.push(member.permitId);
      byCase.set(member.caseId, list);
    }
    return [...byCase.values()];
  }

  private async loadAnalysablePermits(tenantId: string): Promise<PermitForAnalysis[]> {
    return this.db
      .select({
        id: permits.id,
        reference: permits.reference,
        title: permits.title,
        permitTypeId: permits.permitTypeId,
        workstationId: permits.workstationId,
        locationId: permits.locationId,
        machineryId: permits.machineryId,
        plannedStartAt: permits.plannedStartAt,
        plannedEndAt: permits.plannedEndAt,
        status: permits.status,
      })
      .from(permits)
      .where(
        and(eq(permits.tenantId, tenantId), inArray(permits.status, [...ANALYSABLE_PERMIT_STATUSES])),
      );
  }

  private highestSeverity(items: DetectedConflict[]): 'low' | 'medium' | 'high' {
    if (items.some((item) => item.severity === 'high')) return 'high';
    if (items.some((item) => item.severity === 'medium')) return 'medium';
    return 'low';
  }

  private dominantInteraction(interactions: (typeof simopsCaseInteractions.$inferSelect)[]) {
    return [...interactions].sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return (rank[a.severity as keyof typeof rank] ?? 9) - (rank[b.severity as keyof typeof rank] ?? 9);
    })[0];
  }

  private toConflictListItem(
    row: typeof simopsCases.$inferSelect,
    conflictType: string = 'location',
  ) {
    return {
      ...row,
      conflictType,
      status:
        row.status === 'review_required'
          ? 'open'
          : row.status === 'resolved'
            ? 'approved'
            : row.status,
    };
  }

  private normalizeListStatus(status?: string) {
    if (!status) return undefined;
    if (status === 'open' || status === 'assessed' || status === 'mitigation_planned') {
      return 'review_required';
    }
    if (status === 'approved' || status === 'rejected') {
      return 'resolved';
    }
    return status;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
