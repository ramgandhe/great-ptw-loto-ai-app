import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { requireActorId } from '../../common/helpers/require-actor-id';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  permitExtensions,
  permitRenewals,
  permitRevalidations,
  permits,
  permitSuspensions,
  revalidationHistory,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  DecideExtensionDto,
  DecideRenewalDto,
  RequestExtensionDto,
  RevalidatePermitDto,
  SuspendPermitDto,
} from './dto/revalidation.dto';
import { RevalidationCacheService } from './revalidation-cache.service';
import { RevalidationLogService } from './revalidation-log.service';
import {
  evaluateValidityDecision,
  isExpiredOrOutOfRange,
  operationalDateInTimezone,
} from './validity-rules';
import { ValidityTransitionService } from './validity-transition.service';

@Injectable()
export class RevalidationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: RevalidationCacheService,
    private readonly logService: RevalidationLogService,
    private readonly validityTransitionService: ValidityTransitionService,
  ) {}

  async revalidate(permitId: string, dto: RevalidatePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);
    // FR-MDP-009 — server operational date (tenant TZ); reject client clock spoofing.
    const timezone = await this.validityTransitionService.resolveTenantTimezone(tenantId);
    const serverOperationalDate = operationalDateInTimezone(new Date(), timezone);
    const operationalDate = dto.operationalDate.slice(0, 10);
    if (operationalDate !== serverOperationalDate) {
      throw new ConflictException(
        `Operational date must match server date ${serverOperationalDate} (${timezone})`,
      );
    }

    const existing = await this.db
      .select({ id: permitRevalidations.id })
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.permitId, permitId),
          eq(permitRevalidations.operationalDate, operationalDate),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Revalidation already recorded for this operational day');
    }

    const [row] = await this.db
      .insert(permitRevalidations)
      .values({
        tenantId,
        permitId,
        operationalDate,
        outcome: dto.outcome,
        findings: dto.findings,
        checklist: dto.checklist ?? null,
        revalidatedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    const eventType = dto.outcome === 'passed' ? 'revalidation_passed' : 'revalidation_failed';
    await this.appendHistory(tenantId, permitId, eventType, actorId, {
      revalidationId: row.id,
      operationalDate,
    });

    if (dto.outcome === 'failed') {
      await this.suspendInternal(permit, actorId, 'Failed daily revalidation', 'failed_revalidation');
    }

    await this.auditService.log({
      action: `mdp.${eventType}`,
      entityType: 'permit_revalidation',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId, outcome: dto.outcome },
    });

    this.logService.logEvent({
      action: `mdp.${eventType}`,
      permitId,
      tenantId,
      userId: actorId,
      metadata: { revalidationId: row.id },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async continuePermit(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);

    const now = new Date();
    const validity = evaluateValidityDecision(permit.plannedStartAt, permit.plannedEndAt, now);
    if (isExpiredOrOutOfRange(validity.decision)) {
      throw new ConflictException(
        `Permit cannot continue: validity decision '${validity.decision}'`,
      );
    }

    const timezone = await this.validityTransitionService.resolveTenantTimezone(tenantId);
    const operationalDate = operationalDateInTimezone(now, timezone);

    const [latest] = await this.db
      .select()
      .from(permitRevalidations)
      .where(
        and(
          eq(permitRevalidations.tenantId, tenantId),
          eq(permitRevalidations.permitId, permitId),
          eq(permitRevalidations.operationalDate, operationalDate),
        ),
      )
      .orderBy(desc(permitRevalidations.revalidatedAt))
      .limit(1);

    if (!latest || latest.outcome !== 'passed') {
      throw new ConflictException(
        `Permit continuation requires a passed daily revalidation for ${operationalDate}`,
      );
    }

    if (permit.status === 'suspended') {
      const openSuspension = await this.db
        .select()
        .from(permitSuspensions)
        .where(
          and(
            eq(permitSuspensions.tenantId, tenantId),
            eq(permitSuspensions.permitId, permitId),
          ),
        )
        .orderBy(desc(permitSuspensions.suspendedAt))
        .limit(1);

      if (openSuspension[0] && !openSuspension[0].resumedAt) {
        if (openSuspension[0].reason.startsWith('SIMOPS conflict rejected:')) {
          throw new ConflictException(
            'Permit suspended by SIMOPS rejection cannot be continued via daily revalidation',
          );
        }

        await this.db
          .update(permitSuspensions)
          .set({ resumedAt: new Date(), resumedBy: actorId, updatedBy: actorId })
          .where(eq(permitSuspensions.id, openSuspension[0].id));
      }

      await this.db
        .update(permits)
        .set({ status: 'active', updatedBy: actorId })
        .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)));
    }

    await this.appendHistory(tenantId, permitId, 'permit_continued', actorId, {
      revalidationId: latest.id,
    });

    await this.auditService.log({
      action: 'mdp.permit_continued',
      entityType: 'permit',
      entityId: permitId,
      userId: actorId,
      tenantId,
    });

    this.logService.logEvent({
      action: 'mdp.permit_continued',
      permitId,
      tenantId,
      userId: actorId,
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return { permitId, status: 'active', revalidationId: latest.id };
  }

  async suspend(permitId: string, dto: SuspendPermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active']);
    return this.suspendInternal(permit, actorId, dto.reason, 'manual');
  }

  async requestExtension(permitId: string, dto: RequestExtensionDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);

    const [row] = await this.db
      .insert(permitExtensions)
      .values({
        tenantId,
        permitId,
        requestedEndAt: new Date(dto.requestedEndAt),
        previousEndAt: permit.plannedEndAt,
        justification: dto.justification,
        status: 'pending',
        requestedBy: actorId,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.appendHistory(tenantId, permitId, 'extension_requested', actorId, {
      extensionId: row.id,
    });

    await this.auditService.log({
      action: 'mdp.extension_requested',
      entityType: 'permit_extension',
      entityId: row.id,
      userId: actorId,
      tenantId,
      metadata: { permitId },
    });

    await this.cacheService.invalidatePermit(tenantId, permitId);
    return row;
  }

  async approveExtension(extensionId: string, dto: DecideExtensionDto, user: AuthenticatedUser) {
    return this.decideExtension(extensionId, 'approved', dto, user);
  }

  async rejectExtension(extensionId: string, dto: DecideExtensionDto, user: AuthenticatedUser) {
    return this.decideExtension(extensionId, 'rejected', dto, user);
  }

  /** Issuer starts renewal from a source permit (≤48h notify or expired). */
  async createRenewal(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    await this.requirePermit(permitId, tenantId, ['active', 'suspended', 'expired']);
    const result = await this.validityTransitionService.createRenewalDraft(
      permitId,
      tenantId,
      actorId,
    );
    await this.cacheService.invalidatePermit(tenantId, permitId);
    return result;
  }

  async submitRenewal(renewalId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const renewal = await this.requireRenewal(renewalId, tenantId);
    if (renewal.status !== 'draft') {
      throw new ConflictException('Only draft renewals can be submitted for HOD approval');
    }

    const [updated] = await this.db
      .update(permitRenewals)
      .set({ status: 'pending_approval', updatedBy: actorId })
      .where(eq(permitRenewals.id, renewalId))
      .returning();

    await this.db
      .update(permits)
      .set({ status: 'pending_approval', updatedBy: actorId })
      .where(and(eq(permits.id, renewal.renewalPermitId), eq(permits.tenantId, tenantId)));

    await this.appendHistory(tenantId, renewal.sourcePermitId, 'renewal_created', actorId, {
      renewalId,
      status: 'pending_approval',
    });

    await this.auditService.log({
      action: 'mdp.renewal_submitted',
      entityType: 'permit_renewal',
      entityId: renewalId,
      userId: actorId,
      tenantId,
    });

    await this.cacheService.invalidatePermit(tenantId, renewal.sourcePermitId);
    return updated;
  }

  async acceptRenewal(renewalId: string, dto: DecideRenewalDto, user: AuthenticatedUser) {
    return this.decideRenewal(renewalId, 'accepted', dto, user);
  }

  async rejectRenewal(renewalId: string, dto: DecideRenewalDto, user: AuthenticatedUser) {
    return this.decideRenewal(renewalId, 'rejected', dto, user);
  }

  async listHistory(permitId: string, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    await this.requirePermit(permitId, tenantId, ['active', 'suspended', 'closed', 'approved']);

    return this.db
      .select()
      .from(revalidationHistory)
      .where(
        and(eq(revalidationHistory.tenantId, tenantId), eq(revalidationHistory.permitId, permitId)),
      )
      .orderBy(desc(revalidationHistory.createdAt));
  }

  private async decideRenewal(
    renewalId: string,
    status: 'accepted' | 'rejected',
    dto: DecideRenewalDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const renewal = await this.requireRenewal(renewalId, tenantId);

    if (renewal.status !== 'pending_approval') {
      throw new ConflictException('Renewal has already been decided or is not pending');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(permitRenewals)
      .set({
        status,
        decidedBy: actorId,
        decidedAt: now,
        decisionComments: dto.comments ?? null,
        updatedBy: actorId,
      })
      .where(eq(permitRenewals.id, renewalId))
      .returning();

    if (status === 'accepted') {
      await this.db
        .update(permits)
        .set({ status: 'active', updatedBy: actorId })
        .where(and(eq(permits.id, renewal.renewalPermitId), eq(permits.tenantId, tenantId)));
    } else {
      await this.db
        .update(permits)
        .set({ status: 'rejected', updatedBy: actorId })
        .where(and(eq(permits.id, renewal.renewalPermitId), eq(permits.tenantId, tenantId)));
    }

    const eventType = status === 'accepted' ? 'renewal_accepted' : 'renewal_rejected';
    await this.appendHistory(tenantId, renewal.sourcePermitId, eventType, actorId, {
      renewalId,
      renewalPermitId: renewal.renewalPermitId,
    });

    await this.auditService.log({
      action: `mdp.${eventType}`,
      entityType: 'permit_renewal',
      entityId: renewalId,
      userId: actorId,
      tenantId,
    });

    await this.cacheService.invalidatePermit(tenantId, renewal.sourcePermitId);
    await this.cacheService.invalidatePermit(tenantId, renewal.renewalPermitId);
    return updated;
  }

  private async requireRenewal(renewalId: string, tenantId: string) {
    const [renewal] = await this.db
      .select()
      .from(permitRenewals)
      .where(and(eq(permitRenewals.id, renewalId), eq(permitRenewals.tenantId, tenantId)))
      .limit(1);

    if (!renewal) {
      throw new NotFoundException('Renewal not found');
    }
    return renewal;
  }

  private async decideExtension(
    extensionId: string,
    status: 'approved' | 'rejected',
    dto: DecideExtensionDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);

    const [extension] = await this.db
      .select()
      .from(permitExtensions)
      .where(and(eq(permitExtensions.id, extensionId), eq(permitExtensions.tenantId, tenantId)))
      .limit(1);

    if (!extension) {
      throw new NotFoundException('Extension request not found');
    }
    if (extension.status !== 'pending') {
      throw new ConflictException('Extension request has already been decided');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(permitExtensions)
      .set({
        status,
        decidedBy: actorId,
        decidedAt: now,
        decisionComments: dto.comments ?? null,
        updatedBy: actorId,
      })
      .where(eq(permitExtensions.id, extensionId))
      .returning();

    if (status === 'approved') {
      await this.db
        .update(permits)
        .set({ plannedEndAt: extension.requestedEndAt, updatedBy: actorId })
        .where(and(eq(permits.id, extension.permitId), eq(permits.tenantId, tenantId)));
    }

    const eventType = status === 'approved' ? 'extension_approved' : 'extension_rejected';
    await this.appendHistory(tenantId, extension.permitId, eventType, actorId, {
      extensionId,
    });

    await this.auditService.log({
      action: `mdp.${eventType}`,
      entityType: 'permit_extension',
      entityId: extensionId,
      userId: actorId,
      tenantId,
    });

    await this.cacheService.invalidatePermit(tenantId, extension.permitId);
    return updated;
  }

  private async suspendInternal(
    permit: typeof permits.$inferSelect,
    actorId: string,
    reason: string,
    source: 'manual' | 'failed_revalidation',
  ) {
    if (permit.status === 'suspended') {
      throw new ConflictException('Permit is already suspended');
    }

    const [row] = await this.db
      .insert(permitSuspensions)
      .values({
        tenantId: permit.tenantId,
        permitId: permit.id,
        reason,
        suspendedBy: actorId,
        source,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    await this.db
      .update(permits)
      .set({ status: 'suspended', updatedBy: actorId })
      .where(and(eq(permits.id, permit.id), eq(permits.tenantId, permit.tenantId)));

    await this.appendHistory(permit.tenantId, permit.id, 'permit_suspended', actorId, {
      suspensionId: row.id,
      source,
    });

    await this.auditService.log({
      action: 'mdp.permit_suspended',
      entityType: 'permit_suspension',
      entityId: row.id,
      userId: actorId,
      tenantId: permit.tenantId,
      metadata: { permitId: permit.id, source },
    });

    this.logService.logEvent({
      action: 'mdp.permit_suspended',
      permitId: permit.id,
      tenantId: permit.tenantId,
      userId: actorId,
      metadata: { source },
    });

    await this.cacheService.invalidatePermit(permit.tenantId, permit.id);
    return row;
  }

  private async appendHistory(
    tenantId: string,
    permitId: string,
    eventType: string,
    actorId: string,
    payload?: Record<string, unknown>,
  ) {
    await this.db.insert(revalidationHistory).values({
      tenantId,
      permitId,
      eventType: eventType as never,
      actorId,
      payload: payload ?? null,
      createdBy: actorId,
    });
  }

  private async requirePermit(
    permitId: string,
    tenantId: string,
    allowedStatuses: string[],
  ): Promise<typeof permits.$inferSelect> {
    const [permit] = await this.db
      .select()
      .from(permits)
      .where(and(eq(permits.id, permitId), eq(permits.tenantId, tenantId)))
      .limit(1);

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }
    if (!allowedStatuses.includes(permit.status)) {
      throw new ConflictException(`Permit status '${permit.status}' is not valid for this action`);
    }
    return permit;
  }

  private requireTenant(user: AuthenticatedUser): string {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }
    return user.tenantId;
  }
}
