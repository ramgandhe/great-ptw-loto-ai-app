import { APPROVAL_APPROVER_ROLES, isApprovalApproverRole } from '../app/src/modules/approval/default-workflow';

describe('platform default approval workflow', () => {
  it('treats HOD as a valid approver role', () => {
    expect(isApprovalApproverRole('hod')).toBe(true);
    expect(APPROVAL_APPROVER_ROLES).toContain('hod');
  });

  it('rejects unknown approver roles', () => {
    expect(isApprovalApproverRole('operator')).toBe(false);
    expect(isApprovalApproverRole('tenant-admin')).toBe(false);
  });
});
