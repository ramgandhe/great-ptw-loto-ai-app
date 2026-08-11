import {
  evaluateEscalation,
  isDelegationActive,
  MAX_APPROVAL_ESCALATION_LEVELS,
} from '../app/src/modules/approval/escalation-rules';

describe('Escalation + delegation rules (PUS-243 / FR-PTW-019–023)', () => {
  const now = new Date('2026-08-11T12:00:00.000Z');

  describe('evaluateEscalation (FR-PTW-019–022)', () => {
    it('does nothing when within SLA', () => {
      const result = evaluateEscalation({
        now,
        slaDueAt: new Date('2026-08-11T13:00:00.000Z'),
        slaPausedAt: null,
        escalationLevel: 0,
        fallbackRoles: ['org-admin'],
      });
      expect(result.action).toBe('none');
      expect(result.reason).toBe('within_sla');
    });

    it('pauses when defer SLA clock is active (FR-PTW-025)', () => {
      const result = evaluateEscalation({
        now,
        slaDueAt: new Date('2026-08-11T11:00:00.000Z'),
        slaPausedAt: new Date('2026-08-11T10:30:00.000Z'),
        escalationLevel: 0,
        fallbackRoles: ['org-admin'],
      });
      expect(result.action).toBe('none');
      expect(result.reason).toBe('sla_paused');
    });

    it('escalates to first fallback role on breach', () => {
      const result = evaluateEscalation({
        now,
        slaDueAt: new Date('2026-08-11T11:00:00.000Z'),
        slaPausedAt: null,
        escalationLevel: 0,
        fallbackRoles: ['org-admin', 'safety-officer', 'supervisor'],
      });
      expect(result.action).toBe('escalate');
      expect(result.nextLevel).toBe(1);
      expect(result.fallbackRole).toBe('org-admin');
    });

    it('escalates through level 3', () => {
      const result = evaluateEscalation({
        now,
        slaDueAt: new Date('2026-08-11T11:00:00.000Z'),
        slaPausedAt: null,
        escalationLevel: 2,
        fallbackRoles: ['org-admin', 'safety-officer', 'supervisor'],
      });
      expect(result.action).toBe('escalate');
      expect(result.nextLevel).toBe(3);
      expect(result.fallbackRole).toBe('supervisor');
    });

    it('blocks on fourth escalation attempt (FR-PTW-022)', () => {
      expect(MAX_APPROVAL_ESCALATION_LEVELS).toBe(3);
      const result = evaluateEscalation({
        now,
        slaDueAt: new Date('2026-08-11T11:00:00.000Z'),
        slaPausedAt: null,
        escalationLevel: 3,
        fallbackRoles: ['org-admin', 'safety-officer', 'supervisor'],
      });
      expect(result.action).toBe('block');
      expect(result.reason).toBe('max_escalation_exceeded');
    });
  });

  describe('isDelegationActive (FR-PTW-023)', () => {
    it('accepts valid date-bounded delegation', () => {
      expect(
        isDelegationActive(
          {
            startsAt: new Date('2026-08-01T00:00:00.000Z'),
            endsAt: new Date('2026-08-31T00:00:00.000Z'),
            revokedAt: null,
          },
          now,
        ),
      ).toBe(true);
    });

    it('rejects expired delegation', () => {
      expect(
        isDelegationActive(
          {
            startsAt: new Date('2026-07-01T00:00:00.000Z'),
            endsAt: new Date('2026-07-31T00:00:00.000Z'),
            revokedAt: null,
          },
          now,
        ),
      ).toBe(false);
    });

    it('rejects revoked delegation', () => {
      expect(
        isDelegationActive(
          {
            startsAt: new Date('2026-08-01T00:00:00.000Z'),
            endsAt: new Date('2026-08-31T00:00:00.000Z'),
            revokedAt: new Date('2026-08-10T00:00:00.000Z'),
          },
          now,
        ),
      ).toBe(false);
    });
  });
});
