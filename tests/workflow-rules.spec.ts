import {
  parallelStageOutcome,
  shouldIncludeStep,
} from '../app/src/modules/approval/workflow-rules';

describe('Workflow rules (PUS-243 / FR-PTW-015–018, 028)', () => {
  describe('shouldIncludeStep (FR-PTW-015 / FR-PTW-018)', () => {
    it('includes unconditional steps', () => {
      expect(
        shouldIncludeStep({}, { riskLevel: 'low', requiresLototo: false, requiresEnergyIsolation: false }),
      ).toBe(true);
    });

    it('skips LOTOTO stage when permit has no isolation', () => {
      expect(
        shouldIncludeStep(
          { condition: { requiresLototo: true } },
          { riskLevel: 'medium', requiresLototo: false, requiresEnergyIsolation: false },
        ),
      ).toBe(false);
    });

    it('includes LOTOTO stage when required', () => {
      expect(
        shouldIncludeStep(
          { condition: { requiresLototo: true } },
          { riskLevel: 'medium', requiresLototo: true, requiresEnergyIsolation: true },
        ),
      ).toBe(true);
    });

    it('skips high-risk-only stage for medium risk (risk branch)', () => {
      expect(
        shouldIncludeStep(
          { minRiskLevel: 'high' },
          { riskLevel: 'medium', requiresLototo: false, requiresEnergyIsolation: false },
        ),
      ).toBe(false);
    });

    it('includes high-risk stage for high risk permits', () => {
      expect(
        shouldIncludeStep(
          { minRiskLevel: 'high' },
          { riskLevel: 'high', requiresLototo: false, requiresEnergyIsolation: false },
        ),
      ).toBe(true);
    });
  });

  describe('parallelStageOutcome (FR-PTW-016 / FR-PTW-028)', () => {
    it('treats any reject as stage reject (reject precedence)', () => {
      const outcome = parallelStageOutcome(['approve', 'reject', null]);
      expect(outcome.rejected).toBe(true);
      expect(outcome.complete).toBe(true);
      expect(outcome.allApproved).toBe(false);
    });

    it('does not treat partial approve as final for all-quorum', () => {
      const outcome = parallelStageOutcome(['approve', null]);
      expect(outcome.allApproved).toBe(false);
      expect(outcome.anyApprove).toBe(true);
      expect(outcome.pendingCount).toBe(1);
      expect(outcome.complete).toBe(false);
    });

    it('marks all-approved when every decision is approve', () => {
      const outcome = parallelStageOutcome(['approve', 'approve']);
      expect(outcome.allApproved).toBe(true);
      expect(outcome.complete).toBe(true);
    });
  });
});
