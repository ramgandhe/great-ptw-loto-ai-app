import { fromStoredStep, toDateInputValue, toStoredStep } from '../mobile/src/lib/permit/form';
import { applicableTemplates, isAnswered, missingFormAnswers, signNow, withPrefill } from '../mobile/src/lib/permit/forms';

describe('mobile permit form (S0a)', () => {
  it('round-trips a stored instant through the local date field without shifting it', () => {
    // Fails with the old UTC slice in any time zone other than UTC (this machine runs IST).
    const stored = '2026-10-02T02:30:00.000Z';
    expect(new Date(toDateInputValue(stored)).toISOString()).toBe(stored);
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue('not a date')).toBe('');
  });

  it('uses the same stored step index as the web editor, including the forms step (S6)', () => {
    // Web and mobile: 0 basic, 1 location, 2 on-site, 3 crew, 4 forms, 5 review.
    expect([0, 1, 2, 3, 4, 5, 9, -1].map(fromStoredStep)).toEqual([0, 1, 2, 3, 4, 5, 5, 0]);
    expect([0, 1, 2, 3, 4, 5].map(toStoredStep)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('forms: applicable templates, prefill only empty fields, and missing submit-stage answers', () => {
    const config = {
      kind: 'permit' as const,
      sections: [
        {
          id: 's',
          title: 'S',
          fields: [
            { id: 'dept', label: 'Issuing department', type: 'text' as const, required: true, prefill: 'department' as const },
            { id: 'count', label: 'Persons', type: 'number' as const, prefill: 'crew-count' as const },
            { id: 'hod', label: 'HOD', type: 'signature' as const, required: true, requiredAt: 'approval' as const },
            { id: 'ok', label: 'Area clear', type: 'check' as const, required: true },
          ],
        },
      ],
    };
    const templates = [
      { id: 't1', name: 'Safe work permit', status: 'published', appliesToAllTypes: true, permitTypeIds: [], config },
      { id: 't2', name: 'Draft sheet', status: 'draft', appliesToAllTypes: true, permitTypeIds: [], config },
      { id: 't3', name: 'Hot work', status: 'published', appliesToAllTypes: false, permitTypeIds: ['hot'], config },
    ];
    const forms = applicableTemplates(templates, 'cold');
    expect(forms.map((t) => t.id)).toEqual(['t1']);
    // Fields the permit gives are not asked, so they follow the permit, over an earlier answer.
    const filled = withPrefill({ t1: { dept: 'Typed by hand' } }, forms, { department: 'Maintenance', 'crew-count': 3 });
    expect(filled.t1).toEqual({ dept: 'Maintenance', count: 3 });
    // The approval-stage signature never blocks submission.
    expect(missingFormAnswers(forms, filled)).toEqual(['Safe work permit: 1 required answer missing']);
    expect(missingFormAnswers(forms, { t1: { ...filled.t1, ok: 'yes' } })).toEqual([]);
    expect(isAnswered({ name: '  ' })).toBe(false);
    expect(signNow('A. Kumar', new Date(2026, 9, 1, 8, 5))).toEqual({ name: 'A. Kumar', date: '2026-10-01', time: '08:05' });
  });

});
