import { canAccessPath } from '../frontend/src/lib/auth/rbac';

describe('permit route access for assigned people', () => {
  it('lets a safety officer open the draft editor for Safety Approval', () => {
    expect(canAccessPath('/permits/abc/edit', ['safety-officer'])).toBe(true);
    expect(canAccessPath('/permits/abc', ['safety-officer'])).toBe(true);
    expect(canAccessPath('/dashboard', ['safety-officer'])).toBe(true);
  });

  it('lets a permit operator open a draft they were assigned to', () => {
    expect(canAccessPath('/permits/abc/edit', ['permit-operator'])).toBe(true);
  });
});
