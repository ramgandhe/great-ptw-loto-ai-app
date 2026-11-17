import {
  DAY_SECURE_FULL_KEYS,
  DAY_SECURE_LIGHT_KEYS,
  buildDaySecureChecklistDefaults,
  buildDaySecureChecklistTemplate,
  missingDaySecureChecklistKeys,
  resolveDaySecureChecklistMode,
} from '../app/src/modules/daily-progress/day-secure-checklist';

describe('day-secure checklist (B3)', () => {
  it('uses light mode when daily audit OFF', () => {
    expect(resolveDaySecureChecklistMode(false)).toBe('light');
    const template = buildDaySecureChecklistTemplate(false);
    expect(template.mode).toBe('light');
    expect(template.requiredKeys).toEqual([...DAY_SECURE_LIGHT_KEYS]);
    expect(template.items.every((i) => i.required)).toBe(true);
    expect(template.items.some((i) => i.key === 'personnelCleared')).toBe(true);
    expect(template.items.some((i) => i.key === 'isolationsIntact')).toBe(false);
  });

  it('uses full mode when daily audit ON', () => {
    expect(resolveDaySecureChecklistMode(true)).toBe('full');
    const template = buildDaySecureChecklistTemplate(true);
    expect(template.mode).toBe('full');
    expect(template.requiredKeys).toEqual([...DAY_SECURE_FULL_KEYS]);
    expect(template.items.some((i) => i.key === 'overnightHazardsNoted')).toBe(true);
  });

  it('defaults all required keys to false', () => {
    const light = buildDaySecureChecklistDefaults(false);
    expect(light.mode).toBe('light');
    expect(light.personnelCleared).toBe(false);
    expect(light.isolationsIntact).toBeUndefined();

    const full = buildDaySecureChecklistDefaults(true);
    expect(full.mode).toBe('full');
    expect(full.isolationsIntact).toBe(false);
  });

  it('reports missing keys until all required answers are true', () => {
    expect(
      missingDaySecureChecklistKeys(false, { workAreaLeftSafe: true }, false),
    ).toEqual(expect.arrayContaining(['personnelCleared', 'materialsToolsSecured']));

    expect(
      missingDaySecureChecklistKeys(
        false,
        { workAreaLeftSafe: true, materialsToolsSecured: true },
        true,
      ),
    ).toEqual([]);

    expect(
      missingDaySecureChecklistKeys(
        true,
        {
          workAreaLeftSafe: true,
          materialsToolsSecured: true,
          isolationsIntact: true,
          openingsBarricaded: true,
          emergencyAccessClear: true,
        },
        true,
      ),
    ).toEqual(['overnightHazardsNoted']);
  });
});
