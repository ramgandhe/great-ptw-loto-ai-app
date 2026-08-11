import {
  HOD_FINAL_CLOSURE_ACTION,
  HOD_INITIAL_REVIEW_ACTION,
  userHasHodRole,
} from '../app/src/modules/approval/approval.constants';
import { HOD_FINAL_CLOSURE_ACTION as CLOSURE_HOD_ACTION } from '../app/src/modules/closure/closure.constants';

describe('FR-ROL-001 HOD dual decision distinctness (PUS-243)', () => {
  it('maps org-admin as HOD until dedicated hod role exists', () => {
    expect(userHasHodRole(['org-admin'])).toBe(true);
    expect(userHasHodRole(['supervisor'])).toBe(false);
    expect(userHasHodRole(['platform-admin'])).toBe(false);
  });

  it('uses distinct action tokens for initial review vs final closure', () => {
    expect(HOD_INITIAL_REVIEW_ACTION).toBe('hod_initial_review');
    expect(HOD_FINAL_CLOSURE_ACTION).toBe('hod_final_closure');
    expect(CLOSURE_HOD_ACTION).toBe('hod_final_closure');
    expect(HOD_INITIAL_REVIEW_ACTION).not.toBe(HOD_FINAL_CLOSURE_ACTION);
  });

  it('produces separately named audit actions for the same HOD actor', () => {
    const initialAudit = `permit.${HOD_INITIAL_REVIEW_ACTION}`;
    const finalAudit = `permit.${HOD_FINAL_CLOSURE_ACTION}`;

    expect(initialAudit).toBe('permit.hod_initial_review');
    expect(finalAudit).toBe('permit.hod_final_closure');
    expect(initialAudit).not.toBe(finalAudit);
  });
});
