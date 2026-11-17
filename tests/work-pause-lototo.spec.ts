import {
  assertLototoRemovalsKnown,
  decidePauseLototoOutcome,
} from '../app/src/modules/execution/work-pause-lototo';

describe('work-pause-lototo', () => {
  it('hold policy rejects overnight restore', () => {
    const result = decidePauseLototoOutcome({
      overnightIsolationPolicy: 'hold',
      overnightRestoreChosen: true,
      lototoRemovals: [],
    });
    expect(result.rejected).toMatch(/hold/i);
    expect(result.overnightRestoreChosen).toBe(false);
  });

  it('restore_allowed with restore sets reisolate', () => {
    const result = decidePauseLototoOutcome({
      overnightIsolationPolicy: 'restore_allowed',
      overnightRestoreChosen: true,
      lototoRemovals: [],
    });
    expect(result.rejected).toBeUndefined();
    expect(result.overnightRestoreChosen).toBe(true);
    expect(result.reisolateRequiredOnResume).toBe(true);
  });

  it('removals force reisolate even on hold', () => {
    const result = decidePauseLototoOutcome({
      overnightIsolationPolicy: 'hold',
      overnightRestoreChosen: false,
      lototoRemovals: ['lock-1'],
    });
    expect(result.reisolateRequiredOnResume).toBe(true);
  });

  it('rejects unknown removal ids', () => {
    expect(assertLototoRemovalsKnown(['a', 'b'], ['a'])).toMatch(/Unknown/);
    expect(assertLototoRemovalsKnown(['a'], ['a', 'b'])).toBeNull();
  });
});
