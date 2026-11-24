import {
  createEmptyPermitForm,
  editorSectionsFor,
  PERMIT_EDITOR_SECTIONS,
  validateStep,
} from '../frontend/src/lib/permit/form';
import {
  handoffSectionFor as feHandoffSectionFor,
  holderNextWork as feHolderNextWork,
  returnSectionFor as feReturnSectionFor,
  stepsEditableForHolder as feStepsEditableForHolder,
} from '../frontend/src/lib/permit/handoff';
import {
  holderNextWork as beHolderNextWork,
  stepsEditableForHolder as beStepsEditableForHolder,
} from '../app/src/modules/permit/permit-draft-handoff';

describe('Issue 342 Verification: Remove Forms and evidence from permit workflow', () => {
  describe('Scenario 1: Section definition & Chrome', () => {
    it('Positive: includes all 6 operational sections in correct sequence', () => {
      const sectionIds = PERMIT_EDITOR_SECTIONS.map((section) => section.id);
      expect(sectionIds).toEqual(['work', 'place', 'site', 'crew', 'safety', 'review']);
    });

    it('Negative: forms and evidence section is completely excluded from editor sections', () => {
      const sectionIds = PERMIT_EDITOR_SECTIONS.map((section) => section.id);
      expect(sectionIds).not.toContain('forms');
      expect(PERMIT_EDITOR_SECTIONS.find((s) => s.id === 'forms' as any)).toBeUndefined();
    });

    it('Positive: editorSectionsFor handles dynamic safety approval without forms', () => {
      const emptyForm = createEmptyPermitForm();
      const withoutSafety = editorSectionsFor(emptyForm).map((s) => s.id);
      expect(withoutSafety).toEqual(['work', 'place', 'site', 'crew', 'review']);
      expect(withoutSafety).not.toContain('forms');

      const withSafety = editorSectionsFor({
        ...emptyForm,
        safetyOfficers: [{ workforceUserId: 'so-123' }],
      }).map((s) => s.id);
      expect(withSafety).toEqual(['work', 'place', 'site', 'crew', 'safety', 'review']);
      expect(withSafety).not.toContain('forms');
    });
  });

  describe('Scenario 2: Draft Handoff Lifecycle', () => {
    it('Positive: operator handoff section is crew', () => {
      expect(feHandoffSectionFor('operator')).toBe('crew');
    });

    it('Negative: operator handoff is never anchored to forms', () => {
      expect(feHandoffSectionFor('operator')).not.toBe('forms');
    });

    it('Positive: receiver and safety officer handoff sections remain intact', () => {
      expect(feHandoffSectionFor('receiver')).toBe('place');
      expect(feHandoffSectionFor('safety_officer')).toBe('safety');
      expect(feHandoffSectionFor('ready_for_review')).toBeNull();
    });

    it('Positive: return sections remain unchanged', () => {
      expect(feReturnSectionFor('receiver')).toBeNull();
      expect(feReturnSectionFor('operator')).toBe('site');
      expect(feReturnSectionFor('safety_officer')).toBe('safety');
      expect(feReturnSectionFor('ready_for_review')).toBe('review');
    });

    it('Positive: holder next work describes Site safety and Crew only', () => {
      expect(feHolderNextWork('operator')).toBe('Site safety and Crew');
      expect(beHolderNextWork('operator')).toBe('Site safety and Crew');
      expect(feHolderNextWork('operator')).not.toContain('Forms');
      expect(beHolderNextWork('operator')).not.toContain('Forms');
    });

    it('Positive: steps editable for operator are strictly [2, 3]', () => {
      expect(feStepsEditableForHolder('operator')).toEqual([2, 3]);
      expect(beStepsEditableForHolder('operator')).toEqual([2, 3]);
      expect(feStepsEditableForHolder('operator')).not.toContain(4);
      expect(beStepsEditableForHolder('operator')).not.toContain(4);
    });
  });

  describe('Scenario 3: Validation and Error Handling', () => {
    it('Positive: work section validates mandatory fields correctly', () => {
      const emptyForm = createEmptyPermitForm();
      const errors = validateStep(emptyForm, 0);
      expect(errors).toContain('Permit type is required');
      expect(errors).toContain('Title is required');
    });

    it('Positive: place section validates schedule and location', () => {
      const emptyForm = createEmptyPermitForm();
      const errors = validateStep(emptyForm, 1);
      expect(errors).toContain('Site is required');
      expect(errors).toContain('Work location is required');
      expect(errors).toContain('Planned start date and time are required');
      expect(errors).toContain('Planned end date and time are required');
    });

    it('Positive: site section validates hazards and lototo', () => {
      const emptyForm = createEmptyPermitForm();
      const errors = validateStep(emptyForm, 2);
      expect(errors).toContain('At least one hazard is required');
    });

    it('Positive: crew section validates executor requirement', () => {
      const emptyForm = createEmptyPermitForm();
      const errors = validateStep(emptyForm, 3);
      expect(errors).toContain('At least one executor is required');
    });
  });
});
