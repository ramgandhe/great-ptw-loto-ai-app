import { limitIsLooser, mergeGasLimits, widerThanAny } from '../app/src/modules/master-data/gas-test-defaults';

const area = { kind: 'work_location' as const, id: 'area', name: 'Pump Area' };
const tank = { kind: 'asset' as const, id: 'tk04', name: 'TK-04' };

describe('gas test defaults', () => {
  it('keeps the strictest limit and records which side it came from', () => {
    const merged = mergeGasLimits([
      { parameter: 'H2S', unit: 'ppm', minimum: 0, maximum: 10, source: area },
      { parameter: 'h2s', unit: 'ppm', minimum: 0, maximum: 5, source: tank },
    ]);
    expect(merged).toEqual([
      {
        parameter: 'H2S',
        unit: 'ppm',
        minimum: 0,
        maximum: 5,
        minimumSource: area,
        maximumSource: tank,
      },
    ]);
  });

  it('refuses a wider permit range and allows a tighter one', () => {
    const baseline = { minimum: 19.5, maximum: 23.5 };
    expect(limitIsLooser({ minimum: 19, maximum: 23.5 }, baseline)).toBe(true);
    expect(limitIsLooser({ minimum: 19.5, maximum: 24 }, baseline)).toBe(true);
    expect(limitIsLooser({ minimum: 20, maximum: 23 }, baseline)).toBe(false);
  });

  it('refuses a child location limit that is wider than any ancestor', () => {
    const ancestors = [
      { minimum: 0, maximum: 10 },
      { minimum: 0, maximum: 5 },
    ];
    expect(widerThanAny({ minimum: 0, maximum: 8 }, ancestors)).toBe(true);
    expect(widerThanAny({ minimum: 0, maximum: 4 }, ancestors)).toBe(false);
  });
});
