import { LOTOTO_ENERGY_TYPES } from '../lototo/lototo.constants';
import { LOTOTO_ISOLATION_METHODS, LOTOTO_PROOFS, proofsForEnergy } from '../lototo/lototo-point';
import type {
  LototoPdfExtractionResult,
  LototoPdfImageRef,
  LototoPdfLlmDraft,
  LototoPdfTextLine,
  LototoPdfWarning,
} from './lototo-pdf-extraction.types';

function text(value: unknown): string | undefined {
  if (value == null) return undefined;
  const out = String(value).trim();
  return out || undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function missingSequencePhase(raw: LototoPdfLlmDraft): 'apply' | 'remove' | undefined {
  const steps = (raw.sequenceSteps ?? [])
    .map((row, index) => normalizeStep(asRecord(row), index, []))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const apply = steps.some((step) => step.phase === 'apply');
  const remove = steps.some((step) => step.phase === 'remove');
  if (apply && !remove) return 'remove';
  if (remove && !apply) return 'apply';
  return undefined;
}

export function normalizeLototoPdfDraft(
  raw: LototoPdfLlmDraft,
): { result?: LototoPdfExtractionResult; fatal?: string; warnings: LototoPdfWarning[] } {
  const warnings: LototoPdfWarning[] = [];
  const code = text(raw.code) ?? '';
  const title = text(raw.title) ?? '';
  if (!code) {
    warnings.push({
      field: 'Code',
      code: 'REQUIRED',
      message: 'The PDF has no procedure code. Enter a code on this draft.',
    });
  }
  if (!title) {
    warnings.push({
      field: 'Title',
      code: 'REQUIRED',
      message: 'The PDF has no procedure title. Enter a title on this draft.',
    });
  }

  const points = (raw.lockoutPoints ?? [])
    .map((row, index) => normalizePoint(asRecord(row), index, warnings))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const steps = dedupeSteps(
    (raw.sequenceSteps ?? [])
      .map((row, index) => normalizeStep(asRecord(row), index, warnings))
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    warnings,
  );

  if (points.length === 0) {
    warnings.push({
      field: 'LockoutPoints',
      code: 'REQUIRED',
      message: 'The PDF has no lockout points. Add the points on this draft.',
    });
  }
  if (!steps.some((step) => step.phase === 'apply')) {
    warnings.push({
      field: 'SequenceSteps',
      code: 'REQUIRED',
      message: 'The PDF has no apply steps. Add them under Apply steps.',
    });
  }
  if (!steps.some((step) => step.phase === 'remove')) {
    warnings.push({
      field: 'SequenceSteps',
      code: 'REQUIRED',
      message: 'The PDF has no remove steps. Add them under Remove steps.',
    });
  }

  return {
    warnings,
    result: {
      procedureCode: code,
      assetCode: text(raw.assetCode),
      workLocationCode: text(raw.workLocationCode),
      warnings,
      images: [],
      dto: {
        code,
        title,
        reviewDueOn: text(raw.reviewDueOn) ?? null,
        facility: text(raw.facility),
        locationText: text(raw.locationText),
        purpose: text(raw.purpose),
        scope: text(raw.scope),
        authorization: text(raw.authorization),
        enforcement: text(raw.enforcement),
        description: text(raw.description),
        note: text(raw.note),
        lockoutPoints: points,
        sequenceSteps: steps,
        authorizedRoles: [],
      },
    },
  };
}

function normalizePoint(row: Record<string, unknown> | undefined, index: number, warnings: LototoPdfWarning[]) {
  if (!row) return undefined;
  const pointCode = text(row.pointCode) ?? text(row.code);
  const action = text(row.action);
  if (!pointCode) {
    warnings.push({
      field: 'LockoutPoints',
      code: 'SKIPPED',
      message: `Lockout point ${index + 1} has no point code, so it was not added. Add that point on the draft if the PDF includes it.`,
    });
    return undefined;
  }
  const energyRaw = text(row.energyType);
  let energyType = (energyRaw ?? 'other').toLowerCase().replace(/\s+/g, '_');
  if (!(LOTOTO_ENERGY_TYPES as readonly string[]).includes(energyType)) {
    warnings.push({
      field: 'EnergyType',
      code: 'ADJUSTED',
      message: `Point ${pointCode}: energy "${energyRaw ?? energyType}" is not in the list, so it was saved as Other. Change the energy on point ${pointCode}.`,
    });
    energyType = 'other';
  }
  const methodRaw = text(row.method)?.toLowerCase();
  const method = methodRaw && (LOTOTO_ISOLATION_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as (typeof LOTOTO_ISOLATION_METHODS)[number])
    : undefined;
  if (methodRaw && !method) {
    warnings.push({
      field: 'Method',
      code: 'CLEARED',
      message: `Point ${pointCode}: method "${methodRaw}" is not recognised, so Method was left blank. Choose a method on point ${pointCode}.`,
    });
  }
  const proofRaw = text(row.proof)?.toLowerCase();
  let proof =
    proofRaw && (LOTOTO_PROOFS as readonly string[]).includes(proofRaw)
      ? (proofRaw as (typeof LOTOTO_PROOFS)[number])
      : undefined;
  if (proofRaw && !proof) {
    warnings.push({
      field: 'Proof',
      code: 'CLEARED',
      message: `Point ${pointCode}: proof "${proofRaw}" is not recognised, so Proof was left blank. Choose a proof on point ${pointCode}.`,
    });
  }
  if (proof && !proofsForEnergy(energyType).includes(proof)) {
    const allowed = proofsForEnergy(energyType).map(proofLabel).join(', ');
    warnings.push({
      field: 'Proof',
      code: 'CLEARED',
      message: `Point ${pointCode}: proof "${proofLabel(proof)}" does not apply to ${energyType}. Set the proof to ${allowed}.`,
    });
    proof = undefined;
  }
  if (!action) {
    warnings.push({
      field: 'Action',
      code: 'REQUIRED',
      message: `Point ${pointCode} has no isolation action. Write how to isolate it.`,
    });
  }
  const sortOrder = Number(row.sortOrder);
  return {
    sortOrder: Number.isFinite(sortOrder) && sortOrder >= 1 ? sortOrder : index + 1,
    pointCode,
    energyType,
    energyOtherText: energyType === 'other' ? text(row.energyOtherText) ?? text(row.energyType) : text(row.energyOtherText),
    magnitude: text(row.magnitude),
    locationText: text(row.locationText),
    method,
    normalPosition: text(row.normalPosition),
    isolatedPosition: text(row.isolatedPosition),
    action,
    restoreAction: text(row.restoreAction),
    device: text(row.device),
    proof,
    drawingReference: text(row.drawingReference),
    removeOrder: Number.isFinite(Number(row.removeOrder)) ? Number(row.removeOrder) : undefined,
    verificationMethod: text(row.verificationMethod),
  };
}

const PHASE_ALIASES: Record<string, 'apply' | 'remove'> = {
  apply: 'apply',
  application: 'apply',
  lockout: 'apply',
  lockout_application: 'apply',
  isolate: 'apply',
  isolation: 'apply',
  shutdown: 'apply',
  remove: 'remove',
  removal: 'remove',
  lockout_removal: 'remove',
  restore: 'remove',
  restoration: 'remove',
  release: 'remove',
  reinstatement: 'remove',
  deisolation: 'remove',
  de_isolation: 'remove',
  before: 'apply',
  before_work: 'apply',
  startup: 'apply',
  start_up: 'apply',
};

function dedupeSteps(
  steps: Array<{ phase: 'apply' | 'remove'; sequenceOrder: number; title: string }>,
  warnings: LototoPdfWarning[],
) {
  const seen = new Set<string>();
  let skipped = 0;
  const kept = steps.filter((step) => {
    const key = `${step.phase}:${step.sequenceOrder}`;
    if (seen.has(key)) {
      skipped += 1;
      return false;
    }
    seen.add(key);
    return true;
  });
  if (skipped > 0) {
    warnings.push({
      field: 'SequenceSteps',
      code: 'SKIPPED',
      message:
        skipped === 1
          ? '1 repeated sequence step was ignored. Check the apply and remove steps for anything missing.'
          : `${skipped} repeated sequence steps were ignored. Check the apply and remove steps for anything missing.`,
    });
  }
  return kept;
}

function resolvePhase(phaseRaw: string | undefined): 'apply' | 'remove' | undefined {
  if (!phaseRaw) return undefined;
  if (PHASE_ALIASES[phaseRaw]) return PHASE_ALIASES[phaseRaw];
  if (/remov|restor|reinstat|de_?isolat|energi[sz]e|return_to_service/.test(phaseRaw)) return 'remove';
  if (/apply|isolat|shut|lock|start/.test(phaseRaw)) return 'apply';
  return undefined;
}

function normalizeStep(row: Record<string, unknown> | undefined, index: number, warnings: LototoPdfWarning[]) {
  if (!row) return undefined;
  const phaseRaw = text(row.phase)?.toLowerCase().replace(/[\s/-]+/g, '_');
  const title = text(row.title);
  if (!title) {
    warnings.push({
      field: 'SequenceSteps',
      code: 'SKIPPED',
      message: `Sequence row ${index + 1} has no title, so it was not added. Add it under Apply steps or Remove steps.`,
    });
    return undefined;
  }
  const phase = resolvePhase(phaseRaw) ?? 'apply';
  if (!phaseRaw || !resolvePhase(phaseRaw)) {
    warnings.push({
      field: 'SequenceSteps',
      code: 'ADJUSTED',
      message: `Sequence row ${index + 1} "${title}" had no apply or remove phase, so it was added under Apply steps. Move it if it belongs under Remove steps.`,
    });
  }
  const sequenceOrder = Number(row.sequenceOrder);
  return {
    phase,
    sequenceOrder: Number.isFinite(sequenceOrder) && sequenceOrder >= 1 ? sequenceOrder : index + 1,
    title,
    action: text(row.action),
    infoText: text(row.infoText),
    verification: text(row.verification),
    note: text(row.note),
    description: text(row.description),
  };
}

export function assignPhotosByPosition(
  images: Array<{ index: number; pageNumber: number; centerY: number; height: number }>,
  lines: LototoPdfTextLine[],
  pointCodes: string[],
): { refs: LototoPdfImageRef[]; warnings: LototoPdfWarning[] } {
  const anchors = pointCodes.flatMap((pointCode) => {
    const needle = pointCode.trim().toLowerCase();
    return lines
      .filter((line) => line.text.trim().toLowerCase() === needle)
      .map((line) => ({ pointCode, pageNumber: line.pageNumber, centerY: line.centerY }));
  });
  const pairs = images.flatMap((image) => {
    const limit = image.height / 2 + 12;
    return anchors
      .filter((anchor) => anchor.pageNumber === image.pageNumber)
      .map((anchor) => ({ imageIndex: image.index, pointCode: anchor.pointCode, distance: Math.abs(anchor.centerY - image.centerY) }))
      .filter((pair) => pair.distance <= limit);
  });
  pairs.sort((left, right) => left.distance - right.distance);
  const usedImages = new Set<number>();
  const usedPoints = new Set<string>();
  const assigned = new Map<number, string>();
  for (const pair of pairs) {
    if (usedImages.has(pair.imageIndex) || usedPoints.has(pair.pointCode)) continue;
    usedImages.add(pair.imageIndex);
    usedPoints.add(pair.pointCode);
    assigned.set(pair.imageIndex, pair.pointCode);
  }
  const refs = images.map((image) => {
    const pointCode = assigned.get(image.index);
    return pointCode ? { index: image.index, pointCode } : { index: image.index };
  });
  const unassigned = refs.filter((ref) => !ref.pointCode).length;
  const warnings: LototoPdfWarning[] = [];
  if (unassigned > 0) {
    warnings.push({
      field: 'Image',
      code: 'UNASSIGNED',
      message:
        unassigned === 1
          ? '1 photo could not be matched to a lockout point. Place it under Unassigned photos.'
          : `${unassigned} photos could not be matched to a lockout point. Place them under Unassigned photos.`,
    });
  }
  return { refs, warnings };
}

const PROOF_LABELS: Record<string, string> = {
  meter: 'Meter',
  try_start: 'Try-start',
  gauge: 'Gauge and bleed',
  temperature: 'Temperature',
  no_movement: 'No movement',
  pin: 'Pin or block',
  drained: 'Drained and locked',
  blind: 'Blind',
  survey: 'Survey',
  source_removed: 'Source removed',
  visual: 'Visual check',
};

function proofLabel(code: string) {
  return PROOF_LABELS[code] ?? code.replace(/_/g, ' ');
}
