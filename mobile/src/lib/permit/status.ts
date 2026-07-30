export const EDITABLE_PERMIT_STATUSES = ["draft", "deferred", "rejected"] as const;

export function isEditablePermitStatus(status: string): boolean {
  return (EDITABLE_PERMIT_STATUSES as readonly string[]).includes(status);
}
