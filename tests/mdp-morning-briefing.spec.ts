import {
  canMutateUnderCustody,
  resolveActiveCustodyHolder,
} from '../app/src/modules/daily-progress/mdp-custody';
import {
  evaluateDailyCrewGate,
  evaluatePpeHazardReconfirm,
  evaluateToolboxTalkGate,
  isDailyCrewRequiredForClear,
  isPpeHazardReconfirmRequired,
  isToolboxTalkRequiredForClear,
} from '../app/src/modules/daily-progress/morning-briefing';
import { evaluateReopenComposition } from '../app/src/modules/revalidation/multi-day-reopen-composition';
import { SITE_SECURITY_CHECK_KEYS } from '../app/src/modules/revalidation/multi-day-reopen-composition';

describe('Wave 2–3 morning briefing + custody', () => {
  const siteAllTrue = Object.fromEntries(SITE_SECURITY_CHECK_KEYS.map((key) => [key, true]));

  it('requires TBT/crew/PPE only when audit + org policy ON', () => {
    expect(
      isToolboxTalkRequiredForClear({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        dailyToolboxTalkRequired: true,
      }),
    ).toBe(true);
    expect(
      isDailyCrewRequiredForClear({
        isMultiDay: true,
        dailyRevalidationRequired: false,
        dailyCrewRosterRequired: true,
      }),
    ).toBe(false);
    expect(
      isPpeHazardReconfirmRequired({
        isMultiDay: true,
        dailyRevalidationRequired: true,
        dailyPpeHazardReconfirm: true,
      }),
    ).toBe(true);
  });

  it('gates toolbox talk and crew roster', () => {
    expect(evaluateToolboxTalkGate({ required: true, talkRecorded: false })).toHaveLength(1);
    expect(evaluateToolboxTalkGate({ required: true, talkRecorded: true })).toEqual([]);
    expect(evaluateDailyCrewGate({ required: true, crewCount: 0 })).toHaveLength(1);
    expect(
      evaluateDailyCrewGate({
        required: true,
        crewCount: 1,
        attendeeUserIds: ['a'],
        rosterUserIds: ['b'],
      }),
    ).toHaveLength(1);
    expect(
      evaluateDailyCrewGate({
        required: true,
        crewCount: 2,
        attendeeUserIds: ['a'],
        rosterUserIds: ['a', 'b'],
      }),
    ).toEqual([]);
  });

  it('gates PPE/hazard reconfirm from checklist', () => {
    expect(
      evaluatePpeHazardReconfirm({
        required: true,
        checklist: {},
        requiredHazardKeys: ['hazard:h1'],
        requiredPpeIds: ['ppe1'],
      }).length,
    ).toBeGreaterThan(0);

    expect(
      evaluatePpeHazardReconfirm({
        required: true,
        checklist: {
          ppeHazardReconfirmedToday: true,
          confirmedHazardKeys: ['hazard:h1'],
          confirmedPpeIds: ['ppe1'],
        },
        requiredHazardKeys: ['hazard:h1'],
        requiredPpeIds: ['ppe1'],
      }),
    ).toEqual([]);
  });

  it('blocks reopen clear when TBT/crew modules unsatisfied', () => {
    const blocked = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
      gasItems: [],
      toolboxTalkRequired: true,
      crewRosterRequired: true,
      ppeHazardReconfirmRequired: true,
      talkRecorded: false,
      crewCount: 0,
      requiredHazardKeys: [],
      requiredPpeIds: [],
      checklist: { ...siteAllTrue },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.missing.join(' ')).toMatch(/toolbox|crew|PPE|hazard/i);

    const ok = evaluateReopenComposition({
      dailyRevalidationRequired: true,
      gasTestingRequired: false,
      openIsolationsRemain: false,
      unresolvedSimopsCount: 0,
      gasItems: [],
      toolboxTalkRequired: true,
      crewRosterRequired: true,
      ppeHazardReconfirmRequired: true,
      talkRecorded: true,
      crewCount: 1,
      rosterUserIds: ['u1'],
      attendeeUserIds: ['u1'],
      requiredHazardKeys: [],
      requiredPpeIds: [],
      checklist: { ...siteAllTrue, ppeHazardReconfirmedToday: true },
    });
    expect(ok.ok).toBe(true);
  });

  it('enforces hard custody for non-holders without bypass role', () => {
    const holder = resolveActiveCustodyHolder([
      {
        status: 'accepted',
        outgoingUserId: 'out',
        incomingUserId: 'in',
        handedOverAt: new Date('2026-08-04T08:00:00Z'),
      },
    ]);
    expect(holder).toBe('in');

    expect(
      canMutateUnderCustody({
        actorId: 'other',
        roles: ['permit-operator'],
        custodyHeldBy: 'in',
        hardCustodyEnforced: true,
      }),
    ).toBe(false);

    expect(
      canMutateUnderCustody({
        actorId: 'other',
        roles: ['permit-approver'],
        custodyHeldBy: 'in',
        hardCustodyEnforced: true,
      }),
    ).toBe(true);

    expect(
      canMutateUnderCustody({
        actorId: 'in',
        roles: ['permit-operator'],
        custodyHeldBy: 'in',
        hardCustodyEnforced: true,
      }),
    ).toBe(true);
  });
});
