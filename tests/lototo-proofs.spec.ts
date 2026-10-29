import { BadRequestException } from '@nestjs/common';
import { proofsForEnergy } from '../app/src/modules/lototo/lototo-point';
import { assertProofAcceptable, earlierUnappliedPoint } from '../app/src/modules/lototo/certificate-points';

describe('LOTOTO proof for an energy', () => {
  it('offers a meter test for electrical energy and a gauge for pressure', () => {
    expect(proofsForEnergy('electrical')).toEqual(['meter', 'try_start']);
    expect(proofsForEnergy('pressure')).toEqual(['gauge', 'try_start']);
    expect(proofsForEnergy('chemical')).not.toContain('meter');
    expect(proofsForEnergy('site_specific')).toEqual(['visual']);
  });

  it('requires the three electrical checks and a current calibration', () => {
    expect(() =>
      assertProofAcceptable({
        proof: 'meter',
        result: 'pass',
        readings: { meterProved: true, equipmentDead: true, meterProvedAgain: false },
        instrumentMakeModel: 'Fluke',
        instrumentSerialNo: 'A1',
        calibrationExpiryDate: '2026-12-01',
        today: '2026-10-29',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertProofAcceptable({
        proof: 'meter',
        result: 'pass',
        readings: { meterProved: true, equipmentDead: true, meterProvedAgain: true },
        instrumentMakeModel: 'Fluke',
        instrumentSerialNo: 'A1',
        calibrationExpiryDate: '2026-12-01',
        today: '2026-10-29',
      }),
    ).not.toThrow();
  });

  it('refuses an apply that skips an earlier point', () => {
    const blocked = earlierUnappliedPoint(
      [
        { id: 'a', sortOrder: 1, appliedAt: null, pointCode: 'E-1' },
        { id: 'b', sortOrder: 2, appliedAt: null, pointCode: 'E-2' },
      ],
      'b',
    );
    expect(blocked?.pointCode).toBe('E-1');
  });
});
