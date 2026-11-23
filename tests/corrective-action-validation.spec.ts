import { validateCorrectiveAction, validatePreventiveAction } from '../frontend/src/lib/incidents/validation';

describe('Incident Corrective & Preventive Action Validation (Issue #319)', () => {
  it('blocks corrective action submission when Owner is missing and returns "Please select an Owner"', () => {
    const result = validateCorrectiveAction({
      title: 'Replace damaged hydraulic hose',
      ownerId: '',
      dueDate: '2026-12-01',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Please select an Owner');
  });

  it('blocks corrective action submission when Owner is only whitespace', () => {
    const result = validateCorrectiveAction({
      title: 'Replace damaged hydraulic hose',
      ownerId: '   ',
      dueDate: '2026-12-01',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Please select an Owner');
  });

  it('blocks corrective action when title is missing', () => {
    const result = validateCorrectiveAction({
      title: '   ',
      ownerId: '00000000-0000-4000-8000-000000000001',
      dueDate: '2026-12-01',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Title is required');
  });

  it('allows corrective action when all required fields including Owner are valid', () => {
    const result = validateCorrectiveAction({
      title: 'Replace damaged hydraulic hose',
      ownerId: '00000000-0000-4000-8000-000000000001',
      dueDate: '2026-12-01',
    });

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it('blocks preventive action submission when Owner is missing and returns "Please select an Owner"', () => {
    const result = validatePreventiveAction({
      title: 'Install protective shroud over valve',
      ownerId: '',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('Please select an Owner');
  });

  it('allows preventive action when Title and Owner are valid', () => {
    const result = validatePreventiveAction({
      title: 'Install protective shroud over valve',
      ownerId: '00000000-0000-4000-8000-000000000001',
    });

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });
});
