import {
  assertDraftUpdateAllowed,
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
});
