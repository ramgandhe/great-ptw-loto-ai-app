import { APPROVAL_APPROVER_ROLES, isApprovalApproverRole } from '../app/src/modules/approval/default-workflow';

describe('platform default approval workflow', () => {
  it('treats HOD as a valid approver role', () => {
    expect(isApprovalApproverRole('permit-approver')).toBe(true);
    expect(APPROVAL_APPROVER_ROLES).toContain('permit-approver');
  });

  it('rejects unknown approver roles', () => {
    expect(isApprovalApproverRole('permit-operator')).toBe(false);
    expect(isApprovalApproverRole('tenant-admin')).toBe(false);
  });
});
