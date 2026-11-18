import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AuditService } from '../logging/audit.service';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  approvalHistory,
  conflictParticipants,
  employees,
  hazardCategories,
  mdpEvidence,
  organisations,
  permitClosures,
  permitDailyProgress,
  permitDaySecures,
  permitEvidence,
  permitExecution,
  permitRevalidations,
  permits,
  permitStatusHistory,
  permitTypes,
  permitVerifications,
  ppeCatalogue,
  shiftHandovers,
  simopsCaseControls,
  simopsCasePermits,
  simopsCases,
  simopsConflicts,
  sites,
  tenantUsers,
  workLocations,
} from '../../database/schema';
import { assemblePermitReport, type PermitReportSnapshot } from './permit-report.assemble';
import type { PermitReport, PermitReportPerson } from './permit-report.model';
import { DAILY_PROGRESS_EVIDENCE_PREFIX } from '../daily-progress/daily-progress.constants';
import { canEmbedPermitReportImage, mdpEvidenceReportName, permitReportFileOwned, PERMIT_REPORT_IMAGE_MAX_BYTES, PERMIT_REPORT_IMAGE_MAX_COUNT } from './permit-report-files';
import { permitReportFileName, renderPermitReportPdf } from './permit-report-pdf';
import { canGeneratePermitReport, PERMIT_REPORT_TIMEOUT_MS } from './permit-report.policy';
import { PermitService } from './permit.service';

export async function runWithinPermitReportDeadline<T>(work: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new ServiceUnavailableException('The permit report took too long. Try again.'));
      }, timeoutMs);
      work.then(resolve, reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class PermitReportService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly permitService: PermitService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async render(permitId: string, user: AuthenticatedUser): Promise<{ buffer: Buffer; fileName: string }> {
    const state = { expired: false };
    return runWithinPermitReportDeadline(this.compose(permitId, user, state), this.reportTimeoutMs(), () => {
      state.expired = true;
    });
  }

  private reportTimeoutMs(): number {
    const configured = Number(this.configService.get('permitReport.timeoutMs'));
    return Number.isFinite(configured) && configured > 0 ? configured : PERMIT_REPORT_TIMEOUT_MS;
  }

  private async compose(
    permitId: string,
    user: AuthenticatedUser,
    state: { expired: boolean },
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const report = await this.build(permitId, user);
    const generatedAt = new Date();
    const buffer = await renderPermitReportPdf(report, await this.logo(user.tenantId));
    if (!state.expired) {
      await this.auditService.log({
        action: 'permit.report-generated',
        entityType: 'permit',
        entityId: permitId,
        userId: user.id,
        tenantId: user.tenantId,
        metadata: {
          status: report.permit.status,
          edition: report.edition,
          version: report.permit.version,
        },
      });
    }
    return {
      buffer,
      fileName: permitReportFileName(report.permit.reference, report.edition, generatedAt, report.timezone),
    };
  }

  async build(permitId: string, user: AuthenticatedUser): Promise<PermitReport> {
    const detail = await this.permitService.findOne(permitId, user);
    const tenantId = detail.permit.tenantId;
    const [approvalRows, statusRows] = await Promise.all([
      this.db.select().from(approvalHistory).where(eq(approvalHistory.permitId, permitId)).orderBy(asc(approvalHistory.createdAt)),
      this.db.select().from(permitStatusHistory).where(eq(permitStatusHistory.permitId, permitId)).orderBy(asc(permitStatusHistory.createdAt)),
    ]);
    const previouslyApproved = Boolean(detail.permit.approvedAt) || approvalRows.some((row) => row.action === 'approved');
    if (!canGeneratePermitReport({ status: detail.permit.status, roles: user.roles, previouslyApproved })) {
      throw new ForbiddenException('This permit report is not available.');
    }

    const [organisation] = await this.db.select().from(organisations).where(eq(organisations.tenantId, tenantId)).limit(1);
    const [permitType] = await this.db.select({ name: permitTypes.name }).from(permitTypes).where(eq(permitTypes.id, detail.permit.permitTypeId)).limit(1);
    const [site] = detail.permit.siteId
      ? await this.db.select({ name: sites.name }).from(sites).where(eq(sites.id, detail.permit.siteId)).limit(1)
      : [];
    const [place] = detail.permit.workLocationId
      ? await this.db.select({ name: workLocations.name }).from(workLocations).where(eq(workLocations.id, detail.permit.workLocationId)).limit(1)
      : [];
    const [execution] = await this.db.select().from(permitExecution).where(eq(permitExecution.permitId, permitId)).limit(1);
    const [verification] = await this.db.select().from(permitVerifications).where(eq(permitVerifications.permitId, permitId)).limit(1);
    const [closure] = await this.db.select().from(permitClosures).where(eq(permitClosures.permitId, permitId)).limit(1);
    const evidenceRows = await this.db
      .select()
      .from(permitEvidence)
      .where(eq(permitEvidence.permitId, permitId))
      .orderBy(asc(permitEvidence.createdAt));
    const mdpRows = await this.db
      .select({
        kind: mdpEvidence.kind,
        operationalDate: mdpEvidence.operationalDate,
        fileName: mdpEvidence.fileName,
        contentType: mdpEvidence.contentType,
        fileSize: mdpEvidence.fileSize,
        uploadedBy: mdpEvidence.uploadedBy,
        uploadedAt: mdpEvidence.uploadedAt,
        storageKey: mdpEvidence.storageKey,
      })
      .from(mdpEvidence)
      .where(and(eq(mdpEvidence.tenantId, tenantId), eq(mdpEvidence.permitId, permitId)))
      .orderBy(asc(mdpEvidence.uploadedAt));
    const simops = await this.loadSimops(tenantId, permitId);
    const dayRecords = await this.loadDayRecords(tenantId, permitId);
    const files = [
      ...[...detail.attachments, ...evidenceRows].map((file) => ({
        fileName: file.fileName,
        contentType: file.contentType,
        fileSize: file.fileSize,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.createdAt,
        storageKey: file.storageKey,
      })),
      ...mdpRows.map((file) => ({
        fileName: mdpEvidenceReportName(file),
        contentType: file.contentType,
        fileSize: file.fileSize,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt,
        storageKey: file.storageKey,
      })),
    ];

    const hazardIds = detail.hazards.map((hazard) => hazard.hazardCategoryId).filter((id): id is string => Boolean(id));
    const ppeIds = detail.ppe.map((item) => item.ppeCatalogueId);
    const hazardNames = hazardIds.length
      ? await this.db.select({ id: hazardCategories.id, name: hazardCategories.name, controls: hazardCategories.controls }).from(hazardCategories).where(inArray(hazardCategories.id, hazardIds))
      : [];
    const ppeNames = ppeIds.length
      ? await this.db.select({ id: ppeCatalogue.id, name: ppeCatalogue.name }).from(ppeCatalogue).where(inArray(ppeCatalogue.id, ppeIds))
      : [];
    const hazardById = new Map(hazardNames.map((hazard) => [hazard.id, hazard]));
    const ppeById = new Map(ppeNames.map((item) => [item.id, item.name]));

    const actorIds = [
      detail.permit.submittedBy,
      detail.permit.approvedBy,
      ...detail.executors.map((executor) => executor.workforceUserId),
      ...detail.safetyOfficers.map((officer) => officer.workforceUserId),
      ...approvalRows.map((row) => row.actorId),
      ...statusRows.map((row) => row.actorId),
      execution?.activatedBy,
      verification?.verifiedBy,
      closure?.closedBy,
      ...files.map((file) => file.uploadedBy),
      ...simops.flatMap((item) => item.controls.map((control) => control.userId)),
      ...dayRecords.progress.map((row) => row.recordedBy),
      ...dayRecords.handovers.flatMap((row) => [row.fromId, row.toId]),
      ...dayRecords.secures.map((row) => row.securedBy),
      ...dayRecords.reopens.map((row) => row.by),
    ].filter((id): id is string => Boolean(id));
    const people = await this.people(tenantId, actorIds);

    const snapshot: PermitReportSnapshot = {
      generatedAt: new Date(),
      organisation: {
        name: organisation?.name ?? 'Organisation',
        legalName: organisation?.legalName,
        registrationNumber: organisation?.registrationNumber,
        addressLine1: organisation?.addressLine1,
        addressLine2: organisation?.addressLine2,
        addressState: organisation?.addressState,
        addressCountry: organisation?.addressCountry,
        addressPin: organisation?.addressPin,
        timezone: organisation?.timezone ?? 'UTC',
      },
      siteName: site?.name ?? null,
      placePath: [site?.name, place?.name, detail.permit.placePath, detail.permit.exactSpot].filter(Boolean).join(' · ') || null,
      permitTypeName: permitType?.name ?? 'Permit',
      permit: detail.permit,
      people,
      hazards: detail.hazards.map((hazard) => {
        const catalogue = hazard.hazardCategoryId ? hazardById.get(hazard.hazardCategoryId) : undefined;
        return {
          name: hazard.customName ?? catalogue?.name ?? 'Hazard',
          controls: [...(catalogue?.controls ?? []), ...(hazard.extraControls ?? [])],
        };
      }),
      ppe: detail.ppe.map((item) => ({
        name: ppeById.get(item.ppeCatalogueId) ?? 'PPE',
        quantity: item.quantity,
      })),
      gasTesting: detail.gasTesting
        .filter((test) => !test.removedReason)
        .map((test) => ({
          parameter: test.parameter,
          unit: test.unit,
          minimum: test.minimum,
          maximum: test.maximum,
        })),
      isolations: detail.isolationCertificates.map((certificate) => ({
        number: certificate.certificateNumber,
        title: certificate.title,
        status: certificate.status,
      })),
      simops,
      multiDay: detail.multiDay.isMultiDay,
      dayRecords,
      execution: execution ?? null,
      verification: verification ? { at: verification.verifiedAt, actorId: verification.verifiedBy, comment: verification.comment } : null,
      closure: closure ? { at: closure.closedAt, actorId: closure.closedBy, actualEndAt: closure.actualEndAt, comment: closure.comment } : null,
      attachments: files.map((file) => ({
        fileName: file.fileName,
        contentType: file.contentType,
        fileSize: file.fileSize,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt,
      })),
      history: [
        ...approvalRows.map((row) => ({
          id: row.id,
          at: row.createdAt,
          action: row.action,
          actorId: row.actorId,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          comment: row.comment,
        })),
        ...statusRows.map((row) => ({
          id: row.id,
          at: row.createdAt,
          action: row.action,
          actorId: row.actorId,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          comment: row.comment,
        })),
      ],
    };
    const report = assemblePermitReport(snapshot);
    await this.embedOwnedImages(report, files, tenantId, permitId);
    return report;
  }

  private async embedOwnedImages(
    report: PermitReport,
    files: { storageKey: string; contentType: string; fileSize: number }[],
    tenantId: string,
    permitId: string,
  ): Promise<void> {
    const prefixes = [this.configService.get<string>('mdp.evidencePrefix') ?? DAILY_PROGRESS_EVIDENCE_PREFIX];
    const candidates: { index: number; storageKey: string }[] = [];
    for (let index = 0; index < report.attachments.length; index += 1) {
      const file = report.attachments[index];
      const source = files[index];
      if (!file?.image || !source) continue;
      if (!canEmbedPermitReportImage(source) || !permitReportFileOwned(tenantId, permitId, source.storageKey, prefixes)) continue;
      candidates.push({ index, storageKey: source.storageKey });
    }
    let embedded = 0;
    let cursor = 0;
    while (cursor < candidates.length && embedded < PERMIT_REPORT_IMAGE_MAX_COUNT) {
      const batch = candidates.slice(cursor, cursor + Math.min(4, PERMIT_REPORT_IMAGE_MAX_COUNT - embedded));
      cursor += batch.length;
      const loaded = await Promise.all(batch.map(async (candidate) => {
        try {
          const bytes = await this.storageService.getObject(candidate.storageKey);
          if (bytes.length === 0 || bytes.length > PERMIT_REPORT_IMAGE_MAX_BYTES) return null;
          return { index: candidate.index, bytes };
        } catch {
          return null;
        }
      }));
      for (const item of loaded) {
        if (!item || embedded >= PERMIT_REPORT_IMAGE_MAX_COUNT) continue;
        const file = report.attachments[item.index];
        if (!file) continue;
        file.bytes = item.bytes;
        embedded += 1;
      }
    }
  }

  private async loadSimops(tenantId: string, permitId: string): Promise<NonNullable<PermitReportSnapshot['simops']>> {
    const links = await this.db
      .select({ caseId: simopsCasePermits.caseId, decision: simopsCasePermits.decision, comments: simopsCasePermits.comments })
      .from(simopsCasePermits)
      .where(and(eq(simopsCasePermits.tenantId, tenantId), eq(simopsCasePermits.permitId, permitId)));
    const caseIds = links.map((link) => link.caseId);
    const cases = caseIds.length
      ? await this.db.select().from(simopsCases).where(and(eq(simopsCases.tenantId, tenantId), inArray(simopsCases.id, caseIds))).orderBy(asc(simopsCases.detectedAt))
      : [];
    const members = caseIds.length
      ? await this.db
          .select({ caseId: simopsCasePermits.caseId, permitId: permits.id, reference: permits.reference, title: permits.title })
          .from(simopsCasePermits)
          .innerJoin(permits, eq(simopsCasePermits.permitId, permits.id))
          .where(and(eq(simopsCasePermits.tenantId, tenantId), eq(permits.tenantId, tenantId), inArray(simopsCasePermits.caseId, caseIds)))
      : [];
    const controls = caseIds.length
      ? await this.db
          .select({ caseId: simopsCaseControls.caseId, text: simopsCaseControls.controlText, userId: simopsCaseControls.responsibleUserId })
          .from(simopsCaseControls)
          .where(and(eq(simopsCaseControls.tenantId, tenantId), eq(simopsCaseControls.permitId, permitId), inArray(simopsCaseControls.caseId, caseIds)))
      : [];
    const linkByCase = new Map(links.map((link) => [link.caseId, link]));
    const caseRows = cases.map((row) => ({
      kind: 'case' as const,
      summary: row.summary,
      severity: row.severity,
      status: row.status,
      detectedAt: row.detectedAt,
      decision: linkByCase.get(row.id)?.decision ?? null,
      comments: linkByCase.get(row.id)?.comments ?? null,
      otherPermits: members
        .filter((member) => member.caseId === row.id && member.permitId !== permitId)
        .map((member) => (member.reference ? `${member.reference} · ${member.title}` : member.title)),
      controls: controls.filter((control) => control.caseId === row.id).map((control) => ({ text: control.text, userId: control.userId })),
    }));

    const conflictLinks = await this.db
      .select({ conflictId: conflictParticipants.conflictId })
      .from(conflictParticipants)
      .where(and(eq(conflictParticipants.tenantId, tenantId), eq(conflictParticipants.permitId, permitId)));
    const conflictIds = conflictLinks.map((link) => link.conflictId);
    const conflicts = conflictIds.length
      ? await this.db.select().from(simopsConflicts).where(and(eq(simopsConflicts.tenantId, tenantId), inArray(simopsConflicts.id, conflictIds))).orderBy(asc(simopsConflicts.detectedAt))
      : [];
    const others = conflictIds.length
      ? await this.db
          .select({ conflictId: conflictParticipants.conflictId, permitId: permits.id, reference: permits.reference, title: permits.title })
          .from(conflictParticipants)
          .innerJoin(permits, eq(conflictParticipants.permitId, permits.id))
          .where(and(eq(conflictParticipants.tenantId, tenantId), eq(permits.tenantId, tenantId), inArray(conflictParticipants.conflictId, conflictIds)))
      : [];
    const conflictRows = conflicts.map((row) => ({
      kind: 'conflict' as const,
      summary: row.summary,
      severity: row.severity,
      status: row.status,
      detectedAt: row.detectedAt,
      decision: row.conflictType,
      comments: null,
      otherPermits: others
        .filter((member) => member.conflictId === row.id && member.permitId !== permitId)
        .map((member) => (member.reference ? `${member.reference} · ${member.title}` : member.title)),
      controls: [],
    }));
    return [...caseRows, ...conflictRows];
  }

  private async loadDayRecords(tenantId: string, permitId: string): Promise<NonNullable<PermitReportSnapshot['dayRecords']>> {
    const [progress, handovers, secures, reopens] = await Promise.all([
      this.db
        .select({
          date: permitDailyProgress.operationalDate,
          status: permitDailyProgress.status,
          summary: permitDailyProgress.summary,
          recordedBy: permitDailyProgress.recordedBy,
        })
        .from(permitDailyProgress)
        .where(and(eq(permitDailyProgress.tenantId, tenantId), eq(permitDailyProgress.permitId, permitId)))
        .orderBy(asc(permitDailyProgress.operationalDate)),
      this.db
        .select({
          at: shiftHandovers.handedOverAt,
          fromId: shiftHandovers.outgoingUserId,
          toId: shiftHandovers.incomingUserId,
          status: shiftHandovers.status,
        })
        .from(shiftHandovers)
        .where(and(eq(shiftHandovers.tenantId, tenantId), eq(shiftHandovers.permitId, permitId)))
        .orderBy(asc(shiftHandovers.handedOverAt)),
      this.db
        .select({
          date: permitDaySecures.operationalDate,
          status: permitDaySecures.status,
          late: permitDaySecures.late,
          securedBy: permitDaySecures.securedBy,
        })
        .from(permitDaySecures)
        .where(and(eq(permitDaySecures.tenantId, tenantId), eq(permitDaySecures.permitId, permitId)))
        .orderBy(asc(permitDaySecures.operationalDate)),
      this.db
        .select({
          date: permitRevalidations.operationalDate,
          outcome: permitRevalidations.outcome,
          findings: permitRevalidations.findings,
          by: permitRevalidations.revalidatedBy,
        })
        .from(permitRevalidations)
        .where(and(eq(permitRevalidations.tenantId, tenantId), eq(permitRevalidations.permitId, permitId)))
        .orderBy(asc(permitRevalidations.operationalDate)),
    ]);
    return { progress, handovers, secures, reopens };
  }

  private async logo(tenantId: string | undefined): Promise<{ bytes: Buffer; contentType: string } | null> {
    if (!tenantId) return null;
    const [organisation] = await this.db
      .select({ key: organisations.logoStorageKey, contentType: organisations.logoContentType })
      .from(organisations)
      .where(eq(organisations.tenantId, tenantId))
      .limit(1);
    if (!organisation?.key || !organisation.contentType) return null;
    try {
      return { bytes: await this.storageService.getObject(organisation.key), contentType: organisation.contentType };
    } catch {
      return null;
    }
  }

  private async people(tenantId: string, ids: string[]): Promise<PermitReportPerson[]> {
    const unique = [...new Set(ids)];
    const employeeIds = unique.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    if (unique.length === 0) return [];
    const users = await this.db
      .select({
        id: tenantUsers.keycloakUserId,
        firstName: tenantUsers.firstName,
        lastName: tenantUsers.lastName,
        email: tenantUsers.email,
        role: tenantUsers.role,
      })
      .from(tenantUsers)
      .where(and(eq(tenantUsers.tenantId, tenantId), inArray(tenantUsers.keycloakUserId, unique)));
    const staff = employeeIds.length
      ? await this.db
          .select({ id: employees.id, name: employees.name })
          .from(employees)
          .where(and(eq(employees.tenantId, tenantId), inArray(employees.id, employeeIds)))
      : [];
    const people = new Map<string, PermitReportPerson>();
    for (const user of users) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
      people.set(user.id, { id: user.id, name, role: user.role });
    }
    for (const employee of staff) {
      if (!people.has(employee.id)) people.set(employee.id, { id: employee.id, name: employee.name, role: null });
    }
    return [...people.values()];
  }
}
