import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveApprovalMultiDayPolicy } from '../app/src/modules/approval/multi-day-approval-policy';
import {
  MDP_CHECKLIST_SEED_CODES,
  MDP_CHECKLIST_SEEDS,
} from '../app/src/modules/revalidation/mdp-checklist-library';

describe('MDP Slice J — ops polish', () => {
  it('J2: checklist library seeds cover secure light/full and reopen', () => {
    expect(MDP_CHECKLIST_SEEDS.map((s) => s.code)).toEqual([
      MDP_CHECKLIST_SEED_CODES.daySecureLight,
      MDP_CHECKLIST_SEED_CODES.daySecureFull,
      MDP_CHECKLIST_SEED_CODES.reopenSite,
    ]);
    expect(MDP_CHECKLIST_SEEDS.every((s) => s.items.length > 0)).toBe(true);
  });

  it('J3: permit-type forceDailyRevalidation locks daily audit ON', () => {
    const locked = resolveApprovalMultiDayPolicy(true, {
      dailyRevalidationRequired: false,
      forceDailyRevalidation: true,
    });
    expect(locked?.dailyRevalidationRequired).toBe(true);

    const unlocked = resolveApprovalMultiDayPolicy(true, {
      dailyRevalidationRequired: false,
      forceDailyRevalidation: false,
    });
    expect(unlocked?.dailyRevalidationRequired).toBe(false);
  });

  it('J3: non-multi-day still returns null policy', () => {
    expect(
      resolveApprovalMultiDayPolicy(false, { forceDailyRevalidation: true }),
    ).toBeNull();
  });

  it('J5: offline conflict rules are declared on mobile MDP offline helper', () => {
    const source = readFileSync(
      join(__dirname, '../mobile/src/lib/multi-day/offline.ts'),
      'utf8',
    );
    expect(source).toContain('day_secure_unique_per_operational_date');
    expect(source).toContain('handover_accept_requires_pending');
    expect(source).toContain('queueOfflineReopen');
    expect(source).toContain('queueOfflineHandoverAccept');
  });
});
