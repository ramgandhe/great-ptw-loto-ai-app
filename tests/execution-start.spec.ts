import { BadRequestException } from '@nestjs/common';
import {
  assertExecutionStartReady,
  emptyExecutionStart,
  hazardControlKey,
  requiredHazardControlKeys,
} from '../app/src/modules/execution/execution-start';

describe('execution start steps', () => {
  const base = {
    lototoRequired: false,
    gasTestingRequired: false,
    lototoIsolated: true,
    requiredHazardKeys: [] as string[],
    requiredPpeIds: [] as string[],
    gasItems: [] as Array<{
      gasTestingCatalogueId: string;
      parameter: string;
      minimum: number;
      maximum: number;
      unit: string;
    }>,
  };

  it('blocks start until toolbox talk is ticked', () => {
    expect(() =>
      assertExecutionStartReady({ ...base, start: emptyExecutionStart() }),
    ).toThrow(BadRequestException);
  });

  it('allows start when unused LOTOTO and gas are N/A and toolbox is done', () => {
    expect(() =>
      assertExecutionStartReady({
        ...base,
        start: { ...emptyExecutionStart(), toolboxTalk: true },
      }),
    ).not.toThrow();
  });

  it('requires every hazard control and PPE item', () => {
    const hazardId = 'h1';
    const keys = requiredHazardControlKeys(
      [{ hazardCategoryId: hazardId, extraControls: ['Barricade'] }],
      new Map([[hazardId, { controls: ['Lock the gate'] }]]),
    );
    expect(keys).toEqual([
      hazardControlKey(hazardId, 'Lock the gate'),
      hazardControlKey(hazardId, 'Barricade'),
    ]);
    expect(() =>
      assertExecutionStartReady({
        ...base,
        requiredHazardKeys: keys,
        requiredPpeIds: ['ppe-1'],
        start: { ...emptyExecutionStart(), toolboxTalk: true, hazardControls: keys },
      }),
    ).toThrow(/PPE/);
  });

  it('rejects gas readings outside the safe range', () => {
    expect(() =>
      assertExecutionStartReady({
        ...base,
        gasTestingRequired: true,
        gasItems: [
          {
            gasTestingCatalogueId: 'g1',
            parameter: 'Oxygen',
            minimum: 19.5,
            maximum: 23.5,
            unit: '%',
          },
        ],
        start: {
          ...emptyExecutionStart(),
          toolboxTalk: true,
          gasReadings: [{ gasTestingCatalogueId: 'g1', value: 16 }],
        },
      }),
    ).toThrow(/Oxygen/);
  });
});
