/**
 * Rules for the on-demand permit dossier.
 * A permit is reportable once it has been approved, and stays reportable through
 * execution, closure, expiry, cancellation, and any later return to approval.
 */

/** On-demand PDF generation is heavier than a normal permit read. */
export const PERMIT_REPORT_RATE_LIMIT = 10;
export const PERMIT_REPORT_RATE_WINDOW_MS = 60_000;
export const PERMIT_REPORT_TIMEOUT_MS = 30_000;

export const PERMIT_REPORT_ROLES = [
  'permit-receiver',
  'permit-operator',
  'permit-approver',
  'safety-officer',
  'tenant-owner',
  'tenant-admin',
  'platform-admin',
] as const;

/** Statuses that are always reportable. Drafts never reach this list. */
export const PERMIT_REPORT_STATUSES = [
  'approved',
  'active',
  'suspended',
  'execution_completed',
  'pending_closure',
  'closed',
  'expired',
  'cancelled',
] as const;

/**
 * A permit can leave the approved path and come back (revalidation, deferral, safety veto).
 * Those statuses stay reportable only when an approval has already been recorded.
 */
export const PERMIT_REPORT_PRIOR_APPROVAL_STATUSES = ['pending_approval', 'rejected', 'deferred'] as const;

export type PermitReportEdition = 'interim' | 'final';

export const PERMIT_REPORT_SECTIONS = [
  { id: 'cover', label: 'Document control' },
  { id: 'summary', label: 'Permit summary' },
  { id: 'scope', label: 'Work scope, place and schedule' },
  { id: 'people', label: 'People and responsibilities' },
  { id: 'hazards', label: 'Hazards and risk assessment' },
  { id: 'controls', label: 'Controls and PPE' },
  { id: 'forms', label: 'Forms and checklists' },
  { id: 'gas_testing', label: 'Gas testing' },
  { id: 'lototo', label: 'LOTOTO and isolations' },
  { id: 'simops', label: 'Simultaneous operations' },
  { id: 'approvals', label: 'Approvals and electronic signatures' },
  { id: 'execution', label: 'Execution record' },
  { id: 'multi_day', label: 'Multi-day activity' },
  { id: 'suspension', label: 'Suspensions and revalidations' },
  { id: 'closure', label: 'Verification and closure' },
  { id: 'evidence', label: 'Evidence and attachments' },
  { id: 'history', label: 'Lifecycle history' },
  { id: 'audit', label: 'Audit appendix' },
] as const;

export type PermitReportSectionId = (typeof PERMIT_REPORT_SECTIONS)[number]['id'];

/** Sections omitted when the permit has no records for them. */
export const PERMIT_REPORT_DYNAMIC_SECTIONS = [
  'gas_testing',
  'lototo',
  'simops',
  'multi_day',
  'suspension',
  'closure',
] as const satisfies readonly PermitReportSectionId[];

/**
 * Actions that become an electronic-signature block.
 * Ordinary audit events stay in the history and are not labelled as signatures.
 */
export const PERMIT_REPORT_SIGNATURE_ACTIONS = [
  'approved',
  'execution_released',
  'activated',
  'execution_completed',
  'verified',
  'closed',
  'handover_accepted',
  'countersigned',
] as const;

export function hasPermitReportRole(roles: readonly string[]): boolean {
  return roles.some((role) => (PERMIT_REPORT_ROLES as readonly string[]).includes(role));
}

export function canGeneratePermitReport(input: {
  status: string;
  roles: readonly string[];
  previouslyApproved: boolean;
}): boolean {
  if (!hasPermitReportRole(input.roles)) return false;
  if ((PERMIT_REPORT_STATUSES as readonly string[]).includes(input.status)) return true;
  return (
    input.previouslyApproved &&
    (PERMIT_REPORT_PRIOR_APPROVAL_STATUSES as readonly string[]).includes(input.status)
  );
}

export function permitReportEdition(status: string): PermitReportEdition {
  return status === 'closed' ? 'final' : 'interim';
}

export function permitReportEditionLabel(status: string): string {
  if (status === 'closed') return 'FINAL';
  if (status === 'expired') return 'INTERIM — EXPIRED';
  if (status === 'cancelled') return 'INTERIM — CANCELLED';
  return 'INTERIM';
}

export function isPermitReportSignature(action: string): boolean {
  return (PERMIT_REPORT_SIGNATURE_ACTIONS as readonly string[]).includes(action);
}
