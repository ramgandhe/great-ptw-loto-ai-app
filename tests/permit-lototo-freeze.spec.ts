import { ConflictException } from '@nestjs/common';
import { assertLototoWritable, isLototoFrozen } from '../app/src/modules/permit/permit-lototo-freeze';

describe('LOTOTO freeze after approval', () => {
  it('treats instances with frozenAt as frozen', () => {
    expect(isLototoFrozen([{ frozenAt: null }])).toBe(false);
    expect(isLototoFrozen([{ frozenAt: new Date('2026-09-30T00:00:00Z') }])).toBe(true);
  });

  it('blocks writes once frozen', () => {
    expect(() =>
      assertLototoWritable([{ frozenAt: new Date('2026-09-30T00:00:00Z') }]),
    ).toThrow(ConflictException);
  });
});
