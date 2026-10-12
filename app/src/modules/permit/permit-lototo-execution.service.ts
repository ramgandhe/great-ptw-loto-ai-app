import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  lototoProcedureLockoutPoints,
  lototoProcedureSequenceSteps,
  lototoProcedures,
  permitExecutors,
  permitLototoCrew,
  permitLototoCrewActions,
  permitLototoExtraPoints,
  permitLototoInstances,
  permitLototoPointVerifications,
  permitLototoRestorationVerifications,
  permitLototoRestorations,
  permitLototoSequenceTicks,
  permitLototoStepNa,
  permitLototoVerificationRuns,
  permitLototoVerifiers,
  tenantUsers,
} from '../../database/schema';
import {
  ConfirmLototoPhaseDto,
  RecordLototoCrewActionDto,
  RecordLototoPointVerificationDto,
  RecordLototoRestoreVerificationDto,
  RestartLototoVerificationDto,
  TickLototoSequenceStepDto,
} from './dto/permit-lototo-execution.dto';
import {
  canConfirmSequencePhase,
  isLototoCrewApplyComplete,
  isLototoSequencePhasePassed,
  lototoPointExecutionStatus,
  nextSequenceStepId,
} from './permit-lototo-execution-status';
import { PermitService } from './permit.service';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { UploadedFilePayload } from './uploaded-file.interface';
import { MAX_ATTACHMENT_SIZE_BYTES } from './permit.constants';

const EXECUTABLE_STATUSES = ['approved', 'active'] as const;

@Injectable()
export class PermitLototoExecutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  async getBoard(permitId: string, user: AuthenticatedUser) {
    const detail = await this.permitService.findOne(permitId, user);
    const instances = await this.db
      .select({
        instance: permitLototoInstances,
        procedureTitle: lototoProcedures.title,
        procedureCode: lototoProcedures.code,
      })
      .from(permitLototoInstances)
      .innerJoin(lototoProcedures, eq(permitLototoInstances.procedureId, lototoProcedures.id))
      .where(eq(permitLototoInstances.permitId, permitId));

    const boards = [];
    for (const row of instances) {
      boards.push(await this.loadInstanceBoard(row.instance, row.procedureTitle, row.procedureCode));
    }

    return {
      permitId,
      permitStatus: detail.permit.status,
      isolated: boards.length > 0 && boards.every((board) => isLototoSequencePhasePassed(board.applyRun)),
      restored: boards.length > 0 && boards.every((board) => isLototoSequencePhasePassed(board.removeRun)),
      instances: boards,
    };
  }

  async assertRestorationComplete(permitId: string, user: AuthenticatedUser): Promise<void> {
    const detail = await this.permitService.findOne(permitId, user);
    if (!detail.permit.lototoRequired) {
      return;
    }
    const board = await this.getBoard(permitId, user);
    if (!board.restored) {
      throw new ConflictException('Energy restoration must be verified before the permit can close');
    }
  }

  async assertIsolationReadyToStart(permitId: string, user: AuthenticatedUser): Promise<void> {
    const detail = await this.permitService.findOne(permitId, user);
    if (!detail.permit.lototoRequired) {
      return;
    }
    const board = await this.getBoard(permitId, user);
    if (!board.isolated) {
      throw new ConflictException('Work cannot start until isolation and try-out are verified');
    }
  }

  async startIsolation(permitId: string, instanceId: string, user: AuthenticatedUser) {
    const { detail, instance } = await this.prepareWrite(permitId, instanceId, user);
    await this.assertOperator(permitId, user);
    if (!instance.startedAt) {
      await this.db
        .update(permitLototoInstances)
        .set({ startedAt: new Date(), startedBy: user.id, updatedBy: user.id })
        .where(eq(permitLototoInstances.id, instance.id));
    }
    const crew = await this.db
      .select({ workforceUserId: permitLototoCrew.workforceUserId })
      .from(permitLototoCrew)
      .where(eq(permitLototoCrew.instanceId, instance.id));
    const recipients = [...new Set(crew.map((row) => row.workforceUserId).filter((id) => id !== user.id))];
    if (recipients.length > 0 && detail.permit.tenantId) {
      await this.notificationsService.generateSystem(detail.permit.tenantId, user.id, {
        eventType: 'lototo_verification',
        category: 'workflow',
        priority: 'high',
        title: 'LOTOTO isolation started',
        body: `Apply each isolation step on "${detail.permit.title}".`,
        recipientUserIds: recipients,
        entityType: 'permit',
        entityId: permitId,
        dedupeKey: `${detail.permit.tenantId}:permit:${permitId}:lototo:${instance.id}:started`,
        sourceModule: 'lototo',
      });
    }
    return this.getBoard(permitId, user);
  }

  async declareCrewComplete(permitId: string, instanceId: string, user: AuthenticatedUser) {
    const { instance } = await this.prepareWrite(permitId, instanceId, user);
    await this.assertCrew(instanceId, user);
    if (!instance.startedAt) {
      throw new ConflictException('Start LOTOTO before the crew can declare isolation complete');
    }
    const board = await this.getBoard(permitId, user);
    const row = board.instances.find((item) => item.instanceId === instanceId);
    if (!row || !isLototoCrewApplyComplete(row.points)) {
      throw new ConflictException('Tick every apply step before declaring isolation complete');
    }
    await this.db
      .update(permitLototoInstances)
      .set({ crewCompletedAt: new Date(), crewCompletedBy: user.id, updatedBy: user.id })
      .where(eq(permitLototoInstances.id, instance.id));
    return this.getBoard(permitId, user);
  }

  async recordCrewAction(permitId: string, instanceId: string, dto: RecordLototoCrewActionDto, user: AuthenticatedUser) {
    const { instance } = await this.prepareWrite(permitId, instanceId, user);
    await this.assertCrew(instanceId, user);
    if (!instance.startedAt) {
      throw new ConflictException('Start LOTOTO before applying isolation steps');
    }
    const point = await this.resolvePoint(instance, dto);
    if (point.na) {
      throw new ConflictException('N/A isolation points are not executed');
    }
    const status = await this.pointStatus(instanceId, point);
    if (status === 'passed') {
      throw new ConflictException('This isolation point already passed verification');
    }

    await this.db.insert(permitLototoCrewActions).values({
      instanceId,
      basePointId: point.basePointId,
      extraPointId: point.extraPointId,
      lockTagId: (dto.lockTagId ?? 'applied').trim() || 'applied',
      reading: dto.reading?.trim() || null,
      comment: dto.comment?.trim() || null,
      completedBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return this.getBoard(permitId, user);
  }

  async recordVerification(
    permitId: string,
    instanceId: string,
    dto: RecordLototoPointVerificationDto,
    user: AuthenticatedUser,
  ) {
    const { instance } = await this.prepareWrite(permitId, instanceId, user);
    await this.assertVerifier(instanceId, user);
    if (!instance.crewCompletedAt) {
      throw new ConflictException('Crew must declare isolation complete before verification');
    }
    if (!dto.tryOutCompleted) {
      throw new BadRequestException('Try-out is required to verify isolation');
    }
    const point = await this.resolvePoint(instance, dto);
    if (point.na) {
      throw new ConflictException('N/A isolation points are not verified');
    }
    const status = await this.pointStatus(instanceId, point);
    if (status === 'pending_crew' || status === 'failed') {
      throw new ConflictException('Crew must complete this isolation point before verification');
    }
    if (status === 'passed') {
      throw new ConflictException('This isolation point already passed verification');
    }

    await this.db.insert(permitLototoPointVerifications).values({
      instanceId,
      basePointId: point.basePointId,
      extraPointId: point.extraPointId,
      result: dto.result,
      tryOutCompleted: dto.tryOutCompleted,
      reading: dto.reading?.trim() || null,
      comment: dto.comment?.trim() || null,
      verifiedBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return this.getBoard(permitId, user);
  }

  async tickSequenceStep(
    permitId: string,
    instanceId: string,
    dto: TickLototoSequenceStepDto,
    user: AuthenticatedUser,
    file?: UploadedFilePayload,
  ) {
    const [frozen] = await this.db
      .select({ procedureVersionId: permitLototoInstances.procedureVersionId })
      .from(permitLototoInstances)
      .where(and(eq(permitLototoInstances.id, instanceId), eq(permitLototoInstances.permitId, permitId)));
    if (!frozen) {
      throw new NotFoundException('LOTOTO procedure is not attached to this permit');
    }
    const step = await this.requireSequenceStep(frozen.procedureVersionId, dto.sequenceStepId);
    const phase = step.phase as 'apply' | 'remove';
    const { instance } =
      phase === 'remove'
        ? await this.prepareRestoreWrite(permitId, instanceId, user)
        : await this.prepareWrite(permitId, instanceId, user);
    await this.assertVerifier(instanceId, user);
    const run = await this.requireOpenRun(instance.id, phase, user.id);
    const steps = await this.phaseSteps(instance.procedureVersionId, phase);
    const ticks = await this.db
      .select()
      .from(permitLototoSequenceTicks)
      .where(eq(permitLototoSequenceTicks.runId, run.id));
    const nextId = nextSequenceStepId(
      steps,
      ticks.map((row) => row.sequenceStepId),
    );
    if (nextId !== dto.sequenceStepId) {
      throw new ConflictException('Tick LOTOTO steps in order');
    }
    const photo = await this.storeOptionalPhoto(permitId, instance.id, user.tenantId, file);
    await this.db.insert(permitLototoSequenceTicks).values({
      runId: run.id,
      sequenceStepId: dto.sequenceStepId,
      note: dto.note?.trim() || null,
      photoFileName: photo?.fileName ?? null,
      photoContentType: photo?.contentType ?? null,
      photoStorageKey: photo?.storageKey ?? null,
      tickedBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });
    return this.getBoard(permitId, user);
  }

  async confirmPhase(
    permitId: string,
    instanceId: string,
    dto: ConfirmLototoPhaseDto,
    user: AuthenticatedUser,
    file?: UploadedFilePayload,
  ) {
    const write =
      dto.phase === 'remove'
        ? await this.prepareRestoreWrite(permitId, instanceId, user)
        : await this.prepareWrite(permitId, instanceId, user);
    await this.assertVerifier(instanceId, user);
    const run = await this.requireOpenRun(write.instance.id, dto.phase, user.id);
    const steps = await this.phaseSteps(write.instance.procedureVersionId, dto.phase);
    const ticks = await this.db
      .select()
      .from(permitLototoSequenceTicks)
      .where(eq(permitLototoSequenceTicks.runId, run.id));
    if (!canConfirmSequencePhase(steps, ticks.map((row) => row.sequenceStepId))) {
      throw new ConflictException('Tick every sequence step before the final confirm');
    }
    if (dto.result === 'pass' && !dto.tryOutCompleted) {
      throw new BadRequestException('Try-out is required to pass LOTOTO verification');
    }
    const signedName = dto.signedName.trim();
    if (!signedName) {
      throw new BadRequestException('A typed name is required to complete LOTOTO verification');
    }
    const photo = await this.storeOptionalPhoto(permitId, write.instance.id, user.tenantId, file);
    await this.db
      .update(permitLototoVerificationRuns)
      .set({
        status: dto.result === 'pass' ? 'passed' : 'failed',
        result: dto.result,
        tryOutCompleted: dto.tryOutCompleted,
        lockTagId: dto.lockTagId?.trim() || null,
        reading: dto.reading?.trim() || null,
        note: dto.note?.trim() || null,
        signedName,
        photoFileName: photo?.fileName ?? null,
        photoContentType: photo?.contentType ?? null,
        photoStorageKey: photo?.storageKey ?? null,
        verifiedBy: user.id,
        verifiedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(permitLototoVerificationRuns.id, run.id));
    return this.getBoard(permitId, user);
  }

  async restartVerification(
    permitId: string,
    instanceId: string,
    dto: RestartLototoVerificationDto,
    user: AuthenticatedUser,
  ) {
    const write =
      dto.phase === 'remove'
        ? await this.prepareRestoreWrite(permitId, instanceId, user)
        : await this.prepareWrite(permitId, instanceId, user);
    await this.assertVerifier(instanceId, user);
    const latest = await this.latestRun(write.instance.id, dto.phase);
    if (latest?.result !== 'fail') {
      throw new ConflictException('Restart LOTOTO verification only after a failed confirm');
    }
    await this.db.insert(permitLototoVerificationRuns).values({
      instanceId: write.instance.id,
      phase: dto.phase,
      runNumber: latest.runNumber + 1,
      status: 'in_progress',
      createdBy: user.id,
      updatedBy: user.id,
    });
    return this.getBoard(permitId, user);
  }

  async recordRestoration(
    permitId: string,
    instanceId: string,
    dto: RecordLototoCrewActionDto,
    user: AuthenticatedUser,
  ) {
    const { instance } = await this.prepareRestoreWrite(permitId, instanceId, user);
    await this.assertCrew(instanceId, user);
    const point = await this.resolvePoint(instance, dto);
    if (point.na) {
      throw new ConflictException('N/A isolation points are not restored');
    }
    const status = await this.restorePointStatus(instanceId, point);
    if (status === 'passed') {
      throw new ConflictException('This isolation point is already restored');
    }
    await this.db.insert(permitLototoRestorations).values({
      instanceId,
      basePointId: point.basePointId,
      extraPointId: point.extraPointId,
      lockTagId: (dto.lockTagId ?? 'removed').trim() || 'removed',
      comment: dto.comment?.trim() || null,
      restoredBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });
    return this.getBoard(permitId, user);
  }

  async recordRestorationVerification(
    permitId: string,
    instanceId: string,
    dto: RecordLototoRestoreVerificationDto,
    user: AuthenticatedUser,
  ) {
    const { instance } = await this.prepareRestoreWrite(permitId, instanceId, user);
    await this.assertVerifier(instanceId, user);
    const point = await this.resolvePoint(instance, dto);
    if (point.na) {
      throw new ConflictException('N/A isolation points are not restored');
    }
    const status = await this.restorePointStatus(instanceId, point);
    if (status === 'pending_crew' || status === 'failed') {
      throw new ConflictException('Crew must restore this isolation point before verification');
    }
    if (status === 'passed') {
      throw new ConflictException('This isolation point is already restored');
    }
    await this.db.insert(permitLototoRestorationVerifications).values({
      instanceId,
      basePointId: point.basePointId,
      extraPointId: point.extraPointId,
      result: dto.result,
      comment: dto.comment?.trim() || null,
      verifiedBy: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });
    return this.getBoard(permitId, user);
  }

  private async prepareRestoreWrite(permitId: string, instanceId: string, user: AuthenticatedUser) {
    const detail = await this.permitService.findOne(permitId, user);
    if (detail.permit.status !== 'execution_completed' && detail.permit.status !== 'pending_closure') {
      throw new ConflictException('Restoration starts after work is complete');
    }
    const [instance] = await this.db
      .select()
      .from(permitLototoInstances)
      .where(and(eq(permitLototoInstances.id, instanceId), eq(permitLototoInstances.permitId, permitId)));
    if (!instance) {
      throw new NotFoundException('LOTOTO procedure is not attached to this permit');
    }
    if (!instance.frozenAt) {
      throw new ConflictException('LOTOTO must be frozen at approval before isolation');
    }
    return { detail, instance };
  }

  private async prepareWrite(permitId: string, instanceId: string, user: AuthenticatedUser) {
    const detail = await this.permitService.findOne(permitId, user);
    if (!(EXECUTABLE_STATUSES as readonly string[]).includes(detail.permit.status)) {
      throw new ConflictException('Isolation can start after the permit is approved');
    }
    const [instance] = await this.db
      .select()
      .from(permitLototoInstances)
      .where(and(eq(permitLototoInstances.id, instanceId), eq(permitLototoInstances.permitId, permitId)));
    if (!instance) {
      throw new NotFoundException('LOTOTO procedure is not attached to this permit');
    }
    if (!instance.frozenAt) {
      throw new ConflictException('LOTOTO must be frozen at approval before isolation');
    }
    return { detail, instance };
  }

  private isPrivileged(user: AuthenticatedUser) {
    return user.roles.includes('platform-admin') || isTenantPrivileged(user.roles);
  }

  private async assertOperator(permitId: string, user: AuthenticatedUser) {
    if (this.isPrivileged(user)) {
      return;
    }
    const [row] = await this.db
      .select({ id: permitExecutors.id })
      .from(permitExecutors)
      .where(and(eq(permitExecutors.permitId, permitId), eq(permitExecutors.workforceUserId, user.id)));
    if (!row) {
      throw new ForbiddenException('Only the permit operator can start LOTOTO');
    }
  }

  private async assertCrew(instanceId: string, user: AuthenticatedUser) {
    if (this.isPrivileged(user)) {
      return;
    }
    const [row] = await this.db
      .select({ id: permitLototoCrew.id })
      .from(permitLototoCrew)
      .where(and(eq(permitLototoCrew.instanceId, instanceId), eq(permitLototoCrew.workforceUserId, user.id)));
    if (!row) {
      throw new ForbiddenException('Only assigned isolation crew can complete this point');
    }
  }

  private async assertVerifier(instanceId: string, user: AuthenticatedUser) {
    if (this.isPrivileged(user)) {
      return;
    }
    const [row] = await this.db
      .select({ id: permitLototoVerifiers.id })
      .from(permitLototoVerifiers)
      .where(
        and(eq(permitLototoVerifiers.instanceId, instanceId), eq(permitLototoVerifiers.workforceUserId, user.id)),
      );
    if (!row) {
      throw new ForbiddenException('Only assigned verifiers can confirm this point');
    }
  }

  private async resolvePoint(
    instance: typeof permitLototoInstances.$inferSelect,
    dto: { basePointId?: string; extraPointId?: string },
  ) {
    const hasBase = Boolean(dto.basePointId);
    const hasExtra = Boolean(dto.extraPointId);
    if (hasBase === hasExtra) {
      throw new BadRequestException('Each action must target a base point or an extra point');
    }

    const naRows = await this.db
      .select()
      .from(permitLototoStepNa)
      .where(eq(permitLototoStepNa.instanceId, instance.id));

    if (dto.basePointId) {
      const [point] = await this.db
        .select()
        .from(lototoProcedureLockoutPoints)
        .where(
          and(
            eq(lototoProcedureLockoutPoints.id, dto.basePointId),
            eq(lototoProcedureLockoutPoints.versionId, instance.procedureVersionId),
          ),
        );
      if (!point) {
        throw new BadRequestException('Isolation point is not on the attached procedure version');
      }
      return {
        basePointId: point.id,
        extraPointId: null as string | null,
        na: naRows.some((row) => row.basePointId === point.id),
      };
    }

    const [extra] = await this.db
      .select()
      .from(permitLototoExtraPoints)
      .where(
        and(eq(permitLototoExtraPoints.id, dto.extraPointId!), eq(permitLototoExtraPoints.instanceId, instance.id)),
      );
    if (!extra) {
      throw new BadRequestException('Extra isolation point is not on this permit');
    }
    return {
      basePointId: null as string | null,
      extraPointId: extra.id,
      na: naRows.some((row) => row.extraPointId === extra.id),
    };
  }

  private async pointStatus(
    instanceId: string,
    point: { basePointId: string | null; extraPointId: string | null; na: boolean },
  ) {
    const crew = await this.latestCrew(instanceId, point);
    const verify = await this.latestVerify(instanceId, point);
    return lototoPointExecutionStatus({
      na: point.na,
      crewAt: crew?.completedAt ?? null,
      verifyAt: verify?.verifiedAt ?? null,
      verifyResult: (verify?.result as 'pass' | 'fail' | undefined) ?? null,
    });
  }

  private async restorePointStatus(
    instanceId: string,
    point: { basePointId: string | null; extraPointId: string | null; na: boolean },
  ) {
    const rows = await this.db
      .select()
      .from(permitLototoRestorations)
      .where(eq(permitLototoRestorations.instanceId, instanceId))
      .orderBy(desc(permitLototoRestorations.restoredAt));
    const restore = rows.find((row) => this.samePoint(row, point)) ?? null;
    const verifyRows = await this.db
      .select()
      .from(permitLototoRestorationVerifications)
      .where(eq(permitLototoRestorationVerifications.instanceId, instanceId))
      .orderBy(desc(permitLototoRestorationVerifications.verifiedAt));
    const verify = verifyRows.find((row) => this.samePoint(row, point)) ?? null;
    return lototoPointExecutionStatus({
      na: point.na,
      crewAt: restore?.restoredAt ?? null,
      verifyAt: verify?.verifiedAt ?? null,
      verifyResult: (verify?.result as 'pass' | 'fail' | undefined) ?? null,
    });
  }

  private async latestCrew(
    instanceId: string,
    point: { basePointId: string | null; extraPointId: string | null },
  ) {
    const rows = await this.db
      .select()
      .from(permitLototoCrewActions)
      .where(eq(permitLototoCrewActions.instanceId, instanceId))
      .orderBy(desc(permitLototoCrewActions.completedAt));
    return rows.find((row) => this.samePoint(row, point)) ?? null;
  }

  private async latestVerify(
    instanceId: string,
    point: { basePointId: string | null; extraPointId: string | null },
  ) {
    const rows = await this.db
      .select()
      .from(permitLototoPointVerifications)
      .where(eq(permitLototoPointVerifications.instanceId, instanceId))
      .orderBy(desc(permitLototoPointVerifications.verifiedAt));
    return rows.find((row) => this.samePoint(row, point)) ?? null;
  }

  private samePoint(
    row: { basePointId: string | null; extraPointId: string | null },
    point: { basePointId: string | null; extraPointId: string | null },
  ) {
    return row.basePointId === point.basePointId && row.extraPointId === point.extraPointId;
  }

  private async loadInstanceBoard(
    instance: typeof permitLototoInstances.$inferSelect,
    procedureTitle: string,
    procedureCode: string,
  ) {
    const [basePoints, extras, naRows, crewRows, verifyRows, restoreRows, restoreVerifyRows] =
      await Promise.all([
      this.db
        .select()
        .from(lototoProcedureLockoutPoints)
        .where(eq(lototoProcedureLockoutPoints.versionId, instance.procedureVersionId)),
      this.db
        .select()
        .from(permitLototoExtraPoints)
        .where(eq(permitLototoExtraPoints.instanceId, instance.id)),
      this.db.select().from(permitLototoStepNa).where(eq(permitLototoStepNa.instanceId, instance.id)),
      this.db
        .select()
        .from(permitLototoCrewActions)
        .where(eq(permitLototoCrewActions.instanceId, instance.id))
        .orderBy(desc(permitLototoCrewActions.completedAt)),
      this.db
        .select()
        .from(permitLototoPointVerifications)
        .where(eq(permitLototoPointVerifications.instanceId, instance.id))
        .orderBy(desc(permitLototoPointVerifications.verifiedAt)),
      this.db
        .select()
        .from(permitLototoRestorations)
        .where(eq(permitLototoRestorations.instanceId, instance.id))
        .orderBy(desc(permitLototoRestorations.restoredAt)),
      this.db
        .select()
        .from(permitLototoRestorationVerifications)
        .where(eq(permitLototoRestorationVerifications.instanceId, instance.id))
        .orderBy(desc(permitLototoRestorationVerifications.verifiedAt)),
    ]);

    const points = [
      ...basePoints
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((point) =>
          this.serializePoint({
            basePointId: point.id,
            extraPointId: null,
            pointCode: point.pointCode,
            energyType: point.energyType,
            action: point.action,
            locationText: point.locationText,
            na: naRows.some((row) => row.basePointId === point.id),
            naReason: naRows.find((row) => row.basePointId === point.id)?.reason ?? null,
            crewRows,
            verifyRows,
            restoreRows,
            restoreVerifyRows,
          }),
        ),
      ...extras
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((point) =>
          this.serializePoint({
            basePointId: null,
            extraPointId: point.id,
            pointCode: point.pointCode,
            energyType: point.energyType,
            action: point.action,
            locationText: point.locationText,
            na: naRows.some((row) => row.extraPointId === point.id),
            naReason: naRows.find((row) => row.extraPointId === point.id)?.reason ?? null,
            crewRows,
            verifyRows,
            restoreRows,
            restoreVerifyRows,
          }),
        ),
    ];

    const [sequenceSteps, crewAssign, applyRun, removeRun] = await Promise.all([
      this.db
        .select()
        .from(lototoProcedureSequenceSteps)
        .where(eq(lototoProcedureSequenceSteps.versionId, instance.procedureVersionId)),
      this.db
        .select({ workforceUserId: permitLototoCrew.workforceUserId })
        .from(permitLototoCrew)
        .where(eq(permitLototoCrew.instanceId, instance.id)),
      this.latestRun(instance.id, 'apply'),
      this.latestRun(instance.id, 'remove'),
    ]);
    const crewIds = [...new Set(crewAssign.map((row) => String(row.workforceUserId)))];
    const crewUsers =
      crewIds.length === 0
        ? []
        : await this.db
            .select({
              keycloakUserId: tenantUsers.keycloakUserId,
              firstName: tenantUsers.firstName,
              lastName: tenantUsers.lastName,
              email: tenantUsers.email,
            })
            .from(tenantUsers)
            .where(inArray(tenantUsers.keycloakUserId, crewIds));
    const crewById = new Map(crewUsers.map((row) => [row.keycloakUserId, row]));

    const applyTicks = applyRun
      ? await this.db
          .select()
          .from(permitLototoSequenceTicks)
          .where(eq(permitLototoSequenceTicks.runId, applyRun.id))
      : [];
    const removeTicks = removeRun
      ? await this.db
          .select()
          .from(permitLototoSequenceTicks)
          .where(eq(permitLototoSequenceTicks.runId, removeRun.id))
      : [];

    const applySteps = sequenceSteps
      .filter((step) => step.phase === 'apply')
      .slice()
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const removeSteps = sequenceSteps
      .filter((step) => step.phase === 'remove')
      .slice()
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    return {
      instanceId: instance.id,
      procedureId: instance.procedureId,
      procedureVersionId: instance.procedureVersionId,
      procedureCode,
      procedureTitle,
      frozenAt: instance.frozenAt,
      startedAt: instance.startedAt,
      crewCompletedAt: instance.crewCompletedAt,
      crew: crewAssign.map((row) => {
        const person = crewById.get(String(row.workforceUserId));
        const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
        return {
          workforceUserId: row.workforceUserId,
          name: name || person?.email || row.workforceUserId,
        };
      }),
      applySteps,
      removeSteps,
      applyRun: this.serializeRun(applyRun, applyTicks, applySteps),
      removeRun: this.serializeRun(removeRun, removeTicks, removeSteps),
      points,
    };
  }

  private serializeRun(
    run: typeof permitLototoVerificationRuns.$inferSelect | null,
    ticks: (typeof permitLototoSequenceTicks.$inferSelect)[],
    steps: Array<{ id: string; sequenceOrder: number }>,
  ) {
    if (!run) {
      return null;
    }
    const tickedIds = ticks.map((row) => row.sequenceStepId);
    return {
      id: run.id,
      runNumber: run.runNumber,
      status: run.status,
      result: run.result,
      tryOutCompleted: run.tryOutCompleted,
      lockTagId: run.lockTagId,
      reading: run.reading,
      note: run.note,
      signedName: run.signedName,
      verifiedAt: run.verifiedAt,
      photoFileName: run.photoFileName,
      ticks: ticks.map((row) => ({
        sequenceStepId: row.sequenceStepId,
        note: row.note,
        photoFileName: row.photoFileName,
        tickedAt: row.tickedAt,
      })),
      nextStepId: run.status === 'in_progress' ? nextSequenceStepId(steps, tickedIds) : null,
      canConfirm: run.status === 'in_progress' && canConfirmSequencePhase(steps, tickedIds),
    };
  }

  private async requireSequenceStep(versionId: string, stepId: string) {
    const [step] = await this.db
      .select()
      .from(lototoProcedureSequenceSteps)
      .where(and(eq(lototoProcedureSequenceSteps.id, stepId), eq(lototoProcedureSequenceSteps.versionId, versionId)));
    if (!step) {
      throw new BadRequestException('Sequence step is not on this procedure');
    }
    return step;
  }

  private async phaseSteps(versionId: string, phase: 'apply' | 'remove') {
    const steps = await this.db
      .select()
      .from(lototoProcedureSequenceSteps)
      .where(
        and(eq(lototoProcedureSequenceSteps.versionId, versionId), eq(lototoProcedureSequenceSteps.phase, phase)),
      );
    return steps.slice().sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }

  private async latestRun(instanceId: string, phase: 'apply' | 'remove') {
    const [run] = await this.db
      .select()
      .from(permitLototoVerificationRuns)
      .where(
        and(eq(permitLototoVerificationRuns.instanceId, instanceId), eq(permitLototoVerificationRuns.phase, phase)),
      )
      .orderBy(desc(permitLototoVerificationRuns.runNumber))
      .limit(1);
    return run ?? null;
  }

  private async requireOpenRun(instanceId: string, phase: 'apply' | 'remove', userId: string) {
    const latest = await this.latestRun(instanceId, phase);
    if (latest?.status === 'in_progress') {
      return latest;
    }
    if (latest?.result === 'pass') {
      throw new ConflictException('LOTOTO verification already passed');
    }
    if (latest?.result === 'fail') {
      throw new ConflictException('Restart LOTOTO verification after a failed confirm');
    }
    const [created] = await this.db
      .insert(permitLototoVerificationRuns)
      .values({
        instanceId,
        phase,
        runNumber: 1,
        status: 'in_progress',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    return created;
  }

  private async storeOptionalPhoto(
    permitId: string,
    instanceId: string,
    tenantId: string | null | undefined,
    file?: UploadedFilePayload,
  ) {
    if (!file) {
      return null;
    }
    if (!tenantId) {
      throw new BadRequestException('Tenant context is required');
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes`);
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'] as const;
    if (!allowed.includes(file.mimetype as (typeof allowed)[number])) {
      throw new BadRequestException('LOTOTO photos must be JPEG, PNG or WebP');
    }
    const storageKey = `${tenantId}/${permitId}/lototo/${instanceId}/${randomUUID()}-${file.originalname}`;
    await this.storageService.putObject(storageKey, file.buffer, file.mimetype, file.size);
    return {
      fileName: file.originalname,
      contentType: file.mimetype,
      storageKey,
    };
  }

  private serializePoint(input: {
    basePointId: string | null;
    extraPointId: string | null;
    pointCode: string;
    energyType: string;
    action: string | null;
    locationText: string | null;
    na: boolean;
    naReason: string | null;
    crewRows: (typeof permitLototoCrewActions.$inferSelect)[];
    verifyRows: (typeof permitLototoPointVerifications.$inferSelect)[];
    restoreRows: (typeof permitLototoRestorations.$inferSelect)[];
    restoreVerifyRows: (typeof permitLototoRestorationVerifications.$inferSelect)[];
  }) {
    const crewLatest =
      input.crewRows.find(
        (row) => row.basePointId === input.basePointId && row.extraPointId === input.extraPointId,
      ) ?? null;
    const verificationLatest =
      input.verifyRows.find(
        (row) => row.basePointId === input.basePointId && row.extraPointId === input.extraPointId,
      ) ?? null;
    const status = lototoPointExecutionStatus({
      na: input.na,
      crewAt: crewLatest?.completedAt ?? null,
      verifyAt: verificationLatest?.verifiedAt ?? null,
      verifyResult: (verificationLatest?.result as 'pass' | 'fail' | undefined) ?? null,
    });
    const restoreLatest =
      input.restoreRows.find(
        (row) => row.basePointId === input.basePointId && row.extraPointId === input.extraPointId,
      ) ?? null;
    const restoreVerificationLatest =
      input.restoreVerifyRows.find(
        (row) => row.basePointId === input.basePointId && row.extraPointId === input.extraPointId,
      ) ?? null;
    const restoreStatus = lototoPointExecutionStatus({
      na: input.na,
      crewAt: restoreLatest?.restoredAt ?? null,
      verifyAt: restoreVerificationLatest?.verifiedAt ?? null,
      verifyResult: (restoreVerificationLatest?.result as 'pass' | 'fail' | undefined) ?? null,
    });
    return {
      basePointId: input.basePointId,
      extraPointId: input.extraPointId,
      pointCode: input.pointCode,
      energyType: input.energyType,
      action: input.action,
      locationText: input.locationText,
      na: input.na,
      naReason: input.naReason,
      status,
      crewLatest,
      verificationLatest,
      restoreStatus,
      restoreLatest,
      restoreVerificationLatest,
    };
  }
}
