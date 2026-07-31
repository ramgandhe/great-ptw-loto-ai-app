import { RiskCalculationService } from '../app/src/modules/simops/risk-calculation.service';

describe('RiskCalculationService (PUS-166)', () => {
  const risk = new RiskCalculationService();

  it('returns high severity for hot-work vs confined-space', () => {
    expect(risk.permitTypeInteractionSeverity('HOT-WORK', 'CONFINED-SPACE')).toBe('high');
  });

  it('returns null when types match or are unknown', () => {
    expect(risk.permitTypeInteractionSeverity('HOT-WORK', 'HOT-WORK')).toBeNull();
    expect(risk.permitTypeInteractionSeverity('HOT-WORK', 'COLD-WORK')).toBeNull();
  });

  it('picks the maximum severity', () => {
    expect(risk.maxSeverity('low', 'high', 'medium')).toBe('high');
  });

  it('prioritises equipment over schedule for primary type', () => {
    expect(risk.primaryType(['schedule', 'equipment', 'location'])).toBe('equipment');
  });
});
