import {
  buildWorkResumeChecklistTemplate,
  missingWorkResumeChecklistKeys,
} from '../app/src/modules/execution/work-resume-checklist';

describe('work-resume-checklist', () => {
  it('uses minimal keys when daily audit is off', () => {
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired: false,
      lototoRequired: false,
      reisolateRequired: false,
    });
    expect(template.mode).toBe('minimal');
    expect(template.items.map((i) => i.key)).toEqual(['safeToContinue', 'toolboxTalkConfirmed']);
  });

  it('requires a toolbox talk tick on every resume', () => {
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired: true,
      lototoRequired: false,
      reisolateRequired: false,
    });
    const item = template.items.find((row) => row.key === 'toolboxTalkConfirmed');
    expect(item?.required).toBe(true);
    const missing = missingWorkResumeChecklistKeys(template, {
      workAreaInspected: true,
      barriersSignageIntact: true,
      emergencyRoutesClear: true,
      personnelAccounted: true,
      overnightChangesReviewed: true,
      safeToContinue: true,
    });
    expect(missing.some((label) => /toolbox talk/i.test(label))).toBe(true);
  });

  it('audit ON includes site security and overnight review', () => {
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired: true,
      lototoRequired: true,
      reisolateRequired: false,
    });
    expect(template.mode).toBe('full');
    expect(template.items.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        'workAreaInspected',
        'overnightChangesReviewed',
        'safeToContinue',
        'lototoIntegrityConfirmed',
      ]),
    );
  });

  it('requires LOTOTO reisolate ack when flagged', () => {
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired: true,
      lototoRequired: true,
      reisolateRequired: true,
    });
    expect(template.items.some((i) => i.key === 'lototoReisolated')).toBe(true);
    expect(template.items.some((i) => i.key === 'lototoIntegrityConfirmed')).toBe(false);
    const missing = missingWorkResumeChecklistKeys(template, {
      workAreaInspected: true,
      barriersSignageIntact: true,
      emergencyRoutesClear: true,
      personnelAccounted: true,
      overnightChangesReviewed: true,
      safeToContinue: true,
    });
    expect(missing.some((label) => label.toLowerCase().includes('re-isolation'))).toBe(true);
  });

  it('blocks resume when SIMOPS unresolved', () => {
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired: true,
      lototoRequired: false,
      reisolateRequired: false,
      simopsBlocked: true,
      simopsBlockReason: '2 unresolved SIMOPS',
    });
    const missing = missingWorkResumeChecklistKeys(template, {
      workAreaInspected: true,
      barriersSignageIntact: true,
      emergencyRoutesClear: true,
      personnelAccounted: true,
      overnightChangesReviewed: true,
      safeToContinue: true,
    });
    expect(missing[0]).toMatch(/SIMOPS/i);
  });

  it('includes PPE and gas when required under audit ON', () => {
    const template = buildWorkResumeChecklistTemplate({
      dailyRevalidationRequired: true,
      lototoRequired: false,
      reisolateRequired: false,
      ppeHazardReconfirmRequired: true,
      gasTestingRequired: true,
    });
    expect(template.items.map((i) => i.key)).toEqual(
      expect.arrayContaining(['ppeHazardReconfirmed', 'gasConfirmedToday']),
    );
  });
});
