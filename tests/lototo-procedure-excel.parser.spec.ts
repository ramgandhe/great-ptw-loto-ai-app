import ExcelJS from 'exceljs';
import {
  parseCodeNameCell,
  parseLototoProcedureWorkbook,
} from '../app/src/modules/lototo/lototo-procedure-excel.parser';

async function buildSampleWorkbook(overrides?: {
  omitApply?: boolean;
  badEnergy?: boolean;
  code?: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const header = workbook.addWorksheet('Header');
  header.getCell('A4').value = 'Field';
  header.getCell('B4').value = 'Value';
  const headerRows: Array<[string, string]> = [
    ['ProcedureCode', overrides?.code ?? 'A-1107-MXZ01'],
    ['Title', 'Lockout Bucket Elevator'],
    ['Asset', 'A-1107-MXZ01 — Bucket Elevator'],
    ['Purpose', 'Isolate energy before maintenance'],
  ];
  headerRows.forEach(([field, value], index) => {
    header.getCell(5 + index, 1).value = field;
    header.getCell(5 + index, 2).value = value;
  });

  const points = workbook.addWorksheet('LockoutPoints');
  [
    'SortOrder',
    'PointCode',
    'EnergyType',
    'EnergyOtherText',
    'Magnitude',
    'LocationText',
    'Method',
    'NormalPosition',
    'IsolatedPosition',
    'Action',
    'RestoreAction',
    'Device',
    'Proof',
    'DrawingReference',
    'RemoveOrder',
    'VerificationMethod',
  ].forEach((name, index) => {
    points.getCell(4, index + 1).value = name;
  });
  points.getCell(5, 1).value = 1;
  points.getCell(5, 2).value = 'E-1';
  points.getCell(5, 3).value = overrides?.badEnergy ? 'not-an-energy' : 'electrical';
  points.getCell(5, 7).value = 'lock_closed';
  points.getCell(5, 10).value = 'Turn isolator off and lock out';
  points.getCell(5, 13).value = 'meter';

  const steps = workbook.addWorksheet('SequenceSteps');
  ['Phase', 'SequenceOrder', 'Title', 'Action', 'InfoText', 'Verification', 'Note', 'Description'].forEach(
    (name, index) => {
      steps.getCell(4, index + 1).value = name;
    },
  );
  if (!overrides?.omitApply) {
    steps.getCell(5, 1).value = 'apply';
    steps.getCell(5, 2).value = 1;
    steps.getCell(5, 3).value = 'Isolate';
  }
  steps.getCell(6, 1).value = 'remove';
  steps.getCell(6, 2).value = 1;
  steps.getCell(6, 3).value = 'Restore';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe('LOTOTO procedure Excel parser', () => {
  it('parses CODE — Name cells', () => {
    expect(parseCodeNameCell('A-1107-MXZ01 — Bucket Elevator')).toBe('A-1107-MXZ01');
    expect(parseCodeNameCell('ONLY-CODE')).toBe('ONLY-CODE');
    expect(parseCodeNameCell('')).toBeUndefined();
  });

  it('parses a valid workbook', async () => {
    const { parsed, errors } = await parseLototoProcedureWorkbook(await buildSampleWorkbook());
    expect(errors).toEqual([]);
    expect(parsed?.procedureCode).toBe('A-1107-MXZ01');
    expect(parsed?.assetCode).toBe('A-1107-MXZ01');
    expect(parsed?.dto.title).toBe('Lockout Bucket Elevator');
    expect(parsed?.dto.lockoutPoints).toHaveLength(1);
    expect(parsed?.dto.sequenceSteps?.filter((step) => step.phase === 'apply')).toHaveLength(1);
    expect(parsed?.dto.sequenceSteps?.filter((step) => step.phase === 'remove')).toHaveLength(1);
  });

  it('requires apply and remove steps', async () => {
    const { errors } = await parseLototoProcedureWorkbook(await buildSampleWorkbook({ omitApply: true }));
    expect(errors.some((item) => item.message.includes('apply'))).toBe(true);
  });

  it('rejects unknown method/proof enums via method list when proof mismatches energy', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Header');
    const header = workbook.getWorksheet('Header')!;
    header.getCell('A4').value = 'Field';
    header.getCell('B4').value = 'Value';
    header.getCell('A5').value = 'ProcedureCode';
    header.getCell('B5').value = 'X-1';
    header.getCell('A6').value = 'Title';
    header.getCell('B6').value = 'Test';
    header.getCell('A7').value = 'WorkLocation';
    header.getCell('B7').value = 'LOC-1 — Area';

    const points = workbook.addWorksheet('LockoutPoints');
    [
      'SortOrder',
      'PointCode',
      'EnergyType',
      'EnergyOtherText',
      'Magnitude',
      'LocationText',
      'Method',
      'NormalPosition',
      'IsolatedPosition',
      'Action',
      'RestoreAction',
      'Device',
      'Proof',
      'DrawingReference',
      'RemoveOrder',
      'VerificationMethod',
    ].forEach((name, index) => {
      points.getCell(4, index + 1).value = name;
    });
    points.getCell(5, 1).value = 1;
    points.getCell(5, 2).value = 'E-1';
    points.getCell(5, 3).value = 'electrical';
    points.getCell(5, 10).value = 'Lock out';
    points.getCell(5, 13).value = 'drained';

    const steps = workbook.addWorksheet('SequenceSteps');
    ['Phase', 'SequenceOrder', 'Title'].forEach((name, index) => {
      steps.getCell(4, index + 1).value = name;
    });
    steps.getCell(5, 1).value = 'apply';
    steps.getCell(5, 2).value = 1;
    steps.getCell(5, 3).value = 'Apply';
    steps.getCell(6, 1).value = 'remove';
    steps.getCell(6, 2).value = 1;
    steps.getCell(6, 3).value = 'Remove';

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const { errors } = await parseLototoProcedureWorkbook(buffer);
    expect(errors.some((item) => item.code === 'PROOF_MISMATCH')).toBe(true);
  });
});
