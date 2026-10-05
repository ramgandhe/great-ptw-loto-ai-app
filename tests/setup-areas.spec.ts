import { SETUP_AREAS, SETUP_STEPS, areaOf, configurationGaps } from '../frontend/src/lib/organisation/setup';

describe('organisation setup areas (S3)', () => {
  it('puts every setup step in exactly one area', () => {
    const inAreas = SETUP_AREAS.flatMap((area) => area.steps);
    expect([...inAreas].sort()).toEqual(SETUP_STEPS.map((step) => step.key).sort());
    expect(new Set(inAreas).size).toBe(inAreas.length);
    expect(areaOf('locations')).toBe('sites');
    expect(areaOf('workflows')).toBe('people');
  });

  it('lists required steps with nothing recorded, separately from steps that could not be checked', () => {
    const measures = Object.fromEntries(SETUP_STEPS.map((step) => [step.key, step.key === 'profile' ? 1 : 1]));
    expect(configurationGaps(measures)).toEqual({ missing: [], unknown: [] });

    const { missing, unknown } = configurationGaps({ ...measures, plants: 0, machinery: 0, workflows: undefined });
    // Machinery is optional, so an empty list is not a gap; a failed read is unknown, never "missing".
    expect(missing.map((step) => step.key)).toEqual(['plants']);
    expect(unknown.map((step) => step.key)).toEqual(['workflows']);
  });

  it('treats a partly filled profile as a gap', () => {
    const measures = Object.fromEntries(SETUP_STEPS.map((step) => [step.key, 1]));
    expect(configurationGaps({ ...measures, profile: 2 / 3 }).missing.map((step) => step.key)).toEqual(['profile']);
  });
});
