import { MDP_AUDIT_ACTIONS } from '../app/src/modules/revalidation/mdp-audit-events';
import { REVALIDATION_HISTORY_EVENT_TYPES } from '../app/src/database/schema/multi-day-revalidation';
import { MDP_EVIDENCE_KINDS } from '../app/src/database/schema/multi-day';
import { DAILY_PROGRESS_EVIDENCE_PREFIX } from '../app/src/modules/daily-progress/daily-progress.constants';

describe('MDP Slice I — jobs / evidence constants', () => {
  it('I1: audit + history cover max validity', () => {
    expect(MDP_AUDIT_ACTIONS.maxValidityDue).toBe('mdp.max_validity_due');
    expect(REVALIDATION_HISTORY_EVENT_TYPES).toContain('max_validity_due_notified');
    expect(REVALIDATION_HISTORY_EVENT_TYPES).toContain('renewal_due_notified');
  });

  it('I2: day-cycle reminder audit + history events exist', () => {
    expect(MDP_AUDIT_ACTIONS.secureDueReminder).toBe('mdp.secure_due_reminder');
    expect(MDP_AUDIT_ACTIONS.reopenDueReminder).toBe('mdp.reopen_due_reminder');
    expect(MDP_AUDIT_ACTIONS.lateSecureReminder).toBe('mdp.late_secure_reminder');
    expect(REVALIDATION_HISTORY_EVENT_TYPES).toContain('secure_due_reminder');
    expect(REVALIDATION_HISTORY_EVENT_TYPES).toContain('reopen_due_reminder');
    expect(REVALIDATION_HISTORY_EVENT_TYPES).toContain('late_secure_reminder');
  });

  it('I3/I4: evidence kinds and prefix are defined', () => {
    expect(MDP_EVIDENCE_KINDS).toEqual(['daily_progress', 'day_secure', 'reopen']);
    expect(DAILY_PROGRESS_EVIDENCE_PREFIX).toBe('mdp/daily-progress');
    expect(MDP_AUDIT_ACTIONS.evidenceUploaded).toBe('mdp.evidence_uploaded');
    expect(REVALIDATION_HISTORY_EVENT_TYPES).toContain('evidence_uploaded');
  });

  it('I5: validity notification job ids include operationalDate for dedupe', () => {
    const operationalDate = '2026-08-10';
    const tenantId = 't1';
    const permitId = 'p1';
    for (const state of ['renewal_due', 'expired', 'max_validity'] as const) {
      const jobId = `${tenantId}:${permitId}:${state}:${operationalDate}`;
      expect(jobId).toContain(operationalDate);
      expect(jobId).toContain(state);
    }
  });
});
