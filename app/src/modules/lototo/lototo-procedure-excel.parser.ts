import ExcelJS from 'exceljs';
import { LOTOTO_SEQUENCE_PHASES } from '../../database/schema/lototo-procedure';
import {
  CreateLototoProcedureDto,
  LototoLockoutPointDto,
  LototoSequenceStepDto,
} from './dto/lototo-procedure.dto';
import { LOTOTO_ISOLATION_METHODS, LOTOTO_PROOFS, proofsForEnergy } from './lototo-point';
import type { LototoImportFieldError, ParsedLototoProcedureImport } from './lototo-procedure-import.types';

export const LOTOTO_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const LOTOTO_IMPORT_MAX_POINTS = 200;
export const LOTOTO_IMPORT_MAX_STEPS = 200;

const CODE_NAME_SEP = ' — ';

export function parseCodeNameCell(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const sep = text.indexOf(CODE_NAME_SEP);
  return (sep >= 0 ? text.slice(0, sep) : text).trim() || undefined;
}

function cellText(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const text = String(raw).trim();
  return text || undefined;
}

function cellInt(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  return n;
}

function pushError(
  errors: LototoImportFieldError[],
  sheet: string,
  field: string,
  message: string,
  code: string,
  row?: number,
) {
  errors.push({ sheet, row, field, message, code });
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(4);
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const key = String(cell.value ?? '').trim();
    if (key) map.set(key, col);
  });
  return map;
}

function readHeaderSheet(sheet: ExcelJS.Worksheet | undefined, errors: LototoImportFieldError[]) {
  if (!sheet) {
    pushError(errors, 'Header', 'sheet', 'Header sheet is required', 'SHEET_MISSING');
    return null;
  }

  const values = new Map<string, unknown>();
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 5) return;
    const field = String(row.getCell(1).value ?? '').trim();
    if (!field) return;
    values.set(field, row.getCell(2).value);
  });

  const procedureCode = cellText(values.get('ProcedureCode'));
  const title = cellText(values.get('Title'));
  const assetCode = parseCodeNameCell(values.get('Asset'));
  const workLocationCode = parseCodeNameCell(values.get('WorkLocation'));

  if (!procedureCode) {
    pushError(errors, 'Header', 'ProcedureCode', 'ProcedureCode is required', 'REQUIRED', 5);
  }
  if (!title) {
    pushError(errors, 'Header', 'Title', 'Title is required', 'REQUIRED');
  }
  if (!assetCode && !workLocationCode) {
    pushError(
      errors,
      'Header',
      'Asset',
      'At least one of Asset or WorkLocation is required',
      'REQUIRED_TARGET',
    );
  }

  const reviewRaw = cellText(values.get('ReviewDueOn'));
  if (reviewRaw && !/^\d{4}-\d{2}-\d{2}$/.test(reviewRaw)) {
    pushError(errors, 'Header', 'ReviewDueOn', 'Use ISO date YYYY-MM-DD', 'INVALID_DATE');
  }

  return {
    procedureCode: procedureCode ?? '',
    title: title ?? '',
    assetCode,
    workLocationCode,
    facility: cellText(values.get('Facility')),
    locationText: cellText(values.get('LocationText')),
    purpose: cellText(values.get('Purpose')),
    scope: cellText(values.get('Scope')),
    authorization: cellText(values.get('Authorization')),
    enforcement: cellText(values.get('Enforcement')),
    description: cellText(values.get('Description')),
    note: cellText(values.get('Note')),
    reviewDueOn: reviewRaw && /^\d{4}-\d{2}-\d{2}$/.test(reviewRaw) ? reviewRaw : undefined,
  };
}

function readLockoutPoints(sheet: ExcelJS.Worksheet | undefined, errors: LototoImportFieldError[]) {
  if (!sheet) {
    pushError(errors, 'LockoutPoints', 'sheet', 'LockoutPoints sheet is required', 'SHEET_MISSING');
    return [] as LototoLockoutPointDto[];
  }

  const cols = headerMap(sheet);
  const requiredHeaders = ['SortOrder', 'PointCode', 'EnergyType', 'Action'];
  for (const name of requiredHeaders) {
    if (!cols.has(name)) {
      pushError(errors, 'LockoutPoints', name, `Missing column ${name}`, 'COLUMN_MISSING', 4);
    }
  }

  const points: LototoLockoutPointDto[] = [];
  const seenCodes = new Set<string>();
  const seenOrders = new Set<number>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 5) return;
    const get = (name: string) => {
      const col = cols.get(name);
      return col ? row.getCell(col).value : undefined;
    };

    const sortOrder = cellInt(get('SortOrder'));
    const pointCode = cellText(get('PointCode'));
    const energyType = cellText(get('EnergyType'));
    const action = cellText(get('Action'));
    const energyOtherText = cellText(get('EnergyOtherText'));
    const magnitude = cellText(get('Magnitude'));
    const locationText = cellText(get('LocationText'));
    const method = cellText(get('Method'));
    const normalPosition = cellText(get('NormalPosition'));
    const isolatedPosition = cellText(get('IsolatedPosition'));
    const restoreAction = cellText(get('RestoreAction'));
    const device = cellText(get('Device'));
    const proof = cellText(get('Proof'));
    const drawingReference = cellText(get('DrawingReference'));
    const removeOrder = cellInt(get('RemoveOrder'));
    const verificationMethod = cellText(get('VerificationMethod'));

    const empty =
      sortOrder == null &&
      !pointCode &&
      !energyType &&
      !action &&
      !magnitude &&
      !locationText &&
      !method &&
      !device &&
      !proof;
    if (empty) return;

    if (sortOrder == null || sortOrder < 1) {
      pushError(errors, 'LockoutPoints', 'SortOrder', 'SortOrder must be a positive integer', 'INVALID', rowNumber);
    } else if (seenOrders.has(sortOrder)) {
      pushError(errors, 'LockoutPoints', 'SortOrder', `Duplicate SortOrder ${sortOrder}`, 'DUPLICATE', rowNumber);
    } else {
      seenOrders.add(sortOrder);
    }

    if (!pointCode) {
      pushError(errors, 'LockoutPoints', 'PointCode', 'PointCode is required', 'REQUIRED', rowNumber);
    } else if (seenCodes.has(pointCode)) {
      pushError(errors, 'LockoutPoints', 'PointCode', `Duplicate PointCode ${pointCode}`, 'DUPLICATE', rowNumber);
    } else {
      seenCodes.add(pointCode);
    }

    if (!energyType) {
      pushError(errors, 'LockoutPoints', 'EnergyType', 'EnergyType is required', 'REQUIRED', rowNumber);
    }

    if (!action) {
      pushError(errors, 'LockoutPoints', 'Action', 'Action is required', 'REQUIRED', rowNumber);
    }

    if (method && !(LOTOTO_ISOLATION_METHODS as readonly string[]).includes(method)) {
      pushError(errors, 'LockoutPoints', 'Method', `Unknown method ${method}`, 'INVALID_ENUM', rowNumber);
    }

    if (proof && !(LOTOTO_PROOFS as readonly string[]).includes(proof)) {
      pushError(errors, 'LockoutPoints', 'Proof', `Unknown proof ${proof}`, 'INVALID_ENUM', rowNumber);
    }

    if (energyType && proof) {
      const allowed = proofsForEnergy(energyType);
      if (!allowed.includes(proof as (typeof LOTOTO_PROOFS)[number])) {
        pushError(
          errors,
          'LockoutPoints',
          'Proof',
          `Proof ${proof} does not match energy ${energyType}`,
          'PROOF_MISMATCH',
          rowNumber,
        );
      }
    }

    if (energyType === 'other' && !energyOtherText) {
      pushError(
        errors,
        'LockoutPoints',
        'EnergyOtherText',
        'EnergyOtherText is required when EnergyType is other',
        'REQUIRED',
        rowNumber,
      );
    }

    if (points.length >= LOTOTO_IMPORT_MAX_POINTS) {
      pushError(
        errors,
        'LockoutPoints',
        'rows',
        `At most ${LOTOTO_IMPORT_MAX_POINTS} lockout points allowed`,
        'LIMIT',
        rowNumber,
      );
      return;
    }

    if (sortOrder != null && pointCode && energyType && action) {
      points.push({
        sortOrder,
        pointCode,
        energyType,
        energyOtherText: energyType === 'other' ? energyOtherText : undefined,
        magnitude,
        locationText,
        method: method as LototoLockoutPointDto['method'],
        normalPosition,
        isolatedPosition,
        action,
        restoreAction,
        device,
        proof: proof as LototoLockoutPointDto['proof'],
        drawingReference,
        removeOrder,
        verificationMethod,
      });
    }
  });

  if (points.length === 0) {
    pushError(errors, 'LockoutPoints', 'rows', 'At least one lockout point is required', 'REQUIRED');
  }

  return points;
}

function readSequenceSteps(sheet: ExcelJS.Worksheet | undefined, errors: LototoImportFieldError[]) {
  if (!sheet) {
    pushError(errors, 'SequenceSteps', 'sheet', 'SequenceSteps sheet is required', 'SHEET_MISSING');
    return [] as LototoSequenceStepDto[];
  }

  const cols = headerMap(sheet);
  for (const name of ['Phase', 'SequenceOrder', 'Title']) {
    if (!cols.has(name)) {
      pushError(errors, 'SequenceSteps', name, `Missing column ${name}`, 'COLUMN_MISSING', 4);
    }
  }

  const steps: LototoSequenceStepDto[] = [];
  const seen = new Set<string>();
  let applyCount = 0;
  let removeCount = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 5) return;
    const get = (name: string) => {
      const col = cols.get(name);
      return col ? row.getCell(col).value : undefined;
    };

    const phase = cellText(get('Phase'))?.toLowerCase();
    const sequenceOrder = cellInt(get('SequenceOrder'));
    const title = cellText(get('Title'));
    const action = cellText(get('Action'));
    const infoText = cellText(get('InfoText'));
    const verification = cellText(get('Verification'));
    const note = cellText(get('Note'));
    const description = cellText(get('Description'));

    const empty = !phase && sequenceOrder == null && !title && !action && !infoText;
    if (empty) return;

    if (!phase || !(LOTOTO_SEQUENCE_PHASES as readonly string[]).includes(phase)) {
      pushError(errors, 'SequenceSteps', 'Phase', 'Phase must be apply or remove', 'INVALID_ENUM', rowNumber);
    }
    if (sequenceOrder == null || sequenceOrder < 1) {
      pushError(
        errors,
        'SequenceSteps',
        'SequenceOrder',
        'SequenceOrder must be a positive integer',
        'INVALID',
        rowNumber,
      );
    }
    if (!title) {
      pushError(errors, 'SequenceSteps', 'Title', 'Title is required', 'REQUIRED', rowNumber);
    }

    if (phase && sequenceOrder != null) {
      const key = `${phase}:${sequenceOrder}`;
      if (seen.has(key)) {
        pushError(
          errors,
          'SequenceSteps',
          'SequenceOrder',
          `Duplicate ${phase} order ${sequenceOrder}`,
          'DUPLICATE',
          rowNumber,
        );
      } else {
        seen.add(key);
      }
      if (phase === 'apply') applyCount += 1;
      if (phase === 'remove') removeCount += 1;
    }

    if (steps.length >= LOTOTO_IMPORT_MAX_STEPS) {
      pushError(
        errors,
        'SequenceSteps',
        'rows',
        `At most ${LOTOTO_IMPORT_MAX_STEPS} sequence steps allowed`,
        'LIMIT',
        rowNumber,
      );
      return;
    }

    if (phase && (LOTOTO_SEQUENCE_PHASES as readonly string[]).includes(phase) && sequenceOrder && title) {
      steps.push({
        phase: phase as LototoSequenceStepDto['phase'],
        sequenceOrder,
        title,
        action,
        infoText,
        verification,
        note,
        description,
      });
    }
  });

  if (applyCount < 1) {
    pushError(errors, 'SequenceSteps', 'Phase', 'At least one apply step is required', 'REQUIRED');
  }
  if (removeCount < 1) {
    pushError(errors, 'SequenceSteps', 'Phase', 'At least one remove step is required', 'REQUIRED');
  }

  return steps;
}

/** Parse workbook bytes into a procedure DTO shell (master-data IDs unresolved). */
export async function parseLototoProcedureWorkbook(
  buffer: Buffer,
): Promise<{ parsed: ParsedLototoProcedureImport | null; errors: LototoImportFieldError[] }> {
  const errors: LototoImportFieldError[] = [];
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs typings expect an older Buffer shape than current @types/node
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    pushError(errors, 'File', 'file', 'File is not a valid .xlsx workbook', 'INVALID_FILE');
    return { parsed: null, errors };
  }

  const header = readHeaderSheet(workbook.getWorksheet('Header'), errors);
  const lockoutPoints = readLockoutPoints(workbook.getWorksheet('LockoutPoints'), errors);
  const sequenceSteps = readSequenceSteps(workbook.getWorksheet('SequenceSteps'), errors);

  if (!header || errors.length > 0) {
    return { parsed: null, errors };
  }

  const dto: CreateLototoProcedureDto = {
    code: header.procedureCode,
    title: header.title,
    facility: header.facility,
    locationText: header.locationText,
    purpose: header.purpose,
    scope: header.scope,
    authorization: header.authorization,
    enforcement: header.enforcement,
    description: header.description,
    note: header.note,
    reviewDueOn: header.reviewDueOn ?? null,
    lockoutPoints,
    sequenceSteps,
  };

  return {
    parsed: {
      dto,
      procedureCode: header.procedureCode,
      assetCode: header.assetCode,
      workLocationCode: header.workLocationCode,
    },
    errors,
  };
}
