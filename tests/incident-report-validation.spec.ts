import {
  validateIncidentReport,
  type IncidentReportFormValues,
} from '../frontend/src/lib/incidents/validation';

describe('Incident Report Mandatory Field Validation (Issue #305)', () => {
  const completeValidForm: IncidentReportFormValues = {
    title: 'Dropped tool from scaffold',
    description: 'Wrench slipped during valve maintenance and fell to walkway below.',
    siteId: 'site-uuid-1',
    workLocationId: 'work-loc-uuid-2',
    occurredAt: '2026-11-24T10:30',
  };

  describe('Submit Report scenario (full submission)', () => {
    it('returns errors for all mandatory fields simultaneously when all are empty', () => {
      const emptyForm: IncidentReportFormValues = {
        title: '',
        description: '',
        siteId: '',
        workLocationId: '',
        occurredAt: '',
      };

      const errors = validateIncidentReport(emptyForm, true);

      expect(errors.title).toBe('Title is required');
      expect(errors.description).toBe('Description is required');
      expect(errors.siteId).toBe('Site is required');
      expect(errors.workLocationId).toBe('Work location is required');
      expect(errors.occurredAt).toBe('Date and time of incident are required');
      expect(Object.keys(errors)).toHaveLength(5);
    });

    it('rejects whitespace-only title and description', () => {
      const whitespaceForm: IncidentReportFormValues = {
        ...completeValidForm,
        title: '   ',
        description: '   \n  \t ',
      };

      const errors = validateIncidentReport(whitespaceForm, true);

      expect(errors.title).toBe('Title is required');
      expect(errors.description).toBe('Description is required');
      expect(errors.siteId).toBeUndefined();
      expect(errors.workLocationId).toBeUndefined();
      expect(errors.occurredAt).toBeUndefined();
    });

    it('rejects missing or invalid date-time', () => {
      const invalidDateForm: IncidentReportFormValues = {
        ...completeValidForm,
        occurredAt: 'invalid-date-string',
      };

      const errors = validateIncidentReport(invalidDateForm, true);

      expect(errors.occurredAt).toBe('Date and time of incident are required');
      expect(errors.title).toBeUndefined();
    });

    it('blocks submission when siteId is empty but workLocationId is present', () => {
      const missingSiteForm: IncidentReportFormValues = {
        ...completeValidForm,
        siteId: '',
      };

      const errors = validateIncidentReport(missingSiteForm, true);

      expect(errors.siteId).toBe('Site is required');
      expect(errors.workLocationId).toBeUndefined();
    });

    it('blocks submission when workLocationId is empty but siteId is present', () => {
      const missingLocationForm: IncidentReportFormValues = {
        ...completeValidForm,
        workLocationId: '   ',
      };

      const errors = validateIncidentReport(missingLocationForm, true);

      expect(errors.workLocationId).toBe('Work location is required');
      expect(errors.siteId).toBeUndefined();
    });

    it('passes validation with zero errors when all required fields are valid', () => {
      const errors = validateIncidentReport(completeValidForm, true);

      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe('Save as Draft scenario', () => {
    it('allows draft save without siteId and workLocationId', () => {
      const draftForm: IncidentReportFormValues = {
        title: 'Draft incident title',
        description: 'Draft description',
        siteId: '',
        workLocationId: '',
        occurredAt: '2026-11-24T12:00',
      };

      const errors = validateIncidentReport(draftForm, false);

      expect(errors.siteId).toBeUndefined();
      expect(errors.workLocationId).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('blocks draft save when title or description is missing', () => {
      const emptyDraftForm: IncidentReportFormValues = {
        title: '',
        description: '',
        siteId: '',
        workLocationId: '',
        occurredAt: '2026-11-24T12:00',
      };

      const errors = validateIncidentReport(emptyDraftForm, false);

      expect(errors.title).toBe('Title is required');
      expect(errors.description).toBe('Description is required');
      expect(errors.siteId).toBeUndefined();
      expect(errors.workLocationId).toBeUndefined();
    });
  });
});
