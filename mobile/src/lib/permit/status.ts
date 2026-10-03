export const EDITABLE_PERMIT_STATUSES = ["draft", "deferred", "rejected"] as const;

export function isEditablePermitStatus(status: string): boolean {
  return (EDITABLE_PERMIT_STATUSES as readonly string[]).includes(status);
}

/** The name people see for each permit status, as on the web (frontend/src/lib/permit/status.ts). */
const PERMIT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  deferred: "Deferred",
  rejected: "Rejected",
  approved: "Approved",
  active: "Work in progress",
  suspended: "Suspended",
  execution_completed: "Work finished",
  pending_closure: "Final sign-off",
  closed: "Closed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function permitStatusLabel(status: string): string {
  return PERMIT_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

/**
 * Permit types fall into hazard families (web permit-type-chip.tsx): the chip keeps the colour
 * the organisation chose and the icon names the family.
 */
export const TYPE_FAMILIES = [
  { key: "hot", match: /hot|weld|burn/i, color: "#DC2626" },
  { key: "electrical", match: /electr|energ/i, color: "#D97706" },
  { key: "hazardous", match: /hazard|atex|gas/i, color: "#EA580C" },
  { key: "confined", match: /confin|vessel|tank entry/i, color: "#7C3AED" },
  { key: "height", match: /height|scaffold|roof/i, color: "#0891B2" },
  { key: "excavation", match: /excavat|dig|trench/i, color: "#92400E" },
  { key: "lifting", match: /shift|lift|crane|machine/i, color: "#4D7C0F" },
  { key: "cold", match: /cold/i, color: "#2563EB" },
] as const;

export type TypeFamily = (typeof TYPE_FAMILIES)[number]["key"] | "general";

export function typeFamily(name: string | undefined): { key: TypeFamily; color: string } {
  return TYPE_FAMILIES.find((f) => name && f.match.test(name)) ?? { key: "general", color: "#475569" };
}
