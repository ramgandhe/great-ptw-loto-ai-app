import { hazardFitsPermitType } from '../app/src/modules/master-data/default-hazards';

describe('hazardFitsPermitType', () => {
  it('offers unscoped hazards on every type', () => {
    expect(hazardFitsPermitType([], 'HOT')).toBe(true);
    expect(hazardFitsPermitType(undefined, 'HOT')).toBe(true);
  });

  it('offers a scoped hazard only on its associated types', () => {
    expect(hazardFitsPermitType(['HOT', 'ELEC'], 'HOT')).toBe(true);
    expect(hazardFitsPermitType(['HOT', 'ELEC'], 'EXC')).toBe(false);
  });
});
