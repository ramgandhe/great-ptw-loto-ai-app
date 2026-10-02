import type { FormAnswer, PermitFormState } from "./types";

/** One value both people changed differently; the person chooses which to keep. */
export type FieldConflict = { key: string; saved: unknown; yours: unknown };

const FIELDS = [
  "permitTypeId",
  "title",
  "workScope",
  "plantId",
  "departmentId",
  "locationId",
  "workstationId",
  "machineryId",
  "plannedStartAt",
  "plannedEndAt",
  "hazards",
  "ppe",
  "lototoRequired",
  "lototo",
  "gasTestingRequired",
  "gasTesting",
  "executors",
  "viewers",
  "safetyOfficers",
] as const satisfies readonly (keyof PermitFormState)[];

// By value, whatever the key order (stored signatures come back with their keys reordered).
const stable = (value: unknown): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([k, v]) => [k, stable(v)]),
      )
    : Array.isArray(value)
      ? value.map(stable)
      : value;
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a ?? null)) === JSON.stringify(stable(b ?? null));

/**
 * After a save is refused because someone else saved first: a three-way merge of what was loaded
 * (`base`), what this person has (`local`) and what is saved now (`saved`). A value only one side
 * changed takes that side, so the other person's unrelated edits are kept; a value both changed
 * differently is a conflict for the person to decide, with their own value kept until they do.
 * Lists (hazards, crew…) count as one value each; form answers count per field.
 */
export function mergeAfterConflict(
  base: PermitFormState,
  local: PermitFormState,
  saved: PermitFormState,
): { merged: PermitFormState; conflicts: FieldConflict[] } {
  const merged: PermitFormState = { ...local, formResponses: { ...local.formResponses } };
  const conflicts: FieldConflict[] = [];
  const pick = <T,>(key: string, b: T, l: T, s: T, take: (value: T) => void) => {
    if (same(l, s) || same(s, b)) return; // equal already, or only this person changed it
    if (same(l, b)) return take(s); // only the other person changed it
    conflicts.push({ key, saved: s, yours: l });
  };
  for (const field of FIELDS) {
    pick(`field:${field}`, base[field], local[field], saved[field], (value) => Object.assign(merged, { [field]: value }));
  }
  const templates = new Set([...Object.keys(base.formResponses), ...Object.keys(local.formResponses), ...Object.keys(saved.formResponses)]);
  for (const templateId of templates) {
    const b = base.formResponses[templateId] ?? {};
    const l = local.formResponses[templateId] ?? {};
    const s = saved.formResponses[templateId] ?? {};
    for (const fieldId of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(s)])) {
      pick<FormAnswer | undefined>(`form:${templateId}:${fieldId}`, b[fieldId], l[fieldId], s[fieldId], (value) => {
        const answers = { ...(merged.formResponses[templateId] ?? {}) };
        if (value === undefined) delete answers[fieldId];
        else answers[fieldId] = value;
        merged.formResponses[templateId] = answers;
      });
    }
  }
  return { merged, conflicts };
}

/** Applies the person's choice for one conflict to the form. */
export function resolveConflict(form: PermitFormState, conflict: FieldConflict, keep: "saved" | "yours"): PermitFormState {
  const value = keep === "saved" ? conflict.saved : conflict.yours;
  const [kind, a, b] = conflict.key.split(":");
  if (kind === "field") return { ...form, [a]: value };
  const answers = { ...(form.formResponses[a] ?? {}) };
  if (value === undefined) delete answers[b];
  else answers[b] = value as FormAnswer;
  return { ...form, formResponses: { ...form.formResponses, [a]: answers } };
}
