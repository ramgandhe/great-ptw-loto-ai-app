import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  lototoProcedureLockoutPoints,
  lototoProcedures,
  permitLototoCrew,
  permitLototoCrewActions,
  permitLototoExtraPoints,
  permitLototoInstances,
  permitLototoPointVerifications,
  permitLototoRestorationVerifications,
  permitLototoRestorations,
  permitLototoStepNa,
  permitLototoVerifiers,
} from '../../database/schema';
import {
  RecordLototoCrewActionDto,
  RecordLototoPointVerificationDto,
  RecordLototoRestoreVerificationDto,
} from './dto/permit-lototo-execution.dto';
import {
  isLototoIsolationComplete,
  isLototoRestorationComplete,
  lototoPointExecutionStatus,
} from './permit-lototo-execution-status';
import { PermitService } from './permit.service';

const EXECUTABLE_STATUSES = ['approved', 'active'] as const;

@Injectable()
export class PermitLototoExecutionService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
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

    const points = boards.flatMap((board) => board.points);
    return {
      permitId,
      permitStatus: detail.permit.status,
      isolated: isLototoIsolationComplete(points),
      restored: isLototoRestorationComplete(points),
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

  async recordCrewAction(permitId: string, instanceId: string, dto: RecordLototoCrewActionDto, user: AuthenticatedUser) {
    const { instance } = await this.prepareWrite(permitId, instanceId, user);
    await this.assertCrew(instanceId, user.id);
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
      lockTagId: dto.lockTagId.trim(),
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
    await this.assertVerifier(instanceId, user.id);
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

  async recordRestoration(
    permitId: string,
    instanceId: string,
    dto: RecordLototoCrewActionDto,
    user: AuthenticatedUser,
  ) {
    const { instance } = await this.prepareRestoreWrite(permitId, instanceId, user);
    await this.assertCrew(instanceId, user.id);
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
      lockTagId: dto.lockTagId.trim(),
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
    await this.assertVerifier(instanceId, user.id);
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

  private async assertCrew(instanceId: string, userId: string) {
    const [row] = await this.db
      .select({ id: permitLototoCrew.id })
      .from(permitLototoCrew)
      .where(and(eq(permitLototoCrew.instanceId, instanceId), eq(permitLototoCrew.workforceUserId, userId)));
    if (!row) {
      throw new ForbiddenException('Only assigned isolation crew can complete this point');
    }
  }

  private async assertVerifier(instanceId: string, userId: string) {
    const [row] = await this.db
      .select({ id: permitLototoVerifiers.id })
      .from(permitLototoVerifiers)
      .where(
        and(eq(permitLototoVerifiers.instanceId, instanceId), eq(permitLototoVerifiers.workforceUserId, userId)),
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

    return {
      instanceId: instance.id,
      procedureId: instance.procedureId,
      procedureVersionId: instance.procedureVersionId,
      procedureCode,
      procedureTitle,
      frozenAt: instance.frozenAt,
      points,
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
