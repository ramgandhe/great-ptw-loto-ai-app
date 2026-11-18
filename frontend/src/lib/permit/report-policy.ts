/**
 * Mirrors app/src/modules/permit/permit-report.policy.ts.
 * The API enforces the same rules; this copy only decides whether to show Generate Report.
 */

export const PERMIT_REPORT_ROLES = [
  "permit-receiver",
  "permit-operator",
  "permit-approver",
  "safety-officer",
  "tenant-owner",
  "tenant-admin",
  "platform-admin",
] as const;

export const PERMIT_REPORT_STATUSES = [
  "approved",
  "active",
  "suspended",
  "execution_completed",
  "pending_closure",
  "closed",
  "expired",
  "cancelled",
] as const;

export const PERMIT_REPORT_PRIOR_APPROVAL_STATUSES = ["pending_approval", "rejected", "deferred"] as const;

export type PermitReportEdition = "interim" | "final";

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
  return status === "closed" ? "final" : "interim";
}

export function permitReportEditionLabel(status: string): string {
  if (status === "closed") return "FINAL";
  if (status === "expired") return "INTERIM — EXPIRED";
  if (status === "cancelled") return "INTERIM — CANCELLED";
  return "INTERIM";
}
