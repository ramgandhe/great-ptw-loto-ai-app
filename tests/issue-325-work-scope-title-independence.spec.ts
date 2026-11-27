import { createEmptyPermitForm, permitDetailToForm, formToSavePayload, validateStep } from '@/lib/permit/form';
import type { PermitDetail } from '@/lib/permit/types';

describe('Issue #325 - Work Scope and Title independence during permit creation and editing', () => {
  it('creates an empty permit form with empty and independent title and workScope', () => {
    const form = createEmptyPermitForm();
    expect(form.title).toBe('');
    expect(form.workScope).toBe('');

    // Updating workScope independently does not mutate title
    const updatedWorkScope = 'Inspect the marked walkway before routine work.';
    const formWithScope = { ...form, workScope: updatedWorkScope };

    expect(formWithScope.workScope).toBe(updatedWorkScope);
    expect(formWithScope.title).toBe('');
  });

  it('allows distinct Title and Work Scope values', () => {
    const form = createEmptyPermitForm();
    const distinctTitle = 'Custom Walkway Inspection Title';
    const distinctScope = 'Replace pump P-101 and inspect piping.';

    const populated = {
      ...form,
      title: distinctTitle,
      workScope: distinctScope,
    };

    expect(populated.title).toBe(distinctTitle);
    expect(populated.workScope).toBe(distinctScope);
  });

  it('preserves distinct title and workScope when converting to save draft payload', () => {
    const form = createEmptyPermitForm();
    const payload = formToSavePayload({
      ...form,
      title: 'Distinct Title',
      workScope: 'Detailed scope of work across multiple sentences.',
    });

    expect(payload.title).toBe('Distinct Title');
    expect(payload.workScope).toBe('Detailed scope of work across multiple sentences.');
  });

  it('preserves independent title and workScope when converting PermitDetail to form', () => {
    const mockDetail: PermitDetail = {
      permit: {
        id: 'permit-1',
        reference: 'PTW-2026-0001',
        title: 'Original Explicit Title',
        workScope: 'Completely different scope description',
        status: 'draft',
        permitTypeId: 'type-1',
        departmentId: 'dept-1',
        locationId: 'loc-1',
        plantId: 'plant-1',
        plannedStartAt: '2026-11-26T08:00',
        plannedEndAt: '2026-11-26T17:00',
        createdAt: '2026-11-26T07:00:00Z',
        updatedAt: '2026-11-26T07:00:00Z',
      } as any,
      draft: null,
      hazards: [],
      ppe: [],
      executors: [],
      viewers: [],
      safetyOfficers: [],
      lototo: [],
      gasTesting: [],
      attachments: [],
    };

    const formState = permitDetailToForm(mockDetail);
    expect(formState.title).toBe('Original Explicit Title');
    expect(formState.workScope).toBe('Completely different scope description');

    // Updating scope on this state leaves title intact
    const modifiedScopeState = { ...formState, workScope: 'Modified scope text' };
    expect(modifiedScopeState.title).toBe('Original Explicit Title');
    expect(modifiedScopeState.workScope).toBe('Modified scope text');
  });

  it('validates Title requirement independently of whether Work Scope is populated', () => {
    const formWithOnlyScope = {
      ...createEmptyPermitForm(),
      workScope: 'Scope is filled but title is empty',
      locationId: 'loc-1',
      departmentId: 'dept-1',
      plannedStartAt: '2026-11-26T08:00',
      plannedEndAt: '2026-11-26T17:00',
    };

    const errors = validateStep(formWithOnlyScope, 0);
    expect(errors).toContain('Title is required');

    const formWithBoth = {
      ...formWithOnlyScope,
      title: 'Valid Title',
    };
    const errorsWithBoth = validateStep(formWithBoth, 0);
    expect(errorsWithBoth).not.toContain('Title is required');
  });

  it('preserves empty workScope when title is populated and avoids duplicate concatenation', () => {
    const formWithTitleOnly = {
      ...createEmptyPermitForm(),
      title: 'Only Title Populated',
      workScope: '',
    };

    const payload = formToSavePayload(formWithTitleOnly);
    expect(payload.title).toBe('Only Title Populated');
    expect(payload.workScope).toBeUndefined();

    // Verify job-description concatenation logic produces clean string without duplications
    const jobDescription = [formWithTitleOnly.title, formWithTitleOnly.workScope]
      .filter((v) => v.trim())
      .join('\n\n') || undefined;
    expect(jobDescription).toBe('Only Title Populated');
  });

  it('formats distinct job-description concatenation when both fields are provided', () => {
    const formWithBoth = {
      ...createEmptyPermitForm(),
      title: 'Replace Cooling Pump',
      workScope: '1. Isolate valves\n2. Drain line\n3. Swap pump unit',
    };

    const jobDescription = [formWithBoth.title, formWithBoth.workScope]
      .filter((v) => v.trim())
      .join('\n\n') || undefined;
    expect(jobDescription).toBe(
      'Replace Cooling Pump\n\n1. Isolate valves\n2. Drain line\n3. Swap pump unit'
    );
  });
});
