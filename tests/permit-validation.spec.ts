import { BadRequestException } from '@nestjs/common';
import { PermitValidationService } from '../app/src/modules/permit/permit-validation.service';
import type { PermitSubmissionRecord } from '../app/src/modules/permit/permit-validation.service';

describe('PermitValidationService', () => {
  const service = new PermitValidationService();

  const baseRecord = (): PermitSubmissionRecord => ({
    permit: {
      id: 'permit-id',
      tenantId: 'tenant-id',
      reference: null,
      status: 'draft',
      permitTypeId: 'type-id',
      title: 'Hot work',
      workScope: 'Welding',
      siteNotes: null,
      emergencyPhone: null,
      safetyApprovalComment: null,
      safetyApprovalSignedName: null,
      safetyApprovedBy: null,
      safetyApprovedAt: null,
      plantId: 'plant-id',
      departmentId: 'dept-id',
      locationId: 'location-id',
      workstationId: 'workstation-id',
      machineryId: null,
      siteId: 'site-id',
      workLocationId: 'work-location-id',
      exactSpot: null,
      placePath: null,
      lototoRequired: false,
      gasTestingRequired: false,
      plannedStartAt: new Date('2026-08-01T08:00:00Z'),
      plannedEndAt: new Date('2026-08-01T16:00:00Z'),
      submittedAt: null,
      submittedBy: null,
      submittedSignedName: null,
      permitVersion: 1,
      permitVersionAt: null,
      approvedAt: null,
      approvedBy: null,
      approvedSignedName: null,
      receiverSiteVisited: false,
      executorSiteVisited: false,
      safetyOfficerSiteVisited: false,
      approverSiteVisited: false,
      executionStart: {},
      formResponses: [],
      draftRevision: 0,
      draftHolder: 'receiver',
      draftHeldBy: null,
      draftReturnReason: null,
      renewedFromPermitId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-id',
      updatedBy: 'user-id',
    },
    hazards: [
      {
        id: 'hazard-id',
        permitId: 'permit-id',
        hazardCategoryId: 'hazard-cat-id',
        description: null,
        extraConsequences: [],
        extraRisks: [],
        extraControls: [],
        omittedConsequences: [],
        omittedRisks: [],
        omittedControls: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
      },
    ],
    ppe: [
      {
        id: 'ppe-id',
        permitId: 'permit-id',
        ppeCatalogueId: 'ppe-cat-id',
        quantity: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
      },
    ],
    lototo: [],
    gasTesting: [],
    executors: [
      {
        id: 'executor-id',
        permitId: 'permit-id',
        workforceUserId: 'workforce-id',
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
      },
    ],
    safetyOfficers: [],
    attachments: [],
  });

  it('accepts a complete permit', () => {
    expect(() => service.validateForSubmit(baseRecord())).not.toThrow();
  });

  it('rejects submission without a site', () => {
    const record = baseRecord();
    record.permit.siteId = null;

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });

  it('rejects submission without a work location', () => {
    const record = baseRecord();
    record.permit.workLocationId = null;

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });

  it('rejects submission without executors', () => {
    const record = baseRecord();
    record.executors = [];

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });

  it('rejects invalid date range', () => {
    const record = baseRecord();
    record.permit.plannedEndAt = new Date('2026-08-01T07:00:00Z');

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });

  it('allows LOTOTO required for a work location with no asset', () => {
    const record = baseRecord();
    record.permit.lototoRequired = true;
    record.assetIds = [];
    record.lototo = [
      {
        id: 'instance-id',
        procedureId: 'procedure-id',
        procedureVersionId: 'version-id',
        frozenAt: null,
        extraPoints: [],
        stepNa: [],
        crew: [{ workforceUserId: 'crew-id' }],
        verifiers: [{ workforceUserId: 'verifier-id' }],
        verification: [],
      },
    ];

    expect(() => service.validateForSubmit(record)).not.toThrow();
  });

  it('rejects LOTOTO required without a procedure', () => {
    const record = baseRecord();
    record.permit.lototoRequired = true;
    record.assetIds = ['asset-id'];
    record.lototo = [];

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });

  it('rejects LOTOTO required without crew and verifiers', () => {
    const record = baseRecord();
    record.permit.lototoRequired = true;
    record.permit.machineryId = 'machinery-id';
    record.lototo = [
      {
        id: 'instance-id',
        procedureId: 'procedure-id',
        procedureVersionId: 'version-id',
        frozenAt: null,
        extraPoints: [],
        stepNa: [],
        crew: [],
        verifiers: [],
        verification: [],
      },
    ];

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });

  it('rejects submit when a safety officer is assigned without Safety Approval', () => {
    const record = baseRecord();
    record.safetyOfficers = [
      {
        id: 'so-row',
        permitId: 'permit-id',
        workforceUserId: 'so-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-id',
        updatedBy: 'user-id',
      },
    ];

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);

    record.permit.safetyApprovalComment = 'Controls verified';
    record.permit.safetyApprovalSignedName = 'A. Rao';
    expect(() => service.validateForSubmit(record)).not.toThrow();
  });

  it('rejects gas testing required without an item', () => {
    const record = baseRecord();
    record.permit.gasTestingRequired = true;
    record.gasTesting = [];

    expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
  });
});
