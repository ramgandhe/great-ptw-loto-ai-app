/**
 * Pause work = full daily leave-safe package (locked).
 * Reuses the same keys as end-of-day secure so field meaning stays consistent.
 */

import {
  buildDaySecureChecklistTemplate,
  missingDaySecureChecklistKeys,
  type DaySecureChecklistKey,
} from '../daily-progress/day-secure-checklist';

export type WorkPauseChecklistKey = DaySecureChecklistKey;

export function buildWorkPauseChecklistTemplate(dailyRevalidationRequired: boolean) {
  const template = buildDaySecureChecklistTemplate(dailyRevalidationRequired);
  return {
    ...template,
    purpose: 'pause' as const,
    title: 'Pause work — leave-safe',
  };
}

export function missingWorkPauseChecklistKeys(
  dailyRevalidationRequired: boolean,
  checklist: Record<string, unknown>,
  personnelCleared: boolean,
): string[] {
  return missingDaySecureChecklistKeys(
    dailyRevalidationRequired,
    checklist,
    personnelCleared,
  );
}
