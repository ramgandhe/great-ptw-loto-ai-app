import { BadRequestException } from '@nestjs/common';

export type ProofResult = 'pass' | 'fail';

type ProofInput = {
  proof: string;
  result: ProofResult;
  readings: Record<string, unknown>;
  instrumentMakeModel?: string | null;
  instrumentSerialNo?: string | null;
  calibrationExpiryDate?: string | null;
  today?: string;
};

function flag(readings: Record<string, unknown>, key: string) {
  return readings[key] === true;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/** A passing proof has to match the point. A failed proof is stored as its own event. */
export function assertProofAcceptable(input: ProofInput) {
  if (input.result !== 'pass') {
    if (input.calibrationExpiryDate && !calibrationIsCurrent(input.calibrationExpiryDate, input.today)) {
      throw new BadRequestException('The instrument calibration date has passed');
    }
    return;
  }

  const readings = input.readings ?? {};
  switch (input.proof) {
    case 'meter': {
      if (!text(input.instrumentMakeModel) || !text(input.instrumentSerialNo) || !input.calibrationExpiryDate) {
        throw new BadRequestException('A meter proof needs the instrument, its serial number, and its calibration date');
      }
      if (!calibrationIsCurrent(input.calibrationExpiryDate, input.today)) {
        throw new BadRequestException('The instrument calibration date has passed');
      }
      if (!flag(readings, 'meterProved') || !flag(readings, 'equipmentDead') || !flag(readings, 'meterProvedAgain')) {
        throw new BadRequestException('Electrical proof is live, dead, then live again');
      }
      return;
    }
    case 'gauge': {
      if (!text(readings.reading) || !flag(readings, 'ventOpen') || !flag(readings, 'bleedOpen')) {
        throw new BadRequestException('Pressure proof needs a gauge reading, an open vent, and an open bleed');
      }
      return;
    }
    case 'pin': {
      if (!flag(readings, 'noMovement') || !flag(readings, 'pinInserted')) {
        throw new BadRequestException('This point is proved by no movement and the pin in place');
      }
      return;
    }
    case 'no_movement': {
      if (!flag(readings, 'noMovement')) {
        throw new BadRequestException('This point is proved by no movement');
      }
      return;
    }
    case 'try_start': {
      if (!flag(readings, 'attempted') || !flag(readings, 'didNotRun')) {
        throw new BadRequestException('Try-start is proved when the start is attempted and the equipment does not run');
      }
      return;
    }
    case 'temperature': {
      if (!text(readings.reading)) {
        throw new BadRequestException('Temperature proof needs a reading');
      }
      return;
    }
    default: {
      if (!flag(readings, 'confirmed')) {
        throw new BadRequestException('Confirm this proof before it can pass');
      }
    }
  }
}

export function calibrationIsCurrent(expiry: string, today = new Date().toISOString().slice(0, 10)) {
  return expiry.slice(0, 10) >= today.slice(0, 10);
}

export function earlierUnappliedPoint<T extends { id: string; sortOrder: number; appliedAt: Date | string | null; pointCode: string }>(
  points: T[],
  pointId: string,
): T | null {
  const ordered = [...points].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((point) => point.id === pointId);
  if (index < 0) return null;
  return ordered.slice(0, index).find((point) => !point.appliedAt) ?? null;
}
