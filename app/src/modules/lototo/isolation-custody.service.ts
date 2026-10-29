import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { optionalUuid } from '../../common/helpers/optional-uuid';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  isolationCertificatePoints,
  isolationCertificates,
  isolationLtiWalks,
  isolationSanctionTests,
  isolationShiftHandovers,
} from '../../database/schema';
import { AuditService } from '../logging/audit.service';
import {
  AcceptHandoverDto,
  FinishIsolationTestDto,
  MarkLongTermDto,
  RecordWalkDto,
  StartIsolationTestDto,
} from './dto/isolation-custody.dto';
import { IsolationCertificateService } from './isolation-certificate.service';
import { LototoValidationService } from './lototo-validation.service';

@Injectable()
export class IsolationCustodyService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
    private readonly auditService: AuditService,
    @Optional() private readonly certificates?: IsolationCertificateService,
  ) {}

  async getCustody(certificateId: string, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    const [tests, handovers, walks] = await Promise.all([
      this.db
        .select()
        .from(isolationSanctionTests)
        .where(eq(isolationSanctionTests.certificateId, certificateId))
        .orderBy(desc(isolationSanctionTests.startedAt)),
      this.db
        .select()
        .from(isolationShiftHandovers)
        .where(eq(isolationShiftHandovers.certificateId, certificateId))
        .orderBy(desc(isolationShiftHandovers.handedOverAt)),
      this.db
        .select()
        .from(isolationLtiWalks)
        .where(eq(isolationLtiWalks.certificateId, certificateId))
        .orderBy(desc(isolationLtiWalks.walkedAt)),
    ]);
    return {
      authorityId: certificate.isolationAuthorityId ?? certificate.createdBy,
      status: certificate.status,
      isLongTerm: certificate.isLongTerm,
      ltiReason: certificate.ltiReason,
      ltiAuditIntervalDays: certificate.ltiAuditIntervalDays,
      nextAuditDueDate: certificate.nextAuditDueDate,
      lastAuditedAt: certificate.lastAuditedAt,
      tests,
      handovers,
      walks,
    };
  }

  /** A test is a child record. The certificate stays Isolated. */
  async startTest(certificateId: string, dto: StartIsolationTestDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (certificate.status !== 'isolated_verified' && certificate.status !== 'sanction_for_test') {
      throw new ConflictException('A test starts after the isolation is Isolated');
    }
    const open = await this.db
      .select({ id: isolationSanctionTests.id })
      .from(isolationSanctionTests)
      .where(and(eq(isolationSanctionTests.certificateId, certificateId), eq(isolationSanctionTests.status, 'in_test')));
    if (open.length > 0) {
      throw new ConflictException('A test is already open');
    }
    const points = await this.db
      .select({ id: isolationCertificatePoints.id })
      .from(isolationCertificatePoints)
      .where(
        and(
          eq(isolationCertificatePoints.certificateId, certificateId),
          inArray(isolationCertificatePoints.id, dto.pointIds),
        ),
      );
    if (points.length !== dto.pointIds.length) {
      throw new BadRequestException('Each opened point must belong to this isolation');
    }

    const [test] = await this.db
      .insert(isolationSanctionTests)
      .values({
        tenantId,
        certificateId,
        testReason: dto.testReason.trim(),
        status: 'in_test',
        authorizedBy: user.id,
        pointsTemporarilyDeisolated: dto.pointIds,
        preTestSafetyChecklist: { areaClear: true },
        createdBy: optionalUuid(user.id),
        updatedBy: optionalUuid(user.id),
      })
      .returning();

    await this.auditService.log({
      action: 'lototo.certificate.test_started',
      entityType: 'isolation_sanction_test',
      entityId: test.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { certificateId, pointIds: dto.pointIds },
    });
    return test;
  }

  async finishTest(certificateId: string, testId: string, dto: FinishIsolationTestDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    await this.requireCertificate(certificateId, tenantId);
    if (!dto.zeroEnergyProved) {
      throw new ConflictException('Zero energy has to be proved again before the test can finish');
    }
    const [test] = await this.db
      .select()
      .from(isolationSanctionTests)
      .where(and(eq(isolationSanctionTests.id, testId), eq(isolationSanctionTests.certificateId, certificateId)));
    if (!test) throw new NotFoundException('Test not found');
    if (test.status !== 'in_test') throw new ConflictException('This test is already finished');

    const now = new Date();
    const [updated] = await this.db
      .update(isolationSanctionTests)
      .set({
        status: 'completed',
        completedAt: now,
        postTestZeroEnergyVerified: true,
        postTestVerifierId: optionalUuid(user.id),
        postTestVerifiedAt: now,
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationSanctionTests.id, testId))
      .returning();

    await this.auditService.log({
      action: 'lototo.certificate.test_finished',
      entityType: 'isolation_sanction_test',
      entityId: testId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { certificateId },
    });
    await this.certificates?.notifyReady(certificateId, user.id);
    return updated;
  }

  async acceptHandover(certificateId: string, dto: AcceptHandoverDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (!dto.jointInspectionCompleted) {
      throw new BadRequestException('The joint inspection starts unticked and has to be completed');
    }
    const outgoingAuthorityId = certificate.isolationAuthorityId ?? certificate.createdBy;
    if (outgoingAuthorityId === user.id) {
      throw new ConflictException('Someone else accepts this isolation');
    }
    if (certificate.status === 'closed' || certificate.status === 'draft') {
      throw new ConflictException('This isolation cannot be handed over');
    }

    const now = new Date();
    const handover = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(isolationShiftHandovers)
        .values({
          tenantId,
          certificateId,
          outgoingAuthorityId,
          incomingAuthorityId: user.id,
          jointInspectionCompleted: true,
          integrityNotes: dto.integrityNotes?.trim() || null,
          activePermitsReviewed: dto.activePermitsReviewed ?? false,
          handedOverAt: now,
          createdBy: optionalUuid(user.id),
          updatedBy: optionalUuid(user.id),
        })
        .returning();
      await tx
        .update(isolationCertificates)
        .set({
          isolationAuthorityId: user.id,
          updatedBy: optionalUuid(user.id),
          updatedAt: now,
        })
        .where(eq(isolationCertificates.id, certificateId));
      return row;
    });

    await this.auditService.log({
      action: 'lototo.certificate.handover',
      entityType: 'isolation_shift_handover',
      entityId: handover.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { certificateId, outgoingAuthorityId },
    });
    return handover;
  }

  async markLongTerm(certificateId: string, dto: MarkLongTermDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (dto.isLongTerm && !dto.ltiReason?.trim()) {
      throw new BadRequestException('A long-term isolation needs a reason');
    }
    const interval = dto.ltiAuditIntervalDays ?? certificate.ltiAuditIntervalDays ?? 30;
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + interval);
    const [updated] = await this.db
      .update(isolationCertificates)
      .set({
        isLongTerm: dto.isLongTerm,
        ltiReason: dto.isLongTerm ? dto.ltiReason!.trim() : null,
        ltiAuditIntervalDays: interval,
        nextAuditDueDate: dto.isLongTerm ? (certificate.nextAuditDueDate ?? next) : null,
        updatedBy: optionalUuid(user.id),
        updatedAt: now,
      })
      .where(eq(isolationCertificates.id, certificateId))
      .returning({ status: isolationCertificates.status, isLongTerm: isolationCertificates.isLongTerm });

    await this.auditService.log({
      action: 'lototo.certificate.long_term',
      entityType: 'isolation_certificate',
      entityId: certificateId,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { isLongTerm: dto.isLongTerm, intervalDays: interval },
    });
    return updated;
  }

  async recordWalk(certificateId: string, dto: RecordWalkDto, user: AuthenticatedUser) {
    const tenantId = this.validationService.requireTenant(user);
    const certificate = await this.requireCertificate(certificateId, tenantId);
    if (!certificate.isLongTerm) {
      throw new ConflictException('Record a walk on a long-term isolation');
    }
    const now = new Date();
    const interval = certificate.ltiAuditIntervalDays ?? 30;
    const next = new Date(now);
    next.setDate(next.getDate() + interval);
    const walk = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(isolationLtiWalks)
        .values({
          tenantId,
          certificateId,
          walkedAt: now,
          walkedBy: user.id,
          notes: dto.notes?.trim() || null,
          createdBy: optionalUuid(user.id),
          updatedBy: optionalUuid(user.id),
        })
        .returning();
      await tx
        .update(isolationCertificates)
        .set({
          lastAuditedAt: now,
          nextAuditDueDate: next,
          updatedBy: optionalUuid(user.id),
          updatedAt: now,
        })
        .where(eq(isolationCertificates.id, certificateId));
      return row;
    });

    await this.auditService.log({
      action: 'lototo.certificate.walk',
      entityType: 'isolation_lti_walk',
      entityId: walk.id,
      userId: optionalUuid(user.id),
      tenantId,
      metadata: { certificateId },
    });
    return walk;
  }

  private async requireCertificate(id: string, tenantId: string) {
    const [certificate] = await this.db
      .select()
      .from(isolationCertificates)
      .where(and(eq(isolationCertificates.id, id), eq(isolationCertificates.tenantId, tenantId)))
      .orderBy(asc(isolationCertificates.createdAt));
    if (!certificate) throw new NotFoundException('Energy Isolation Certificate not found');
    return certificate;
  }
}
