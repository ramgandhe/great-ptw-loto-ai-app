import { formatPermitReference } from '../src/database/permit-reference';

describe('permit-reference', () => {
  it('pads sequence numbers to six digits', () => {
    expect(formatPermitReference(2026, 1)).toBe('PTW-2026-000001');
    expect(formatPermitReference(2026, 999999)).toBe('PTW-2026-999999');
  });
});
