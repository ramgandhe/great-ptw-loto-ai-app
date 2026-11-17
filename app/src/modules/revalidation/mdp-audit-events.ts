/**
 * Canonical MDP audit / history action names (Slice A12).
 * Use these strings in auditService.log and activity/revalidation history.
 */

export const MDP_AUDIT_ACTIONS = {
  // Daily progress (existing)
  progressRecorded: 'mdp.progress.recorded',
  progressSubmitted: 'mdp.progress.submitted',

  // End-of-day secure (Slice B)
  daySecured: 'mdp.day_secured',
  daySecureCountersigned: 'mdp.day_secure_countersigned',
  lateSecureRecorded: 'mdp.late_secure_recorded',

  // Handover (Slice E)
  handoverCompleted: 'mdp.handover.completed',
  handoverAccepted: 'mdp.handover.accepted',
  handoverRejected: 'mdp.handover.rejected',
  handoverCancelled: 'mdp.handover.cancelled',

  // Reopen / clear (Slice C) — reopen replaces loose continue
  revalidationPassed: 'mdp.revalidation_passed',
  revalidationFailed: 'mdp.revalidation_failed',
  permitCleared: 'mdp.permit_cleared',
  permitContinued: 'mdp.permit_continued', // legacy; prefer permitCleared
  permitSuspended: 'mdp.permit_suspended',

  // Override (Slice D)
  overrideUsed: 'mdp.override_used',

  // Duration extension (existing + Slice H)
  extensionRequested: 'mdp.extension_requested',
  extensionApproved: 'mdp.extension_approved',
  extensionRejected: 'mdp.extension_rejected',

  // Same-day overtime (Slice H)
  overtimeRequested: 'mdp.overtime_requested',
  overtimeApproved: 'mdp.overtime_approved',
  overtimeRejected: 'mdp.overtime_rejected',

  // Validity / renewal (existing + Slice I1)
  validityExpired: 'mdp.validity-expired',
  validityRenewalDue: 'mdp.validity-renewal-due',
  maxValidityDue: 'mdp.max_validity_due',
  renewalDueNotified: 'mdp.renewal_due_notified',
  renewalInitiated: 'permit.renewal_initiated',

  // Day-cycle reminders (Slice I2)
  secureDueReminder: 'mdp.secure_due_reminder',
  reopenDueReminder: 'mdp.reopen_due_reminder',
  lateSecureReminder: 'mdp.late_secure_reminder',

  // Evidence (Slice I3/I4)
  evidenceUploaded: 'mdp.evidence_uploaded',

  // Morning briefing (Wave 2)
  toolboxTalkRecorded: 'mdp.toolbox_talk_recorded',
  dailyCrewUpdated: 'mdp.daily_crew_updated',

  // Org settings (A11)
  orgMdpSettingsUpdated: 'organisation.mdp_settings_updated',
} as const;

export type MdpAuditAction = (typeof MDP_AUDIT_ACTIONS)[keyof typeof MDP_AUDIT_ACTIONS];
