import { mergeAfterConflict, resolveConflict } from '../frontend/src/lib/permit/conflict';
import { createEmptyPermitForm } from '../frontend/src/lib/permit/form';

describe('conflict recovery (review fix)', () => {
  const base = { ...createEmptyPermitForm(), title: 'Pump', workScope: 'Replace seal', locationId: 'loc-1', formResponses: { t: { a: 'yes', b: 'no' } } };

  it("keeps the other person's unrelated edits and this person's own, and lists values both changed", () => {
    const local = { ...base, title: 'Pump P-101', locationId: 'loc-2', formResponses: { t: { a: 'yes', b: 'na' } } };
    const saved = { ...base, workScope: 'Replace seal and bearing', locationId: 'loc-3', formResponses: { t: { a: 'no', b: 'no' } } };
    const { merged, conflicts } = mergeAfterConflict(base, local, saved);
    expect(merged.title).toBe('Pump P-101'); // only mine changed
    expect(merged.workScope).toBe('Replace seal and bearing'); // only theirs changed: kept, not overwritten
    expect(merged.formResponses.t).toEqual({ a: 'no', b: 'na' }); // per answer
    expect(conflicts).toEqual([{ key: 'field:locationId', saved: 'loc-3', yours: 'loc-2' }]);
    expect(merged.locationId).toBe('loc-2'); // mine until the person chooses
    expect(resolveConflict(merged, conflicts[0], 'saved').locationId).toBe('loc-3');
  });

  it('a value both changed to the same thing is not a conflict; a removed answer can conflict too', () => {
    const local = { ...base, title: 'Same', formResponses: { t: { a: 'yes' } } };
    const saved = { ...base, title: 'Same', formResponses: { t: { a: 'yes', b: 'yes' } } };
    const { conflicts } = mergeAfterConflict(base, local, saved);
    expect(conflicts).toEqual([{ key: 'form:t:b', saved: 'yes', yours: undefined }]);
    expect(resolveConflict(local, conflicts[0], 'saved').formResponses.t).toEqual({ a: 'yes', b: 'yes' });
  });
});
