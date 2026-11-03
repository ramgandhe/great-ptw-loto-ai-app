import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationAbsentLockRemovals,
  isolationCertificatePermits,
  isolationCertificates,
  isolationLockboxes,
  lockboxCrewLocks,
  permitExecutors,
  permitLototoCrew,
  permitLototoInstances,
  permits,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  ApplyPersonalLockDto,
  CreateLockboxDto,
  ReleaseLockboxDto,
  RemoveAbsentLockDto,
  SealLockboxDto,
} from './dto/isolation-lockbox.dto';
import { IsolationCertificateService } from './isolation-certificate.service';
import { LototoValidationService } from './lototo-validation.service';
import { NotificationService } from './notification.service';

@Injectable()
export class IsolationLockboxService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    @Optional() private readonly certificates?: IsolationCertificateService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async createLockbox(
    certificateId: string,
    dto: CreateLockboxDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);

    const [certificate] = await this.db
      .select()
      .from(isolationCertificates)
      .where(
        and(
          eq(isolationCertificates.id, certificateId),
          eq(isolationCertificates.tenantId, tenantId),
        ),
      );

    if (!certificate) {
      throw new NotFoundException('Energy Isolation Certificate not found');
    }

    return await this.db.transaction(async (tx) => {
      const [lockbox] = await tx
        .insert(isolationLockboxes)
        .values({
          tenantId,
          certificateId,
          boxNumber: dto.boxNumber.trim(),
          locationDescription: dto.locationDescription?.trim() ?? null,
          masterLockSerial: dto.masterLockSerial.trim(),
          custodyStatus: 'open_for_keys',
          createdBy: optionalUuid(user.id),
          updatedBy: optionalUuid(user.id),
        })
        .returning();

      if (!certificate.lockboxId) {
        await tx
          .update(isolationCertificates)
          .set({ lockboxId: lockbox.id, updatedAt: new Date() })
          .where(eq(isolationCertificates.id, certificateId));
      }

      await this.auditService.log({
        action: 'lototo.lockbox.created',
        entityType: 'isolation_lockbox',
        entityId: lockbox.id,
        userId: optionalUuid(user.id),
        tenantId,
        metadata: { certificateId, boxNumber: lockbox.boxNumber },
      });

      return lockbox;
    });
  }

  async getLockboxesForCertificate(certificateId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    return this.db
      .select()
      .from(isolationLockboxes)
      .where(
        and(
          eq(isolationLockboxes.certificateId, certificateId),
          eq(isolationLockboxes.tenantId, tenantId),
        ),
      )
      .orderBy(desc(isolationLockboxes.createdAt));
  }

  async getLockbox(lockboxId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);

    const [lockbox] = await this.db
      .select()
      .from(isolationLockboxes)
      .where(
        and(
          eq(isolationLockboxes.id, lockboxId),
          eq(isolationLockboxes.tenantId, tenantId),
        ),
      );

    if (!lockbox) {
      throw new NotFoundException('Lockbox not found');
    }

    const activeLocks = await this.db
      .select()
      .from(lockboxCrewLocks)
      .where(
        and(
          eq(lockboxCrewLocks.lockboxId, lockboxId),
          isNull(lockboxCrewLocks.removedAt),
        ),
      );

    return {
      ...lockbox,
      activePersonalLockCount: activeLocks.length,
    };
  }

  async sealLockbox(lockboxId: string, dto: SealLockboxDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const lockbox = await this.requireLockbox(lockboxId, tenantId);

    if (lockbox.custodyStatus !== 'open_for_keys') {
      throw new ConflictException(
        `Lockbox is already in '${lockbox.custodyStatus}' status and cannot be sealed again`,
      );
    }

    const now = new Date();
    const [updated] = await this.db
      .update(isolationLockboxes)
      .set({
        custodyStatus: 'keys_deposited_sealed',
        sealedAt: now,
        sealedBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationLockboxes.id, lockboxId))
      .returning();

    await this.auditService.log({
      action: 'lototo.lockbox.sealed',
      entityType: 'isolation_lockbox',
      entityId: lockboxId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { notes: dto.notes },
    });

    return updated;
  }

  async releaseLockbox(
    lockboxId: string,
    dto: ReleaseLockboxDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const lockbox = await this.requireLockbox(lockboxId, tenantId);

    if (lockbox.custodyStatus === 'keys_released') {
      throw new ConflictException('Lockbox keys have already been released');
    }

    // Safety Gate: Verify NO active personal crew locks remain on the lockbox
    const activeCrewLocks = await this.db
      .select({
        id: lockboxCrewLocks.id,
        workerName: lockboxCrewLocks.workerName,
        personalLockNumber: lockboxCrewLocks.personalLockNumber,
      })
      .from(lockboxCrewLocks)
      .where(
        and(
          eq(lockboxCrewLocks.lockboxId, lockboxId),
          isNull(lockboxCrewLocks.removedAt),
        ),
      );

    if (activeCrewLocks.length > 0) {
      const activeList = activeCrewLocks
        .map((l) => `${l.workerName} (Lock #${l.personalLockNumber})`)
        .join(', ');
      throw new ConflictException(
        `Cannot unseal or release lockbox: Active worker personal locks are still applied [${activeList}]. All workers must remove personal locks before key release.`,
      );
    }

    const [certificate] = await this.db
      .select({ status: isolationCertificates.status })
      .from(isolationCertificates)
      .where(eq(isolationCertificates.id, lockbox.certificateId));
    if (
      !certificate ||
      !['restoration_in_progress', 'restored_verified', 'closed'].includes(certificate.status)
    ) {
      throw new ConflictException('The device keys stay in the box until restoration');
    }

    const now = new Date();
    const [updated] = await this.db
      .update(isolationLockboxes)
      .set({
        custodyStatus: 'keys_released',
        releasedAt: now,
        releasedBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationLockboxes.id, lockboxId))
      .returning();

    await this.auditService.log({
      action: 'lototo.lockbox.released',
      entityType: 'isolation_lockbox',
      entityId: lockboxId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { notes: dto.notes },
    });

    return updated;
  }

  async applyPersonalLock(
    lockboxId: string,
    dto: ApplyPersonalLockDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const lockbox = await this.requireLockbox(lockboxId, tenantId);

    if (lockbox.custodyStatus !== 'keys_deposited_sealed') {
      throw new ConflictException(
        'Cannot apply personal lock: Lockbox must be sealed with master keys inside before workers can attach personal locks.',
      );
    }

    if (dto.workforceUserId && dto.workforceUserId !== user.id) {
      throw new ConflictException('A personal lock belongs to the signed-in person');
    }
    if (dto.permitId) {
      await this.assertPermitOnCertificate(lockbox.certificateId, dto.permitId, tenantId);
    }
    const targetUserId = user.id;

    // Check if worker already has an active lock on this box
    const [existing] = await this.db
      .select()
      .from(lockboxCrewLocks)
      .where(
        and(
          eq(lockboxCrewLocks.lockboxId, lockboxId),
          eq(lockboxCrewLocks.workforceUserId, targetUserId),
          isNull(lockboxCrewLocks.removedAt),
        ),
      );

    if (existing) {
      throw new ConflictException(
        `Worker '${dto.workerName}' already has an active personal lock (#${existing.personalLockNumber}) applied to this lockbox`,
      );
    }

    // Verify permit if provided
    if (dto.permitId) {
      const [permit] = await this.db
        .select()
        .from(permits)
        .where(and(eq(permits.id, dto.permitId), eq(permits.tenantId, tenantId)));
      if (!permit) {
        throw new NotFoundException('Associated permit not found');
      }
    }

    const [applied] = await this.db
      .insert(lockboxCrewLocks)
      .values({
        tenantId,
        lockboxId,
        permitId: dto.permitId ?? null,
        workforceUserId: targetUserId,
        workerName: dto.workerName.trim(),
        company: dto.company?.trim() ?? null,
        personalLockNumber: dto.personalLockNumber.trim(),
        appliedAt: new Date(),
        appliedBy: optionalUuid(user.id),
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    await this.auditService.log({
      action: 'lototo.lockbox.personal_lock_applied',
      entityType: 'lockbox_crew_lock',
      entityId: applied.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        lockboxId,
        personalLockNumber: applied.personalLockNumber,
        workerName: applied.workerName,
      },
    });

    return applied;
  }

  async removePersonalLock(
    lockboxId: string,
    lockId: string,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const lockbox = await this.requireLockbox(lockboxId, tenantId);

    const [lock] = await this.db
      .select()
      .from(lockboxCrewLocks)
      .where(
        and(
          eq(lockboxCrewLocks.id, lockId),
          eq(lockboxCrewLocks.lockboxId, lockboxId),
          eq(lockboxCrewLocks.tenantId, tenantId),
        ),
      );

    if (!lock) {
      throw new NotFoundException('Personal lock record not found on this lockbox');
    }

    if (lock.removedAt) {
      throw new ConflictException('Personal lock has already been removed');
    }
    if (lock.workforceUserId !== user.id) {
      throw new ForbiddenException('Take off your own lock');
    }

    const now = new Date();
    const [removed] = await this.db
      .update(lockboxCrewLocks)
      .set({
        removedAt: now,
        removedBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(lockboxCrewLocks.id, lockId))
      .returning();

    await this.auditService.log({
      action: 'lototo.lockbox.personal_lock_removed',
      entityType: 'lockbox_crew_lock',
      entityId: lockId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        lockboxId,
        personalLockNumber: lock.personalLockNumber,
        workerName: lock.workerName,
      },
    });

    await this.certificates?.notifyReady(lockbox.certificateId, user.id);
    return removed;
  }

  /** OSHA exception: remove another person's lock when they are absent. Never a silent delete. */
  async removeAbsentPersonalLock(
    lockboxId: string,
    lockId: string,
    dto: RemoveAbsentLockDto,
    user: AuthenticatedUser,
  ) {
    const tenantId = this.validationService.requireTenant(user);
    const lockbox = await this.requireLockbox(lockboxId, tenantId);
    if (!dto.clearOfPlantConfirmed) {
      throw new BadRequestException('Confirm the owner is clear of the plant');
    }
    if (!dto.authoriserOneId || !dto.authoriserTwoId || dto.authoriserOneId === dto.authoriserTwoId) {
      throw new BadRequestException('Two different authorisers are required');
    }

    const [lock] = await this.db
      .select()
      .from(lockboxCrewLocks)
      .where(
        and(
          eq(lockboxCrewLocks.id, lockId),
          eq(lockboxCrewLocks.lockboxId, lockboxId),
          eq(lockboxCrewLocks.tenantId, tenantId),
        ),
      );
    if (!lock) throw new NotFoundException('Personal lock record not found on this lockbox');
    if (lock.removedAt) throw new ConflictException('Personal lock has already been removed');
    if (lock.workforceUserId === user.id) {
      throw new ConflictException('Use the normal remove for your own lock');
    }

    const now = new Date();
    const [removed] = await this.db
      .update(lockboxCrewLocks)
      .set({
        removedAt: now,
        removedBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(lockboxCrewLocks.id, lockId))
      .returning();

    const [exception] = await this.db
      .insert(isolationAbsentLockRemovals)
      .values({
        tenantId,
        certificateId: lockbox.certificateId,
        lockboxId,
        crewLockId: lock.id,
        ownerUserId: lock.workforceUserId,
        ownerName: lock.workerName,
        personalLockNumber: lock.personalLockNumber,
        contactAttempts: dto.contactAttempts.trim(),
        clearOfPlantConfirmed: true,
        authoriserOneId: dto.authoriserOneId,
        authoriserTwoId: dto.authoriserTwoId,
        reason: dto.reason.trim(),
        removedAt: now,
        removedBy: user.id,
        ownerNotifiedAt: now,
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    await this.auditService.log({
      action: 'lototo.lockbox.absent_lock_removed',
      entityType: 'isolation_absent_lock_removal',
      entityId: exception.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: {
        lockboxId,
        lockId,
        ownerUserId: lock.workforceUserId,
        personalLockNumber: lock.personalLockNumber,
      },
    });

    try {
      await this.notifications?.enqueuePlanningNotification({
        planId: lockbox.certificateId,
        tenantId,
        action: 'absent_lock_removed',
        actorId: user.id,
        metadata: {
          recipientIds: [lock.workforceUserId],
          personalLockNumber: lock.personalLockNumber,
          certificateId: lockbox.certificateId,
        },
      });
    } catch {
      // Exception record stays even if the notice fails.
    }

    await this.certificates?.notifyReady(lockbox.certificateId, user.id);
    return { lock: removed, exception };
  }

  async getLockboxRoster(lockboxId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    await this.requireLockbox(lockboxId, tenantId);

    return this.db
      .select()
      .from(lockboxCrewLocks)
      .where(
        and(
          eq(lockboxCrewLocks.lockboxId, lockboxId),
          eq(lockboxCrewLocks.tenantId, tenantId),
        ),
      )
      .orderBy(desc(lockboxCrewLocks.appliedAt));
  }

  /** Hidden on a one-person device lock. Shown once a second person or a lockbox is on the isolation. */
  async describePersonalLocks(certificateId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const [certificate] = await this.db
      .select({ id: isolationCertificates.id, lockboxId: isolationCertificates.lockboxId })
      .from(isolationCertificates)
      .where(and(eq(isolationCertificates.id, certificateId), eq(isolationCertificates.tenantId, tenantId)));
    if (!certificate) {
      throw new NotFoundException('Energy Isolation Certificate not found');
    }

    const links = await this.db
      .select({ permitId: isolationCertificatePermits.permitId })
      .from(isolationCertificatePermits)
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, certificateId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
        ),
      );
    const permitIds = links.map((row) => row.permitId);
    const executors = permitIds.length
      ? await this.db
          .select({
            permitId: permitExecutors.permitId,
            workforceUserId: permitExecutors.workforceUserId,
          })
          .from(permitExecutors)
          .where(inArray(permitExecutors.permitId, permitIds))
      : [];
    const instances = permitIds.length
      ? await this.db
          .select({ id: permitLototoInstances.id, permitId: permitLototoInstances.permitId })
          .from(permitLototoInstances)
          .where(inArray(permitLototoInstances.permitId, permitIds))
      : [];
    const instancePermit = new Map(instances.map((row) => [row.id, row.permitId]));
    const crew = instances.length
      ? await this.db
          .select({
            instanceId: permitLototoCrew.instanceId,
            workforceUserId: permitLototoCrew.workforceUserId,
          })
          .from(permitLototoCrew)
          .where(inArray(permitLototoCrew.instanceId, instances.map((row) => row.id)))
      : [];

    const people = new Set<string>();
    const mine = new Set<string>();
    for (const row of executors) {
      people.add(row.workforceUserId);
      if (row.workforceUserId === user.id) mine.add(row.permitId);
    }
    for (const row of crew) {
      people.add(row.workforceUserId);
      const permitId = instancePermit.get(row.instanceId);
      if (row.workforceUserId === user.id && permitId) mine.add(permitId);
    }

    const myPermits = mine.size
      ? await this.db
          .select({ id: permits.id, reference: permits.reference, title: permits.title })
          .from(permits)
          .where(and(eq(permits.tenantId, tenantId), inArray(permits.id, [...mine])))
      : [];

    const boxes = await this.db
      .select()
      .from(isolationLockboxes)
      .where(and(eq(isolationLockboxes.certificateId, certificateId), eq(isolationLockboxes.tenantId, tenantId)))
      .orderBy(desc(isolationLockboxes.createdAt));
    const lockbox = boxes.find((row) => row.id === certificate.lockboxId) ?? boxes[0] ?? null;
    const locks = lockbox
      ? await this.db
          .select()
          .from(lockboxCrewLocks)
          .where(and(eq(lockboxCrewLocks.lockboxId, lockbox.id), eq(lockboxCrewLocks.tenantId, tenantId)))
          .orderBy(desc(lockboxCrewLocks.appliedAt))
      : [];

    return {
      personCount: people.size,
      attachedPermitCount: permitIds.length,
      myPermits,
      lockbox,
      locks,
    };
  }

  private async assertPermitOnCertificate(certificateId: string, permitId: string, tenantId: string) {
    const [link] = await this.db
      .select({ id: isolationCertificatePermits.id })
      .from(isolationCertificatePermits)
      .innerJoin(permits, eq(isolationCertificatePermits.permitId, permits.id))
      .where(
        and(
          eq(isolationCertificatePermits.certificateId, certificateId),
          eq(isolationCertificatePermits.permitId, permitId),
          eq(permits.tenantId, tenantId),
          ne(isolationCertificatePermits.attachmentStatus, 'detached'),
        ),
      );
    if (!link) {
      throw new ConflictException('That permit is not on this isolation');
    }
  }

  private async requireLockbox(lockboxId: string, tenantId: string) {
    const [lockbox] = await this.db
      .select()
      .from(isolationLockboxes)
      .where(
        and(
          eq(isolationLockboxes.id, lockboxId),
          eq(isolationLockboxes.tenantId, tenantId),
        ),
      );

    if (!lockbox) {
      throw new NotFoundException('Lockbox not found');
    }

    return lockbox;
  }
}
