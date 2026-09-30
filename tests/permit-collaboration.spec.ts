import {
  assertDraftUpdateAllowed,
  assertPeopleReassignAllowed,
  sanitizeDraftUpdateDto,
} from '../app/src/modules/permit/permit-collaboration';
import type { PermitDetail } from '../app/src/modules/permit/permit.service';
import type { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';

function operator(id = 'executor-user'): AuthenticatedUser {
  return {
    id,
    username: 'executor',
    roles: ['operator'],
    tenantId: 'tenant-id',
  };
}

function detail(assignedUserId = 'executor-user'): PermitDetail {
  return {
    permit: { id: 'permit-id', tenantId: 'tenant-id', status: 'draft' } as PermitDetail['permit'],
    draft: null,
    hazards: [],
    ppe: [],
    lototo: [],
    gasTesting: [],
    executors: [
      {
        id: 'row-id',
        permitId: 'permit-id',
        workforceUserId: assignedUserId,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'issuer',
        updatedBy: 'issuer',
      },
    ],
    attachments: [],
    viewers: [],
    safetyOfficers: [],
  };
}

describe('sanitizeDraftUpdateDto', () => {
  it('strips issuer fields from operator patches so assigned executors can save site details', () => {
    const sanitized = sanitizeDraftUpdateDto(operator(), {
      title: 'Hot work',
      permitTypeId: 'type-id',
      plannedStartAt: new Date('2026-08-01T08:00:00Z'),
      workstationId: 'ws-id',
      hazards: [{ hazardCategoryId: 'h1' }],
    });

    expect(sanitized).toEqual({
      workstationId: 'ws-id',
      hazards: [{ hazardCategoryId: 'h1' }],
    });

    expect(() =>
      assertDraftUpdateAllowed(operator(), detail(), sanitized),
    ).not.toThrow();
  });

  it('leaves issuer patches unchanged', () => {
    const dto = { title: 'Hot work', workstationId: 'ws-id' };
    const issuer: AuthenticatedUser = {
      id: 'issuer',
      username: 'issuer',
      roles: ['job-issuer'],
      tenantId: 'tenant-id',
    };

    expect(sanitizeDraftUpdateDto(issuer, dto)).toEqual(dto);
  });

  it('strips LOTOTO attach fields from job-issuer patches', () => {
    const issuer: AuthenticatedUser = {
      id: 'issuer',
      username: 'issuer',
      roles: ['job-issuer'],
      tenantId: 'tenant-id',
    };

    expect(
      sanitizeDraftUpdateDto(issuer, {
        title: 'Hot work',
        lototoRequired: true,
        lototo: [{ procedureId: 'proc-id' }],
      }),
    ).toEqual({ title: 'Hot work' });
  });
});

describe('people reassignment before work starts', () => {
  it('lets an assigned executor change LOTOTO people on an approved permit', () => {
    const approved = detail();
    approved.permit = { ...approved.permit, status: 'approved' };
    expect(() => assertPeopleReassignAllowed(operator(), approved, false)).not.toThrow();
  });

  it('blocks an executor from changing job executors', () => {
    const approved = detail();
    approved.permit = { ...approved.permit, status: 'approved' };
    expect(() => assertPeopleReassignAllowed(operator(), approved, true)).toThrow();
  });

  it('blocks reassignment after work has started', () => {
    const active = detail();
    active.permit = { ...active.permit, status: 'active' };
    expect(() =>
      assertPeopleReassignAllowed({ ...operator(), roles: ['hod'] }, active, true),
    ).toThrow();
  });
});
