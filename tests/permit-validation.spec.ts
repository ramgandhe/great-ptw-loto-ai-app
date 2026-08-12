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
      plantId: 'plant-id',
      departmentId: 'dept-id',
      locationId: 'location-id',
      workstationId: null,
      machineryId: null,
      plannedStartAt: new Date('2026-08-01T08:00:00Z'),
      plannedEndAt: new Date('2026-08-01T16:00:00Z'),
      submittedAt: null,
      submittedBy: null,
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
    attachments: [],
  });

  it('accepts a complete permit', () => {
    expect(() => service.validateForSubmit(baseRecord())).not.toThrow();
  });

  it('rejects submission without location', () => {
    const record = baseRecord();
    record.permit.locationId = null;

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
});
