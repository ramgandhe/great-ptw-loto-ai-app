/** FR-ROL-001: the fixed permission list. A role is a named subset of it. */
export const PERMISSIONS = [
  'raise_permit', 'edit_permit', 'accept_permit', 'add_site_details', 'manage_crew', 'check_crew_in_out',
  'accept_substitute', 'fill_check_sheets', 'safety_check', 'record_gas_test', 'perform_isolation',
  'verify_isolation', 'restore_isolation', 'verify_restoration', 'approve', 'defer', 'send_back', 'reject',
  'issue_permit', 'record_progress', 'accept_days_progress', 'resume', 'revalidate_day', 'request_extension',
  'approve_extension', 'renew_permit', 'cancel_permit', 'report_completion', 'accept_closure',
  'hand_over_permit_duty', 'report_incident', 'decide_near_miss', 'investigate_incident', 'close_incident',
  'review_simops_conflict', 'acknowledge_low_simops_conflict', 'view_reports',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** PRD §5.2: the default permit roles. Keys survive renaming (FR-ROL-002); names are what people see. */
export const DEFAULT_ROLES = [
  {
    key: 'PTW_PERMIT_COORDINATOR',
    name: 'Permit coordinator',
    permissions: [
      'raise_permit', 'edit_permit', 'fill_check_sheets', 'issue_permit', 'accept_substitute', 'accept_days_progress',
      'request_extension', 'cancel_permit', 'acknowledge_low_simops_conflict', 'accept_closure', 'hand_over_permit_duty',
      'report_incident', 'view_reports',
    ],
  },
  {
    key: 'PTW_PERMIT_RECEIVER',
    name: 'Permit receiver',
    permissions: [
      'accept_permit', 'add_site_details', 'manage_crew', 'check_crew_in_out', 'fill_check_sheets', 'perform_isolation',
      'record_progress', 'revalidate_day', 'report_completion', 'restore_isolation', 'hand_over_permit_duty',
      'report_incident',
    ],
  },
  {
    key: 'PTW_PERMIT_APPROVER',
    name: 'Permit approver',
    permissions: [
      'approve', 'defer', 'send_back', 'reject', 'resume', 'approve_extension', 'renew_permit', 'cancel_permit',
      'decide_near_miss', 'review_simops_conflict', 'report_incident', 'view_reports',
    ],
  },
  {
    key: 'PTW_SAFETY_OFFICER',
    name: 'Safety officer',
    permissions: [
      'safety_check', 'record_gas_test', 'verify_isolation', 'verify_restoration', 'revalidate_day', 'resume',
      'cancel_permit', 'review_simops_conflict', 'investigate_incident', 'close_incident', 'report_incident',
      'view_reports',
    ],
  },
  { key: 'PTW_PERMIT_EXECUTOR', name: 'Permit executor', permissions: ['record_progress', 'report_incident'] },
] as const satisfies ReadonlyArray<{ key: string; name: string; permissions: readonly Permission[] }>;
export type DefaultRoleKey = (typeof DEFAULT_ROLES)[number]['key'];

/** PRD §5.1: fixed admin roles. Not in the role editor; never hold permit permissions (FR-ROL-007). */
export const ADMIN_ROLES = ['TENANT_ORG_ADMIN', 'LEGAL_ORG_ADMIN'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
