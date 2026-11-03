import { Inject, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { and, asc, eq } from 'drizzle-orm';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DATABASE_CONNECTION, Database } from '../../database/database.module';
import {
  assets,
  energySources,
  organisations,
  workLocations,
} from '../../database/schema';
import { LOTOTO_ENERGY_TYPES } from './lototo.constants';
import { LOTOTO_ISOLATION_METHODS, LOTOTO_PROOFS } from './lototo-point';
import { LototoValidationService } from './lototo-validation.service';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
const SECTION_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E3F0' } };
const REQUIRED_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const OPTIONAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
const LABEL_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11 };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  left: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B0B0' } },
  right: { style: 'thin', color: { argb: 'FFB0B0B0' } },
};

function codeName(code: string, name: string) {
  return `${code} — ${name}`;
}

export function sanitizeTemplateFileSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return slug || 'tenant';
}

@Injectable()
export class LototoProcedureTemplateService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly validationService: LototoValidationService,
  ) {}

  async buildTemplate(user: AuthenticatedUser): Promise<{ buffer: Buffer; fileName: string }> {
    const tenantId = this.validationService.requireTenant(user);

    const [orgRows, assetRows, locationRows, energyRows] = await Promise.all([
      this.db
        .select({ name: organisations.name })
        .from(organisations)
        .where(eq(organisations.tenantId, tenantId))
        .orderBy(asc(organisations.name))
        .limit(1),
      this.db
        .select({ tag: assets.tag, name: assets.name })
        .from(assets)
        .where(and(eq(assets.tenantId, tenantId), eq(assets.status, 'active')))
        .orderBy(asc(assets.tag)),
      this.db
        .select({ code: workLocations.code, name: workLocations.name })
        .from(workLocations)
        .where(and(eq(workLocations.tenantId, tenantId), eq(workLocations.status, 'active')))
        .orderBy(asc(workLocations.code)),
      this.db
        .select({ code: energySources.code })
        .from(energySources)
        .where(eq(energySources.tenantId, tenantId))
        .orderBy(asc(energySources.code)),
    ]);

    const tenantName = orgRows[0]?.name ?? 'tenant';
    const fileName = `permitwiseai_${sanitizeTemplateFileSlug(tenantName)}_lototo_procedure_template.xlsx`;
    const energyList =
      energyRows.length > 0 ? energyRows.map((row) => row.code) : [...LOTOTO_ENERGY_TYPES];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PTW LOTOTO';
    workbook.created = new Date();

    this.addInstructions(workbook, tenantName);
    this.addHeader(workbook);
    this.addLockoutPoints(workbook);
    this.addSequenceSteps(workbook);
    this.addReference(workbook, {
      assets: assetRows.map((row) => codeName(row.tag, row.name)),
      locations: locationRows.map((row) => codeName(row.code, row.name)),
      energy: energyList,
      methods: [...LOTOTO_ISOLATION_METHODS],
      proofs: [...LOTOTO_PROOFS],
      phases: ['apply', 'remove'],
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, fileName };
  }

  private styleHeaderCell(cell: ExcelJS.Cell) {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  }

  private styleDataCell(cell: ExcelJS.Cell, required: boolean) {
    cell.fill = required ? REQUIRED_FILL : OPTIONAL_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { wrapText: true, vertical: 'top' };
  }

  private addInstructions(workbook: ExcelJS.Workbook, tenantName: string) {
    const ws = workbook.addWorksheet('Instructions');
    ws.getCell('A1').value = 'LOTOTO Procedure Excel Template';
    ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F4E79' } };
    ws.mergeCells('A1:B1');
    ws.getCell('A2').value = `Tenant: ${tenantName}`;
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    this.styleHeaderCell(ws.getCell('A3'));
    this.styleHeaderCell(ws.getCell('B3'));
    ws.getCell('A3').value = 'Topic';
    ws.getCell('B3').value = 'Detail';

    const rows: Array<[string, string]> = [
      ['Purpose', 'One workbook = one procedure. Upload creates or replaces a draft for review, then publish in the app.'],
      ['Colour key', 'Yellow cells are required. Green cells are optional. Dark blue row is the column header.'],
      ['Sheets', 'Header | LockoutPoints | SequenceSteps | Reference (hidden).'],
      ['Upsert', 'ProcedureCode is unique per tenant. Existing code requires confirm override; Excel replaces the draft.'],
      ['Published', 'Override revises via a draft only. Publish later to make it the latest published version.'],
      ['Header required', 'ProcedureCode, Title, and at least one of Asset or WorkLocation (CODE — Name).'],
      ['Asset', 'Use Asset for equipment / machinery / tagged plant items.'],
      ['WorkLocation', 'Place hierarchy location. There is no separate Workstation field on procedures.'],
      ['Points required', 'SortOrder, PointCode, EnergyType, Action. At least one point.'],
      ['Sequence required', 'Phase, SequenceOrder, Title. At least one apply and one remove step.'],
      ['Master data', 'Use dropdown values. Invalid codes fail the whole upload.'],
      ['Images', 'Attach procedure info photos in the UI after import. Not included in this file.'],
    ];
    rows.forEach(([topic, detail], index) => {
      const row = 4 + index;
      const topicCell = ws.getCell(`A${row}`);
      const detailCell = ws.getCell(`B${row}`);
      topicCell.value = topic;
      topicCell.font = LABEL_FONT;
      topicCell.fill = SECTION_FILL;
      topicCell.border = THIN_BORDER;
      detailCell.value = detail;
      detailCell.alignment = { wrapText: true, vertical: 'top' };
      detailCell.border = THIN_BORDER;
      ws.getRow(row).height = 36;
    });
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 100;
  }

  private addHeader(workbook: ExcelJS.Workbook) {
    const ws = workbook.addWorksheet('Header');
    ws.getCell('A1').value = 'LOTOTO Procedure — Header';
    ws.getCell('A1').font = TITLE_FONT;
    ws.mergeCells('A1:C1');
    ws.getCell('A2').value =
      'Yellow = required. Green = optional. Use dropdowns where provided. At least one of Asset or WorkLocation is required.';
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    this.styleHeaderCell(ws.getCell('A4'));
    this.styleHeaderCell(ws.getCell('B4'));
    this.styleHeaderCell(ws.getCell('C4'));
    ws.getCell('A4').value = 'Field';
    ws.getCell('B4').value = 'Value';
    ws.getCell('C4').value = 'Guidance';

    const fields: Array<[string, string, boolean]> = [
      ['ProcedureCode', 'Required. Unique per tenant.', true],
      ['Title', 'Required.', true],
      ['Asset', 'CODE — Name from dropdown (equipment / machinery / tagged asset). Required if WorkLocation empty.', true],
      ['WorkLocation', 'CODE — Name. Required if Asset empty.', true],
      ['Facility', 'Optional.', false],
      ['LocationText', 'Optional free-text location.', false],
      ['Purpose', 'Optional but recommended.', false],
      ['Scope', 'Optional but recommended.', false],
      ['Authorization', 'Optional but recommended.', false],
      ['Enforcement', 'Optional but recommended.', false],
      ['Description', 'Optional.', false],
      ['Note', 'Optional prerequisites / warnings.', false],
      ['ReviewDueOn', 'Optional. YYYY-MM-DD.', false],
    ];
    fields.forEach(([field, guidance, required], index) => {
      const row = 5 + index;
      const fieldCell = ws.getCell(`A${row}`);
      const valueCell = ws.getCell(`B${row}`);
      const guideCell = ws.getCell(`C${row}`);
      fieldCell.value = field;
      fieldCell.font = LABEL_FONT;
      this.styleDataCell(fieldCell, required);
      this.styleDataCell(valueCell, required);
      guideCell.value = guidance;
      guideCell.border = THIN_BORDER;
      guideCell.alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(row).height = 28;
    });

    // Asset row 7, WorkLocation 8
    this.addListValidation(ws, 'B7', 'Reference!$A$2:$A$500');
    this.addListValidation(ws, 'B8', 'Reference!$B$2:$B$500');

    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 60;
    ws.getColumn(3).width = 55;
  }

  private addLockoutPoints(workbook: ExcelJS.Workbook) {
    const ws = workbook.addWorksheet('LockoutPoints');
    ws.getCell('A1').value = 'LOTOTO Procedure — Lockout Points';
    ws.getCell('A1').font = TITLE_FONT;
    ws.mergeCells('A1:P1');
    ws.getCell('A2').value =
      'Yellow columns are required (SortOrder, PointCode, EnergyType, Action). Green columns are optional.';
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    const headers: Array<[string, boolean]> = [
      ['SortOrder', true],
      ['PointCode', true],
      ['EnergyType', true],
      ['EnergyOtherText', false],
      ['Magnitude', false],
      ['LocationText', false],
      ['Method', false],
      ['NormalPosition', false],
      ['IsolatedPosition', false],
      ['Action', true],
      ['RestoreAction', false],
      ['Device', false],
      ['Proof', false],
      ['DrawingReference', false],
      ['RemoveOrder', false],
      ['VerificationMethod', false],
    ];
    headers.forEach(([name], index) => {
      const cell = ws.getCell(4, index + 1);
      cell.value = name;
      this.styleHeaderCell(cell);
    });
    for (let row = 5; row <= 24; row += 1) {
      headers.forEach(([, required], index) => {
        this.styleDataCell(ws.getCell(row, index + 1), required);
      });
    }

    this.addListValidation(ws, 'C5:C204', 'Reference!$C$2:$C$50');
    this.addListValidation(ws, 'G5:G204', 'Reference!$D$2:$D$50');
    this.addListValidation(ws, 'M5:M204', 'Reference!$E$2:$E$50');
    headers.forEach(([, ], index) => {
      ws.getColumn(index + 1).width = index === 5 || index === 9 || index === 15 ? 28 : 16;
    });
    ws.getRow(4).height = 30;
  }

  private addSequenceSteps(workbook: ExcelJS.Workbook) {
    const ws = workbook.addWorksheet('SequenceSteps');
    ws.getCell('A1').value = 'LOTOTO Procedure — Sequence Steps';
    ws.getCell('A1').font = TITLE_FONT;
    ws.mergeCells('A1:H1');
    ws.getCell('A2').value =
      'Yellow columns are required (Phase, SequenceOrder, Title). Need at least one apply and one remove step.';
    ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

    const headers: Array<[string, boolean]> = [
      ['Phase', true],
      ['SequenceOrder', true],
      ['Title', true],
      ['Action', false],
      ['InfoText', false],
      ['Verification', false],
      ['Note', false],
      ['Description', false],
    ];
    headers.forEach(([name], index) => {
      const cell = ws.getCell(4, index + 1);
      cell.value = name;
      this.styleHeaderCell(cell);
    });
    for (let row = 5; row <= 24; row += 1) {
      headers.forEach(([, required], index) => {
        this.styleDataCell(ws.getCell(row, index + 1), required);
      });
    }

    this.addListValidation(ws, 'A5:A204', 'Reference!$F$2:$F$10');
    headers.forEach((_, index) => {
      ws.getColumn(index + 1).width = index >= 2 ? 28 : 16;
    });
    ws.getRow(4).height = 30;
  }

  private addReference(
    workbook: ExcelJS.Workbook,
    lists: {
      assets: string[];
      locations: string[];
      energy: string[];
      methods: string[];
      proofs: string[];
      phases: string[];
    },
  ) {
    const ws = workbook.addWorksheet('Reference');
    const headers = [
      'AssetList',
      'WorkLocationList',
      'EnergyTypeList',
      'MethodList',
      'ProofList',
      'PhaseList',
    ];
    headers.forEach((name, index) => {
      const cell = ws.getCell(1, index + 1);
      cell.value = name;
      this.styleHeaderCell(cell);
    });
    const columns = [
      lists.assets,
      lists.locations,
      lists.energy,
      lists.methods,
      lists.proofs,
      lists.phases,
    ];
    columns.forEach((values, colIndex) => {
      values.forEach((value, rowIndex) => {
        const cell = ws.getCell(rowIndex + 2, colIndex + 1);
        cell.value = value;
        cell.border = THIN_BORDER;
      });
      ws.getColumn(colIndex + 1).width = 40;
    });
    ws.state = 'hidden';
  }

  private addListValidation(ws: ExcelJS.Worksheet, range: string, formulae: string) {
    (
      ws as ExcelJS.Worksheet & { dataValidations: { add: (r: string, v: object) => void } }
    ).dataValidations.add(range, {
      type: 'list',
      allowBlank: true,
      formulae: [formulae],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Select a value from the list',
    });
  }
}
