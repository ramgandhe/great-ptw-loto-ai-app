import { BadRequestException } from '@nestjs/common';
import {
  assertDraftUpdateAllowed,
  assertPeopleReassignAllowed,
  assertPermitSegregationOfDuties,
  sanitizeDraftUpdateDto,
} from '../app/src/modules/permit/permit-collaboration';
import type { PermitDetail } from '../app/src/modules/permit/permit.service';
import type { AuthenticatedUser } from '../app/src/common/interfaces/authenticated-user.interface';

function operator(id = 'executor-user'): AuthenticatedUser {
  return {
    id,
    username: 'executor',
    roles: ['permit-operator'],
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
      emergencyPhone: '123',
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
      roles: ['permit-receiver'],
      tenantId: 'tenant-id',
    };

    expect(sanitizeDraftUpdateDto(issuer, dto)).toEqual(dto);
  });

  it('strips LOTOTO attach fields from permit-receiver patches', () => {
    const issuer: AuthenticatedUser = {
      id: 'issuer',
      username: 'issuer',
      roles: ['permit-receiver'],
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

describe('permit segregation of duties', () => {
  it('blocks the receiver from also being an operator', () => {
    expect(() =>
      assertPermitSegregationOfDuties({
        receiverIds: ['issuer-1'],
        executorIds: ['issuer-1'],
      }),
    ).toThrow(BadRequestException);
  });

  it('blocks an operator from also being the approver', () => {
    expect(() =>
      assertPermitSegregationOfDuties({
        receiverIds: ['issuer-1'],
        executorIds: ['op-1'],
        approverIds: ['op-1'],
      }),
    ).toThrow(BadRequestException);
  });

  it('allows a receiver who is not an operator, and an operator who is not the approver', () => {
    expect(() =>
      assertPermitSegregationOfDuties({
        receiverIds: ['issuer-1'],
        executorIds: ['op-1'],
        approverIds: ['hod-1'],
      }),
    ).not.toThrow();
  });
});

describe('Safety Approval collaboration', () => {
  it('lets an assigned safety officer save comments and a typed name', () => {
    const so: AuthenticatedUser = {
      id: 'so-1',
      username: 'safety',
      roles: ['safety-officer'],
      tenantId: 'tenant-id',
    };
    const assigned = detail();
    assigned.safetyOfficers = [
      {
        id: 'row',
        permitId: 'permit-id',
        workforceUserId: 'so-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'issuer',
        updatedBy: 'issuer',
      },
    ];
    const dto = { safetyApprovalComment: 'OK to proceed', safetyApprovalSignedName: 'A. Rao' };
    expect(sanitizeDraftUpdateDto(so, { ...dto, title: 'ignored' })).toEqual(dto);
    expect(() => assertDraftUpdateAllowed(so, assigned, dto)).not.toThrow();
    expect(() => assertDraftUpdateAllowed(so, assigned, {})).not.toThrow();
  });

  it('lets a permit approver assign safety officers only', () => {
    const hod: AuthenticatedUser = {
      id: 'hod-1',
      username: 'hod',
      roles: ['permit-approver'],
      tenantId: 'tenant-id',
    };
    const dto = { safetyOfficers: [{ workforceUserId: 'so-1' }], title: 'ignored' };
    expect(sanitizeDraftUpdateDto(hod, dto)).toEqual({ safetyOfficers: [{ workforceUserId: 'so-1' }] });
    expect(() =>
      assertDraftUpdateAllowed(hod, detail(), { safetyOfficers: [{ workforceUserId: 'so-1' }] }),
    ).not.toThrow();
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
      assertPeopleReassignAllowed({ ...operator(), roles: ['permit-approver'] }, active, true),
    ).toThrow();
  });
});
