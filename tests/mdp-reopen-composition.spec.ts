import {
  buildSiteSecurityTemplate,
  decideReopenModules,
  evaluateGasReadings,
  evaluateReopenComposition,
  SITE_SECURITY_CHECK_KEYS,
} from '../app/src/modules/revalidation/multi-day-reopen-composition';

describe('MDP reopen composition (Slice G)', () => {
  const siteAllTrue = Object.fromEntries(SITE_SECURITY_CHECK_KEYS.map((key) => [key, true]));

  it('G1: always includes site security when daily audit ON', () => {
    const modules = decideReopenModules({
      permitId: 'p1',
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
    });
    expect(modules.map((m) => m.key)).toEqual(['site_security']);
    expect(buildSiteSecurityTemplate()).toHaveLength(SITE_SECURITY_CHECK_KEYS.length);
  });

  it('G1: omits site security when daily audit OFF', () => {
    const modules = decideReopenModules({
      permitId: 'p1',
      dailyRevalidationRequired: false,
      gasTestingRequired: false,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
    });
    expect(modules).toEqual([]);
  });

  it('G2: gas required blocks without readings / confirm', () => {
    const gasItems = [
      {
        gasTestingCatalogueId: 'g1',
        parameter: 'O2',
        minimum: 19.5,
        maximum: 23.5,
        unit: '%',
      },
    ];
    const missing = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: true,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
      gasItems,
      checklist: { ...siteAllTrue },
    });
    expect(missing.ok).toBe(false);
    expect(missing.missing.some((m) => /O2|gas/i.test(m))).toBe(true);

    const coldWork = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
      gasItems: [],
      checklist: { ...siteAllTrue },
    });
    expect(coldWork.ok).toBe(true);

    expect(
      evaluateGasReadings({
        items: gasItems,
        readings: [{ gasTestingCatalogueId: 'g1', value: 20.9 }],
      }),
    ).toEqual([]);
    expect(
      evaluateGasReadings({
        items: gasItems,
        readings: [{ gasTestingCatalogueId: 'g1', value: 10 }],
      }).length,
    ).toBeGreaterThan(0);
  });

  it('G3: LOTOTO integrity required when isolations open', () => {
    const blocked = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: true,
      unresolvedSimopsCount: 0,
      gasItems: [],
      openIsolationCount: 2,
      checklist: { ...siteAllTrue },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.missing.join(' ')).toMatch(/LOTOTO/i);
    expect(blocked.missing.join(' ')).toMatch(/2 open/);

    const ok = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: true,
      unresolvedSimopsCount: 0,
      gasItems: [],
      openIsolationCount: 2,
      checklist: { ...siteAllTrue, lototoIntegrityConfirmed: true },
    });
    expect(ok.ok).toBe(true);
  });

  it('C10: gas tick alone blocked when live catalogue empty', () => {
    const blocked = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: true,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
      gasItems: [],
      checklist: { ...siteAllTrue, gasConfirmedToday: true },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.missing.join(' ')).toMatch(/catalogue|live items/i);
  });

  it('G4: unresolved SIMOPS blocks clear', () => {
    const blocked = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 2,
      gasItems: [],
      checklist: { ...siteAllTrue },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.missing.join(' ')).toMatch(/SIMOPS/i);
  });

  it('G2+G5: full pass with gas readings and confirm', () => {
    const result = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: true,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
      gasItems: [
        {
          gasTestingCatalogueId: 'g1',
          parameter: 'O2',
          minimum: 19.5,
          maximum: 23.5,
          unit: '%',
        },
      ],
      checklist: {
        ...siteAllTrue,
        gasConfirmedToday: true,
        gasReadings: [{ gasTestingCatalogueId: 'g1', value: 20.8 }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.modules.find((m) => m.key === 'gas')?.href).toContain('/execution/');
  });
});
