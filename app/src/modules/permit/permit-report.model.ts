import type { PermitReportEdition, PermitReportSectionId } from './permit-report.policy';

export type PermitReportPerson = {
  id: string;
  name: string;
  role: string | null;
};

export type PermitReportSimops = {
  summary: string;
  severity: string;
  status: string;
  detectedAt: string | null;
  detail: string | null;
  comments: string | null;
  otherPermits: string[];
  controls: string[];
};

export type PermitReportDay = {
  date: string;
  progress: string | null;
  handovers: string[];
  secure: string | null;
  reopen: string | null;
};

export type PermitReportEvent = {
  id: string;
  at: string;
  action: string;
  actor: string;
  role: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  comment: string | null;
  signature: boolean;
};

export type PermitReport = {
  edition: PermitReportEdition;
  editionLabel: string;
  generatedAt: string;
  timezone: string;
  organisation: {
    name: string;
    legalName: string | null;
    registrationNumber: string | null;
    address: string | null;
    site: string | null;
    place: string | null;
  };
  permit: {
    id: string;
    reference: string;
    title: string;
    type: string;
    version: number;
    status: string;
    statusLabel: string;
    workScope: string | null;
    siteNotes: string | null;
    emergencyPhone: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
  };
  people: PermitReportPerson[];
  hazards: { name: string; controls: string[] }[];
  ppe: { name: string; quantity: number }[];
  gasTesting: { parameter: string; unit: string; minimum: number; maximum: number }[];
  isolations: { number: string; title: string; status: string }[];
  forms: { name: string; answers: { label: string; value: string }[] }[];
  simops: PermitReportSimops[];
  execution: {
    activatedAt: string | null;
    actualStartAt: string | null;
    workState: string | null;
    suspensionReason: string | null;
  } | null;
  multiDay: boolean;
  days: PermitReportDay[];
  verification: { at: string; actor: string; comment: string | null } | null;
  closure: { at: string; actor: string; actualEnd: string | null; comment: string | null } | null;
  attachments: {
    fileName: string;
    contentType: string;
    fileSize: number;
    image: boolean;
    uploadedBy: string | null;
    uploadedAt: string | null;
    /** Present only for an image this permit owns and the report can embed. */
    bytes?: Buffer;
  }[];
  history: PermitReportEvent[];
  sections: PermitReportSectionId[];
};

export const PERMIT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  deferred: 'Deferred',
  rejected: 'Rejected',
  approved: 'Approved',
  active: 'Work in progress',
  suspended: 'Suspended',
  execution_completed: 'Work finished',
  pending_closure: 'Final sign-off',
  closed: 'Closed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function permitReportStatusLabel(status: string): string {
  return PERMIT_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export function formatReportDate(value: Date | string | null | undefined, timeZone: string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const zone = timeZone.trim() || 'UTC';
  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: zone,
  }).format(date);
  return `${formatted} (${zone})`;
}
