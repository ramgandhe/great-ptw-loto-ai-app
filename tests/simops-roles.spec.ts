import {
  SIMOPS_READ_ROLES,
  SIMOPS_RESOLVE_ROLES,
  SIMOPS_WRITE_ROLES,
} from '../app/src/modules/simops/simops.constants';

describe('SIMOPS role access', () => {
  it('lets safety officers review conflicts', () => {
    expect(SIMOPS_READ_ROLES).toContain('safety-officer');
  });

  it('keeps analysis and resolution with HOD and tenant administrators', () => {
    expect(SIMOPS_WRITE_ROLES).not.toContain('safety-officer');
    expect(SIMOPS_RESOLVE_ROLES).not.toContain('safety-officer');
  });
});
