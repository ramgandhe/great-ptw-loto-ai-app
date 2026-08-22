const APPROVER_ROLE_LABELS: Record<string, string> = {
  "job-issuer": "Job Issuer",
  operator: "Job Executor",
  hod: "HOD",
  "safety-officer": "Safety Officer",
};

export function formatApproverRoleLabel(role: string): string {
  return APPROVER_ROLE_LABELS[role] ?? role.replace(/-/g, " ");
}
