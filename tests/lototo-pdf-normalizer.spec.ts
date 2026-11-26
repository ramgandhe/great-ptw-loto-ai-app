import { assignPhotosByPosition, normalizeLototoPdfDraft } from '../app/src/modules/lototo-pdf-extraction/extraction-normalizer';
import { parseModelJson } from '../app/src/modules/lototo-pdf-extraction/nvidia-nim-vlm.provider';
import { isProcedurePhoto } from '../app/src/modules/lototo-pdf-extraction/pdf-document-reader';

describe('LOTOTO PDF extraction normalizer', () => {
  it('keeps a usable draft and clears a bad proof', () => {
    const { result, fatal, warnings } = normalizeLototoPdfDraft(
      {
        code: 'A-1',
        title: 'Elevator',
        lockoutPoints: [{ pointCode: 'E-1', energyType: 'electrical', action: 'Lock out', proof: 'not-a-proof' }],
        sequenceSteps: [
          { phase: 'apply', sequenceOrder: 1, title: 'Apply' },
          { phase: 'remove', sequenceOrder: 1, title: 'Remove' },
        ],
        images: [],
      },
    );
    expect(fatal).toBeUndefined();
    expect(result?.dto.lockoutPoints?.[0].proof).toBeUndefined();
    expect(warnings.some((item) => item.message.includes('Choose a proof on point E-1'))).toBe(true);
  });

  it('maps application and removal phases', () => {
    const { result, fatal } = normalizeLototoPdfDraft(
      {
        code: 'A-1',
        title: 'Elevator',
        lockoutPoints: [{ pointCode: 'E-1', energyType: 'electrical', action: 'Lock out' }],
        sequenceSteps: [
          { phase: 'Lockout application', sequenceOrder: 1, title: 'Notify' },
          { phase: 'removal', sequenceOrder: 1, title: 'Remove locks' },
        ],
      },
    );
    expect(fatal).toBeUndefined();
    expect(result?.dto.sequenceSteps?.map((step) => step.phase)).toEqual(['apply', 'remove']);
  });

  it('keeps the first step when a phase and order are repeated', () => {
    const { result } = normalizeLototoPdfDraft(
      {
        code: 'A-1',
        title: 'Elevator',
        lockoutPoints: [{ pointCode: 'E-1', energyType: 'electrical', action: 'Lock out' }],
        sequenceSteps: [
          { phase: 'apply', sequenceOrder: 1, title: 'Notify' },
          { phase: 'apply', sequenceOrder: 1, title: 'Notify again' },
          { phase: 'remove', sequenceOrder: 1, title: 'Remove locks' },
        ],
      },
    );
    expect(result?.dto.sequenceSteps?.map((step) => step.title)).toEqual(['Notify', 'Remove locks']);
    expect(result?.warnings.some((item) => item.message.startsWith('1 repeated sequence step'))).toBe(true);
  });

  it('places each photo on the lockout point beside it', () => {
    const photos = [
      { index: 0, pageNumber: 1, centerY: 558, height: 166 },
      { index: 1, pageNumber: 2, centerY: 110.4, height: 101 },
      { index: 2, pageNumber: 2, centerY: 221, height: 101 },
      { index: 3, pageNumber: 2, centerY: 329.5, height: 101 },
      { index: 4, pageNumber: 2, centerY: 437.9, height: 101 },
      { index: 5, pageNumber: 2, centerY: 546.3, height: 101 },
    ];
    const lines = [
      { pageNumber: 2, text: 'The E-1 Isolator is located', centerY: 65.5 },
      { pageNumber: 2, text: 'E-1', centerY: 83.6 },
      { pageNumber: 2, text: 'E-2', centerY: 194.3 },
      { pageNumber: 2, text: 'E-3', centerY: 302.7 },
      { pageNumber: 2, text: 'E-4', centerY: 411.1 },
      { pageNumber: 2, text: 'EMP-1', centerY: 519.5 },
    ];
    const { refs, warnings } = assignPhotosByPosition(photos, lines, ['E-1', 'E-2', 'E-3', 'E-4', 'EMP-1']);
    expect(refs.map((ref) => ref.pointCode ?? null)).toEqual([null, 'E-1', 'E-2', 'E-3', 'E-4', 'EMP-1']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('1 photo could not be matched');
  });

  it('keeps a draft when the PDF has no remove steps or title', () => {
    const { result, fatal, warnings } = normalizeLototoPdfDraft({
      code: 'A-1',
      lockoutPoints: [{ pointCode: 'E-1', energyType: 'electrical' }],
      sequenceSteps: [{ phase: 'before work', sequenceOrder: 1, title: 'Notify' }],
    });
    expect(fatal).toBeUndefined();
    expect(result?.dto.title).toBe('');
    expect(result?.dto.lockoutPoints?.[0].action).toBeUndefined();
    expect(result?.dto.sequenceSteps?.[0]).toMatchObject({ phase: 'apply', title: 'Notify' });
    expect(warnings.some((item) => item.message.includes('no procedure title'))).toBe(true);
    expect(warnings.some((item) => item.message.includes('no remove steps'))).toBe(true);
    expect(warnings.some((item) => item.message.includes('Write how to isolate it'))).toBe(true);
  });

  it('drops a page-sized scan and a logo, and keeps a cropped photo', () => {
    const page: [number, number, number, number] = [0, 0, 612, 792];
    expect(isProcedurePhoto([0, 27, 595, 815], [0, 0, 595, 842])).toBe(false);
    expect(isProcedurePhoto([21.6, 10.8, 134.6, 59.4], page)).toBe(false);
    expect(isProcedurePhoto([310.1, 59.8, 444.8, 161], page)).toBe(true);
  });

  it('parses fenced model JSON', () => {
    const parsed = parseModelJson('```json\n{"code":"A-1","title":"T"}\n```');
    expect(parsed.code).toBe('A-1');
  });
});
