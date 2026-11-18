import { organisationAddress } from '../organisation/organisation-logo';
import {
  formatReportDate,
  permitReportStatusLabel,
  type PermitReport,
  type PermitReportDay,
  type PermitReportEvent,
  type PermitReportPerson,
  type PermitReportSimops,
} from './permit-report.model';
import {
  isPermitReportSignature,
  PERMIT_REPORT_SECTIONS,
  permitReportEdition,
  permitReportEditionLabel,
  type PermitReportSectionId,
} from './permit-report.policy';

export type PermitReportHistoryRow = {
  id: string;
  at: Date | string;
  action: string;
  actorId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  comment?: string | null;
};

export type PermitReportSnapshot = {
  generatedAt: Date;
  organisation: {
    name: string;
    legalName?: string | null;
    registrationNumber?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    addressState?: string | null;
    addressCountry?: string | null;
    addressPin?: string | null;
    timezone: string;
  };
  siteName?: string | null;
  placePath?: string | null;
  permitTypeName: string;
  permit: {
    id: string;
    reference?: string | null;
    title: string;
    status: string;
    permitVersion: number;
    workScope?: string | null;
    siteNotes?: string | null;
    emergencyPhone?: string | null;
    plannedStartAt?: Date | string | null;
    plannedEndAt?: Date | string | null;
    lototoRequired?: boolean;
    submittedBy?: string | null;
    submittedSignedName?: string | null;
    approvedBy?: string | null;
    approvedSignedName?: string | null;
    formResponses?: unknown;
  };
  people: PermitReportPerson[];
  hazards: { name: string; controls: string[] }[];
  ppe: { name: string; quantity: number }[];
  gasTesting: { parameter: string; unit: string; minimum: number; maximum: number }[];
  isolations: { number: string; title: string; status: string }[];
  simops?: {
    kind: 'case' | 'conflict';
    summary: string;
    severity: string;
    status: string;
    detectedAt: Date | string;
    decision?: string | null;
    comments?: string | null;
    otherPermits: string[];
    controls: { text: string; userId: string }[];
  }[];
  multiDay: boolean;
  dayRecords?: {
    progress: { date: string; status: string; summary: string; recordedBy: string }[];
    handovers: { at: Date | string; fromId: string; toId: string; status: string }[];
    secures: { date: string; status: string; late: boolean; securedBy: string }[];
    reopens: { date: string; outcome: string; findings: string; by: string }[];
  };
  execution?: {
    activatedAt?: Date | string | null;
    actualStartAt?: Date | string | null;
    workState?: string | null;
    suspensionReason?: string | null;
    suspendedAt?: Date | string | null;
  } | null;
  verification?: { at: Date | string; actorId: string; comment?: string | null } | null;
  closure?: { at: Date | string; actorId: string; actualEndAt?: Date | string | null; comment?: string | null } | null;
  attachments: {
    fileName: string;
    contentType: string;
    fileSize: number;
    uploadedBy?: string | null;
    uploadedAt?: Date | string | null;
  }[];
  history: PermitReportHistoryRow[];
};

export function assemblePermitReport(snapshot: PermitReportSnapshot): PermitReport {
  const zone = snapshot.organisation.timezone || 'UTC';
  const names = new Map(snapshot.people.map((person) => [person.id, person]));
  if (snapshot.permit.approvedBy && snapshot.permit.approvedSignedName) {
    const existing = names.get(snapshot.permit.approvedBy);
    names.set(snapshot.permit.approvedBy, {
      id: snapshot.permit.approvedBy,
      name: snapshot.permit.approvedSignedName,
      role: existing?.role ?? null,
    });
  }
  const history = dedupeHistory(snapshot.history)
    .map((row) => toEvent(row, names))
    .sort((a, b) => a.at.localeCompare(b.at));
  const sections = includedSections(snapshot);

  return {
    edition: permitReportEdition(snapshot.permit.status),
    editionLabel: permitReportEditionLabel(snapshot.permit.status),
    generatedAt: formatReportDate(snapshot.generatedAt, zone) ?? '',
    timezone: zone,
    organisation: {
      name: snapshot.organisation.name,
      legalName: snapshot.organisation.legalName ?? null,
      registrationNumber: snapshot.organisation.registrationNumber ?? null,
      address: organisationAddress(snapshot.organisation),
      site: snapshot.siteName ?? null,
      place: snapshot.placePath ?? null,
    },
    permit: {
      id: snapshot.permit.id,
      reference: snapshot.permit.reference ?? 'Not issued',
      title: snapshot.permit.title,
      type: snapshot.permitTypeName,
      version: snapshot.permit.permitVersion,
      status: snapshot.permit.status,
      statusLabel: permitReportStatusLabel(snapshot.permit.status),
      workScope: snapshot.permit.workScope ?? null,
      siteNotes: snapshot.permit.siteNotes ?? null,
      emergencyPhone: snapshot.permit.emergencyPhone ?? null,
      plannedStart: formatReportDate(snapshot.permit.plannedStartAt, zone),
      plannedEnd: formatReportDate(snapshot.permit.plannedEndAt, zone),
    },
    people: [...names.values()],
    hazards: snapshot.hazards,
    ppe: snapshot.ppe,
    gasTesting: snapshot.gasTesting,
    isolations: snapshot.isolations,
    simops: (snapshot.simops ?? []).map((item) => toSimops(item, names, zone)),
    forms: formAnswers(snapshot.permit.formResponses),
    execution: snapshot.execution
      ? {
          activatedAt: formatReportDate(snapshot.execution.activatedAt, zone),
          actualStartAt: formatReportDate(snapshot.execution.actualStartAt, zone),
          workState: snapshot.execution.workState ?? null,
          suspensionReason: snapshot.execution.suspensionReason ?? null,
        }
      : null,
    multiDay: snapshot.multiDay,
    days: toDays(snapshot, names, zone),
    verification: snapshot.verification
      ? {
          at: formatReportDate(snapshot.verification.at, zone) ?? '',
          actor: personName(names, snapshot.verification.actorId),
          comment: snapshot.verification.comment ?? null,
        }
      : null,
    closure: snapshot.closure
      ? {
          at: formatReportDate(snapshot.closure.at, zone) ?? '',
          actor: personName(names, snapshot.closure.actorId),
          actualEnd: formatReportDate(snapshot.closure.actualEndAt, zone),
          comment: snapshot.closure.comment ?? null,
        }
      : null,
    attachments: snapshot.attachments.map((file) => ({
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
      image: file.contentType.split(';')[0].trim().toLowerCase().startsWith('image/'),
      uploadedBy: file.uploadedBy ? personName(names, file.uploadedBy) : null,
      uploadedAt: formatReportDate(file.uploadedAt, zone),
    })),
    history,
    sections,
  };
}

function includedSections(snapshot: PermitReportSnapshot): PermitReportSectionId[] {
  const present = new Set<PermitReportSectionId>([
    'cover',
    'summary',
    'scope',
    'people',
    'hazards',
    'controls',
    'forms',
    'approvals',
    'evidence',
    'history',
    'audit',
  ]);
  if (snapshot.gasTesting.length > 0) present.add('gas_testing');
  if (snapshot.permit.lototoRequired || snapshot.isolations.length > 0) present.add('lototo');
  if ((snapshot.simops ?? []).length > 0) present.add('simops');
  if (snapshot.multiDay || hasDayRecords(snapshot.dayRecords)) present.add('multi_day');
  const suspended =
    Boolean(snapshot.execution?.suspendedAt || snapshot.execution?.suspensionReason) ||
    snapshot.history.some((row) => row.action === 'suspended' || row.action === 'revalidated');
  if (suspended) present.add('suspension');
  if (snapshot.execution || snapshot.verification || snapshot.closure) present.add('execution');
  if (snapshot.verification || snapshot.closure) present.add('closure');
  return PERMIT_REPORT_SECTIONS.map((section) => section.id).filter((id) => present.has(id));
}

function dedupeHistory(rows: PermitReportHistoryRow[]): PermitReportHistoryRow[] {
  const seen = new Set<string>();
  const unique: PermitReportHistoryRow[] = [];
  for (const row of rows) {
    const at = new Date(row.at).toISOString();
    const key = `${row.action}|${row.actorId}|${at}|${row.fromStatus ?? ''}|${row.toStatus ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

function toEvent(row: PermitReportHistoryRow, names: Map<string, PermitReportPerson>): PermitReportEvent {
  const person = names.get(row.actorId);
  const named = Boolean(person?.name);
  return {
    id: row.id,
    at: new Date(row.at).toISOString(),
    action: row.action,
    actor: person?.name ?? 'Unknown user',
    role: person?.role ?? null,
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus ?? null,
    comment: row.comment ?? null,
    signature: named && isPermitReportSignature(row.action),
  };
}

function toSimops(
  item: NonNullable<PermitReportSnapshot['simops']>[number],
  names: Map<string, PermitReportPerson>,
  zone: string,
): PermitReportSimops {
  const decision = item.decision?.replace(/_/g, ' ') ?? null;
  return {
    summary: item.summary,
    severity: item.severity,
    status: item.status,
    detectedAt: formatReportDate(item.detectedAt, zone),
    detail: decision ? `${item.kind === 'case' ? 'Decision' : 'Conflict'}: ${decision}` : null,
    comments: item.comments ?? null,
    otherPermits: item.otherPermits,
    controls: item.controls.map((control) => `${control.text} · ${personName(names, control.userId)}`),
  };
}

function hasDayRecords(records: PermitReportSnapshot['dayRecords']): boolean {
  if (!records) return false;
  return records.progress.length + records.handovers.length + records.secures.length + records.reopens.length > 0;
}

function toDays(snapshot: PermitReportSnapshot, names: Map<string, PermitReportPerson>, zone: string): PermitReportDay[] {
  const records = snapshot.dayRecords;
  if (!records) return [];
  const byDate = new Map<string, PermitReportDay>();
  const day = (date: string): PermitReportDay => {
    const key = date || 'Undated';
    const existing = byDate.get(key);
    if (existing) return existing;
    const created: PermitReportDay = { date: key, progress: null, handovers: [], secure: null, reopen: null };
    byDate.set(key, created);
    return created;
  };
  for (const progress of records.progress) {
    day(progress.date).progress = `${progress.status.replace(/_/g, ' ')}: ${progress.summary} · ${personName(names, progress.recordedBy)}`;
  }
  for (const handover of records.handovers) {
    const when = formatReportDate(handover.at, zone);
    day(calendarDate(handover.at, zone)).handovers.push(
      `${personName(names, handover.fromId)} to ${personName(names, handover.toId)} · ${handover.status.replace(/_/g, ' ')}${when ? ` · ${when}` : ''}`,
    );
  }
  for (const secure of records.secures) {
    day(secure.date).secure = `${secure.status.replace(/_/g, ' ')}${secure.late ? ' · late' : ''} · ${personName(names, secure.securedBy)}`;
  }
  for (const reopen of records.reopens) {
    const findings = reopen.findings.trim();
    day(reopen.date).reopen = [reopen.outcome, findings, personName(names, reopen.by)].filter(Boolean).join(' · ');
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function calendarDate(value: Date | string, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone.trim() || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function personName(names: Map<string, PermitReportPerson>, id: string): string {
  return names.get(id)?.name ?? 'Unknown user';
}

function formAnswers(value: unknown): PermitReport['forms'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as { name?: unknown; answers?: unknown };
    const answers = record.answers && typeof record.answers === 'object' ? Object.entries(record.answers as Record<string, unknown>) : [];
    return [{
      name: typeof record.name === 'string' && record.name.trim() ? record.name : 'Form',
      answers: answers
        .map(([label, answer]) => ({ label, value: answerText(answer) }))
        .filter((answer) => answer.value),
    }];
  });
}

function answerText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean).join(', ');
  if (typeof value === 'object' && 'name' in value && typeof value.name === 'string') return value.name;
  return '';
}
