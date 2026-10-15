import {
  approverLocationScope,
  createsCycle,
  descendantIds,
  placePath,
  resolveApprovers,
} from '../app/src/modules/place/place-rules';

const tree = new Map<string, string | null>([
  ['unit', null],
  ['area', 'unit'],
  ['pump', 'area'],
]);

describe('work location tree', () => {
  it('rejects a location placed under itself or its descendant', () => {
    expect(createsCycle('unit', 'unit', tree)).toBe(true);
    expect(createsCycle('unit', 'pump', tree)).toBe(true);
    expect(createsCycle('area', 'pump', tree)).toBe(true);
    expect(createsCycle('pump', 'unit', tree)).toBe(false);
    expect(createsCycle('pump', null, tree)).toBe(false);
  });

  it('lists descendants and not the location itself', () => {
    expect(descendantIds('unit', tree).sort()).toEqual(['area', 'pump']);
    expect(descendantIds('pump', tree)).toEqual([]);
  });

  it('builds the path from the site down', () => {
    const names = new Map([
      ['unit', 'Crude Processing Unit'],
      ['area', 'Pump Area'],
    ]);
    expect(placePath('area', 'Refinery A', names, tree)).toBe('Refinery A › Crude Processing Unit › Pump Area');
  });
});

describe('area authority', () => {
  const parents = new Map<string, string | null>([
    ['unit', null],
    ['area', 'unit'],
    ['pump', 'area'],
  ]);

  it('uses the location list, otherwise the nearest ancestor', () => {
    const approvers = new Map<string, string[]>([
      ['unit', ['ravi']],
      ['pump', ['meera']],
    ]);
    expect(resolveApprovers('pump', parents, approvers)).toEqual({
      userIds: ['meera'],
      inheritedFrom: null,
    });
    expect(resolveApprovers('area', parents, approvers)).toEqual({
      userIds: ['ravi'],
      inheritedFrom: 'unit',
    });
  });

  it('warns when nobody is assigned up the tree', () => {
    expect(resolveApprovers('pump', parents, new Map())).toEqual({
      userIds: [],
      inheritedFrom: null,
    });
  });

  it('limits an assigned approver to their locations and to locations with nobody', () => {
    const approvers = new Map<string, string[]>([
      ['unit', ['ravi']],
      ['pump', ['meera']],
    ]);
    expect(approverLocationScope('meera', parents, approvers).allLocations).toBe(false);
    expect(approverLocationScope('meera', parents, approvers).locationIds.sort()).toEqual(['pump']);
    expect(approverLocationScope('ravi', parents, approvers).locationIds.sort()).toEqual(['area', 'unit']);
    expect(approverLocationScope('nobody', parents, approvers)).toEqual({
      allLocations: true,
      locationIds: [],
    });
  });
});
