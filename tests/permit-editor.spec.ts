import { PERMIT_EDITOR_SECTIONS, PERMIT_WIZARD_STEPS, titleFromScope } from '../frontend/src/lib/permit/form';

describe('permit editor (S2)', () => {
  it('suggests the title from the first sentence or line of the scope', () => {
    expect(titleFromScope('Inspect the marked walkway before routine work. Then sweep it.')).toBe('Inspect the marked walkway before routine work');
    expect(titleFromScope('Replace pump P-101\nIsolate first')).toBe('Replace pump P-101');
    expect(titleFromScope('  Weld bracket on line 3!  ')).toBe('Weld bracket on line 3');
    expect(titleFromScope('')).toBe('');
  });

  it('keeps decimals and codes inside the first sentence', () => {
    // A full stop only ends a sentence when whitespace follows it.
    expect(titleFromScope('Recalibrate PT-2.5 sensor on skid 4. Log readings.')).toBe('Recalibrate PT-2.5 sensor on skid 4');
  });

  it('shortens a long first sentence at a word boundary', () => {
    const scope = 'As per work order 4411 the maintenance team will ' + 'inspect and clean the cooling water strainers '.repeat(4);
    const title = titleFromScope(scope);
    expect(title.length).toBeLessThanOrEqual(121);
    expect(title.endsWith('…')).toBe(true);
    expect(title.slice(0, -1)).toBe(title.slice(0, -1).trimEnd());
    // Boilerplate openings make poor titles; the editor shows the suggestion and lets the person change it.
    expect(title.startsWith('As per work order 4411')).toBe(true);
  });

  it('covers every stored step exactly once, in order', () => {
    expect(PERMIT_EDITOR_SECTIONS.flatMap((section) => section.steps)).toEqual(PERMIT_WIZARD_STEPS.map((_, index) => index));
  });
});
