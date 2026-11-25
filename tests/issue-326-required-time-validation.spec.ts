import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import {
  parseLocalDateTime,
  combineLocalDateTime,
  formatLocalDateTimeLabel,
  hasTimeComponent,
} from '@/lib/datetime';
import { createEmptyPermitForm, validateStep, formToSavePayload } from '@/lib/permit/form';
import { CreatePermitDto } from '../app/src/modules/permit/dto/create-permit.dto';
import { UpdatePermitDto } from '../app/src/modules/permit/dto/update-permit.dto';
import { PermitValidationService } from '../app/src/modules/permit/permit-validation.service';
import type { PermitSubmissionRecord } from '../app/src/modules/permit/permit-validation.service';

describe('Issue #326 - Required time validation', () => {
  describe('Datetime helpers (parseLocalDateTime, combineLocalDateTime, hasTimeComponent)', () => {
    it('parses empty, date-only, and date-time values', () => {
      expect(parseLocalDateTime('')).toEqual({ date: '', time: '' });
      expect(parseLocalDateTime('2026-11-25')).toEqual({ date: '2026-11-25', time: '' });
      expect(parseLocalDateTime('2026-11-25T14:30')).toEqual({ date: '2026-11-25', time: '14:30' });
      expect(parseLocalDateTime('invalid')).toEqual({ date: '', time: '' });
    });

    it('identifies whether a time component is present', () => {
      expect(hasTimeComponent('')).toBe(false);
      expect(hasTimeComponent(null)).toBe(false);
      expect(hasTimeComponent(undefined)).toBe(false);
      expect(hasTimeComponent('2026-11-25')).toBe(false);
      expect(hasTimeComponent('2026-11-25T08:00')).toBe(true);
      expect(hasTimeComponent('2026-11-25T08:00:00.000Z')).toBe(true);
    });

    it('combines date and time without dropping date when time is empty', () => {
      expect(combineLocalDateTime('2026-11-25', '08:00')).toBe('2026-11-25T08:00');
      expect(combineLocalDateTime('2026-11-25', '')).toBe('2026-11-25');
      expect(combineLocalDateTime('', '08:00')).toBe('');
      expect(combineLocalDateTime('', '')).toBe('');
    });

    it('formats date-only and date-time labels correctly', () => {
      expect(formatLocalDateTimeLabel('')).toBe('');
      expect(formatLocalDateTimeLabel('2026-11-25')).toMatch(/25/);
      expect(formatLocalDateTimeLabel('2026-11-25')).not.toContain('08:00');
      expect(formatLocalDateTimeLabel('2026-11-25T08:00')).toMatch(/25.*08:00/);
    });
  });

  describe('Client validateStep enforcement for Place and schedule (Step 1)', () => {
    const baseForm = () => {
      const f = createEmptyPermitForm();
      f.siteId = 'site-1';
      f.workLocationId = 'loc-1';
      f.executors = [{ workforceUserId: 'exec-1', isPrimary: true }];
      return f;
    };

    it('rejects step 1 when start date and time are completely missing', () => {
      const form = baseForm();
      form.plannedStartAt = '';
      form.plannedEndAt = '2026-11-25T16:00';
      const errors = validateStep(form, 1);
      expect(errors).toContain('Planned start date and time are required');
    });

    it('rejects step 1 when end date and time are completely missing', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25T08:00';
      form.plannedEndAt = '';
      const errors = validateStep(form, 1);
      expect(errors).toContain('Planned end date and time are required');
    });

    it('rejects step 1 when start date is provided without required time', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25';
      form.plannedEndAt = '2026-11-25T16:00';
      const errors = validateStep(form, 1);
      expect(errors).toContain('Planned start time is required');
      expect(errors).not.toContain('Planned start date and time are required');
    });

    it('rejects step 1 when end date is provided without required time', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25T08:00';
      form.plannedEndAt = '2026-11-25';
      const errors = validateStep(form, 1);
      expect(errors).toContain('Planned end time is required');
      expect(errors).not.toContain('Planned end date and time are required');
    });

    it('rejects step 1 when end time is before or equal to start time', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25T10:00';
      form.plannedEndAt = '2026-11-25T09:00';
      const errors = validateStep(form, 1);
      expect(errors).toContain('Planned end must be after planned start');

      form.plannedEndAt = '2026-11-25T10:00';
      const equalErrors = validateStep(form, 1);
      expect(equalErrors).toContain('Planned end must be after planned start');
    });

    it('accepts step 1 when both start and end have valid date and time', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25T08:00';
      form.plannedEndAt = '2026-11-25T16:00';
      const errors = validateStep(form, 1);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Backend DTO class-validator enforcement', () => {
    it('rejects CreatePermitDto when plannedStartAt is date-only without required time', async () => {
      const dto = plainToInstance(CreatePermitDto, {
        permitTypeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: 'Hot work: Unit 3',
        plannedStartAt: '2026-11-25',
      });
      const errors = await validate(dto);
      const startErr = errors.find((e) => e.property === 'plannedStartAt');
      expect(startErr).toBeDefined();
      expect(Object.values(startErr!.constraints!)).toContain(
        'plannedStartAt must be a valid date and time',
      );
    });

    it('rejects CreatePermitDto when plannedEndAt is date-only without required time', async () => {
      const dto = plainToInstance(CreatePermitDto, {
        permitTypeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: 'Hot work: Unit 3',
        plannedEndAt: '2026-11-25',
      });
      const errors = await validate(dto);
      const endErr = errors.find((e) => e.property === 'plannedEndAt');
      expect(endErr).toBeDefined();
      expect(Object.values(endErr!.constraints!)).toContain(
        'plannedEndAt must be a valid date and time',
      );
    });

    it('accepts CreatePermitDto when date-time string includes required time', async () => {
      const dto = plainToInstance(CreatePermitDto, {
        permitTypeId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: 'Hot work: Unit 3',
        plannedStartAt: '2026-11-25T08:00:00.000Z',
        plannedEndAt: '2026-11-25T16:00:00.000Z',
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'plannedStartAt' || e.property === 'plannedEndAt')).toHaveLength(0);
    });

    it('rejects UpdatePermitDto when plannedStartAt or plannedEndAt is date-only', async () => {
      const dto = plainToInstance(UpdatePermitDto, {
        plannedStartAt: '2026-11-25',
        plannedEndAt: '2026-11-25',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'plannedStartAt')).toBe(true);
      expect(errors.some((e) => e.property === 'plannedEndAt')).toBe(true);
    });
  });

  describe('PermitValidationService submit validation', () => {
    const service = new PermitValidationService();
    const validRecord = (): PermitSubmissionRecord => ({
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
        dailyRevalidationRequired: true,
        emergencyOverrideAllowed: true,
        submittedAt: null,
        submittedBy: null,
        submittedSignedName: null,
        permitVersion: 1,
        permitVersionAt: null,
        approvedAt: null,
        approvedBy: null,
        approvedSignedName: null,
        executionReleasedAt: null,
        executionReleasedBy: null,
        executionReleaseSiteReady: false,
        executionReleaseDetailsCorrect: false,
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
          customKey: null,
          customName: null,
          customDescription: null,
          catalogueRequest: 'none',
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

    it('rejects submission with missing plannedStartAt', () => {
      const record = validRecord();
      record.permit.plannedStartAt = null;
      expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
    });

    it('rejects submission with missing plannedEndAt', () => {
      const record = validRecord();
      record.permit.plannedEndAt = null;
      expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
    });

    it('rejects submission with Invalid Date (NaN)', () => {
      const record = validRecord();
      record.permit.plannedStartAt = new Date(NaN);
      expect(() => service.validateForSubmit(record)).toThrow(BadRequestException);
    });

    it('accepts submission with valid start and end dates with time', () => {
      const record = validRecord();
      expect(() => service.validateForSubmit(record)).not.toThrow();
    });
  });

  describe('formToSavePayload draft date handling', () => {
    const baseForm = () => {
      const f = createEmptyPermitForm();
      f.title = 'Draft Title';
      f.siteNotes = 'Draft Site Notes';
      f.emergencyPhone = '+919876543210';
      f.plantId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      return f;
    };

    it('converts plannedStartAt and plannedEndAt to ISO strings when both have valid date and time', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25T08:00';
      form.plannedEndAt = '2026-11-25T16:00';
      const payload = formToSavePayload(form);

      expect(payload.plannedStartAt).toBe(new Date('2026-11-25T08:00').toISOString());
      expect(payload.plannedEndAt).toBe(new Date('2026-11-25T16:00').toISOString());
      expect(payload.title).toBe('Draft Title');
      expect(payload.emergencyPhone).toBe('+919876543210');
    });

    it('omits plannedStartAt (undefined) when only start date is selected without time, while persisting other fields', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25';
      form.plannedEndAt = '2026-11-25T16:00';
      const payload = formToSavePayload(form);

      expect(payload.plannedStartAt).toBeUndefined();
      expect(payload.plannedEndAt).toBe(new Date('2026-11-25T16:00').toISOString());
      expect(payload.title).toBe('Draft Title');
      expect(payload.emergencyPhone).toBe('+919876543210');
    });

    it('omits plannedEndAt (undefined) when only end date is selected without time, while persisting other fields', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25T08:00';
      form.plannedEndAt = '2026-11-25';
      const payload = formToSavePayload(form);

      expect(payload.plannedStartAt).toBe(new Date('2026-11-25T08:00').toISOString());
      expect(payload.plannedEndAt).toBeUndefined();
      expect(payload.title).toBe('Draft Title');
      expect(payload.emergencyPhone).toBe('+919876543210');
    });

    it('omits both plannedStartAt and plannedEndAt (undefined) when both dates are selected without time', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25';
      form.plannedEndAt = '2026-11-25';
      const payload = formToSavePayload(form);

      expect(payload.plannedStartAt).toBeUndefined();
      expect(payload.plannedEndAt).toBeUndefined();
      expect(payload.title).toBe('Draft Title');
      expect(payload.emergencyPhone).toBe('+919876543210');
    });

    it('omits plannedStartAt and plannedEndAt when both are empty strings', () => {
      const form = baseForm();
      form.plannedStartAt = '';
      form.plannedEndAt = '';
      const payload = formToSavePayload(form);

      expect(payload.plannedStartAt).toBeUndefined();
      expect(payload.plannedEndAt).toBeUndefined();
    });

    it('ensures date-only strings are never passed into payload', () => {
      const form = baseForm();
      form.plannedStartAt = '2026-11-25';
      form.plannedEndAt = '2026-11-26';
      const payload = formToSavePayload(form);

      expect(payload.plannedStartAt).not.toBe('2026-11-25');
      expect(payload.plannedEndAt).not.toBe('2026-11-26');
      expect(payload.plannedStartAt).toBeUndefined();
      expect(payload.plannedEndAt).toBeUndefined();
    });
  });
});
