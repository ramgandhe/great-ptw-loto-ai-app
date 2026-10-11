const APPROVER_ROLE_LABELS: Record<string, string> = {
  "permit-receiver": "Permit receiver",
  "permit-operator": "Permit operator",
  "permit-approver": "Permit approver",
  "safety-officer": "Safety officer",
};

export function formatApproverRoleLabel(role: string): string {
  return APPROVER_ROLE_LABELS[role] ?? role.replace(/-/g, " ");
}
