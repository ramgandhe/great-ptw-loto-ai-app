import { ConflictException } from '@nestjs/common';

export const IN_USE_CODE = 'IN_USE';

export function parseForceQuery(value?: string | boolean | null): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true';
}

export function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i += 1) {
    if (typeof current === 'object' && current !== null && 'code' in current && (current as { code: unknown }).code === '23503') {
      return true;
    }
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return false;
}

export function throwInUse(assignments: string[]): never {
  throw new ConflictException({
    message: `${assignments.join('. ')}. Delete anyway to remove it from this list. Historical records stay.`,
    error: IN_USE_CODE,
    details: assignments,
  });
}
