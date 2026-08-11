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
  permitRevalidations,
  permits,
  permitSuspensions,
  revalidationHistory,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import { SimopsService } from '../simops/simops.service';
import {
  DecideExtensionDto,
  RequestExtensionDto,
  RevalidatePermitDto,
  SuspendPermitDto,
} from './dto/revalidation.dto';
import { RevalidationCacheService } from './revalidation-cache.service';
import { RevalidationLogService } from './revalidation-log.service';

@Injectable()
export class RevalidationService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly auditService: AuditService,
    private readonly cacheService: RevalidationCacheService,
    private readonly logService: RevalidationLogService,
    private readonly simopsService: SimopsService,
  ) {}

  async revalidate(permitId: string, dto: RevalidatePermitDto, user: AuthenticatedUser) {
    const tenantId = this.requireTenant(user);
    const actorId = requireActorId(user);
    const permit = await this.requirePermit(permitId, tenantId, ['active', 'suspended']);
    const operationalDate = dto.operationalDate.slice(0, 10);

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

    const [latest] = await this.db
      .select()
      .from(permitRevalidations)
      .where(
        and(eq(permitRevalidations.tenantId, tenantId), eq(permitRevalidations.permitId, permitId)),
      )
      .orderBy(desc(permitRevalidations.revalidatedAt))
      .limit(1);

    if (!latest || latest.outcome !== 'passed') {
      throw new ConflictException('Permit continuation requires a passed daily revalidation');
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

      // FR-SIM-016 — re-evaluate conflicts on permit extension.
      try {
        await this.simopsService.analyseForTenant(tenantId, actorId, extension.permitId);
      } catch {
        // Extension must not fail closed on SIMOPS errors.
      }
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
