import { fetchApi } from "@/lib/api";

/**
 * Permit templates (forms and check sheets) filled in on a permit. Mirrors the web app's
 * frontend/src/lib/organisation/templates.ts and lib/permit/form.ts helpers; the API validates answers.
 */
export type TemplateFieldType = "check" | "text" | "textarea" | "number" | "date" | "time" | "select" | "multiselect" | "signature";
export type TemplateRequiredStage = "submit" | "approval" | "closure";
export type TemplatePrefillSource =
  | "department"
  | "location"
  | "equipment"
  | "job-description"
  | "valid-from"
  | "valid-to"
  | "crew-names"
  | "crew-count";

export type TemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  help?: string;
  unit?: string;
  options?: string[];
  prefill?: TemplatePrefillSource;
  requiredAt?: TemplateRequiredStage;
};
export type TemplateSection = { id: string; title: string; fields: TemplateField[] };
export type TemplateConfig = { kind: "permit" | "check-sheet"; reference?: string; declaration?: string; sections: TemplateSection[] };

export type PermitTemplate = {
  id: string;
  name: string;
  status: string;
  appliesToAllTypes: boolean;
  permitTypeIds: string[];
  config: TemplateConfig | null;
};

export type SignatureAnswer = { name: string; date?: string; time?: string };
export type FormAnswer = string | number | string[] | SignatureAnswer;
export type FormAnswers = Record<string, FormAnswer>;
export type StoredFormResponse = { templateId: string; name: string; config: TemplateConfig; answers: FormAnswers };

export function listPermitTemplates() {
  return fetchApi<PermitTemplate[]>("/permit-templates");
}

/** Published templates that apply to the permit type, permit forms first. */
export function applicableTemplates(templates: PermitTemplate[], permitTypeId: string): PermitTemplate[] {
  return templates
    .filter((t) => t.status === "published" && t.config && (t.appliesToAllTypes || t.permitTypeIds.includes(permitTypeId)))
    .sort((a, b) => Number(b.config?.kind === "permit") - Number(a.config?.kind === "permit") || a.name.localeCompare(b.name));
}

export function isAnswered(value: FormAnswer | undefined): boolean {
  if (value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Boolean(value.name?.trim());
  return String(value).trim() !== "";
}

/** Required before submission; fields required at approval or closure are signed then. */
export function requiredForSubmit(field: TemplateField): boolean {
  return Boolean(field.required) && (field.requiredAt ?? "submit") === "submit";
}

/** Required fields signed at a later stage (approval or closure). */
export function fieldsAtStage(config: TemplateConfig, stage: "approval" | "closure"): TemplateField[] {
  return config.sections.flatMap((section) => section.fields).filter((field) => field.required && field.requiredAt === stage);
}

/** "Name: N required answers missing" per applicable template, for the submit check. */
export function missingFormAnswers(templates: PermitTemplate[], responses: Record<string, FormAnswers>): string[] {
  return templates.flatMap((template) => {
    const answers = responses[template.id] ?? {};
    const missing = (template.config?.sections ?? []).flatMap((s) => s.fields).filter((f) => requiredForSubmit(f) && !isAnswered(answers[f.id]));
    return missing.length ? [`${template.name}: ${missing.length} required ${missing.length === 1 ? "answer" : "answers"} missing`] : [];
  });
}

/** Fills empty "fill from permit" fields from what the permit already says, so nothing is typed twice. */
export function withPrefill(
  responses: Record<string, FormAnswers>,
  templates: PermitTemplate[],
  sources: Partial<Record<TemplatePrefillSource, string | number>>,
): Record<string, FormAnswers> {
  const next = { ...responses };
  for (const template of templates) {
    const answers = { ...(next[template.id] ?? {}) };
    for (const field of template.config?.sections.flatMap((s) => s.fields) ?? []) {
      const source = field.prefill ? sources[field.prefill] : undefined;
      if (source === undefined || source === "" || answers[field.id] !== undefined) continue;
      const value = field.type === "number" ? Number(source) : String(source);
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      answers[field.id] = value;
    }
    next[template.id] = answers;
  }
  return next;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** A signature for the signed-in person at this moment. */
export function signNow(name: string, now = new Date()): SignatureAnswer {
  return { name, date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

/** Edited approval/closure answers per template id; templates not touched are left out. */
export type StageAnswerEdits = Record<string, FormAnswers>;

export function stageAnswersOf(response: StoredFormResponse, stage: "approval" | "closure", edits: StageAnswerEdits): FormAnswers {
  return (
    edits[response.templateId] ??
    Object.fromEntries(fieldsAtStage(response.config, stage).flatMap((f) => (f.id in response.answers ? [[f.id, response.answers[f.id]]] : [])))
  );
}

/** Required approval/closure answers still empty, counting the person's edits. */
export function stageAnswersLeft(responses: StoredFormResponse[], stage: "approval" | "closure", edits: StageAnswerEdits): number {
  return responses.reduce(
    (left, response) => left + fieldsAtStage(response.config, stage).filter((f) => !isAnswered(stageAnswersOf(response, stage, edits)[f.id])).length,
    0,
  );
}

export type StageAnswersPayload = { expectedRevision: number; formResponses: { templateId: string; answers: FormAnswers }[] };

/** Request body part sent with the decision; undefined when nothing was edited. */
export function stageAnswersPayload(edits: StageAnswerEdits, expectedRevision: number): StageAnswersPayload | undefined {
  const formResponses = Object.entries(edits).map(([templateId, answers]) => ({ templateId, answers }));
  return formResponses.length ? { expectedRevision, formResponses } : undefined;
}
