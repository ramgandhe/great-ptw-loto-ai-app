import { BadRequestException } from '@nestjs/common';
import type { TemplateConfig, TemplateField, TemplateRequiredStage } from '../organisation/permit-template-library';

export type SignatureAnswer = { name: string; date?: string; time?: string };
export type FormAnswer = string | number | string[] | SignatureAnswer;

/**
 * A permit template filled in on a permit. The template is copied in, so later edits to the
 * template never change what an issued permit recorded.
 */
export type PermitFormResponse = {
  templateId: string;
  name: string;
  config: TemplateConfig;
  answers: Record<string, FormAnswer>;
};

export type TemplateForForms = { id: string; name: string; config: unknown };

const CHECK_ANSWERS = ['yes', 'no', 'na'];

/**
 * Compares answers by value. Postgres jsonb does not keep object key order, so a stored signature
 * can come back as {date, name, time}; plain JSON.stringify would call that a change.
 */
export function sameAnswer(a: unknown, b: unknown): boolean {
  const stable = (value: unknown): unknown =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([x], [y]) => x.localeCompare(y))
            .map(([k, v]) => [k, stable(v)]),
        )
      : Array.isArray(value)
        ? value.map(stable)
        : value;
  return JSON.stringify(stable(a ?? null)) === JSON.stringify(stable(b ?? null));
}
const MAX_TEXT = 4000;

function invalid(field: TemplateField): never {
  throw new BadRequestException(`Invalid answer for “${field.label}”`);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT;
}

/** Keeps answers for fields the template has, checked against each field's type. Empty answers are dropped. */
export function sanitizeAnswers(config: TemplateConfig, answers: Record<string, unknown>): Record<string, FormAnswer> {
  const clean: Record<string, FormAnswer> = {};
  for (const field of config.sections.flatMap((section) => section.fields)) {
    const value = answers[field.id];
    if (value === undefined || value === null || value === '') continue;
    switch (field.type) {
      case 'check':
        if (!CHECK_ANSWERS.includes(value as string)) invalid(field);
        clean[field.id] = value as string;
        break;
      case 'number': {
        const number = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(number)) invalid(field);
        clean[field.id] = number;
        break;
      }
      case 'select':
        if (!isText(value) || !(field.options ?? []).includes(value)) invalid(field);
        clean[field.id] = value;
        break;
      case 'multiselect':
        if (!Array.isArray(value) || !value.every((v) => (field.options ?? []).includes(v))) invalid(field);
        if ((value as string[]).length) clean[field.id] = [...new Set(value as string[])];
        break;
      case 'signature': {
        const sig = value as Partial<SignatureAnswer>;
        if (typeof sig !== 'object' || ![sig.name, sig.date, sig.time].every((part) => part === undefined || isText(part))) {
          invalid(field);
        }
        if (sig.name?.trim()) clean[field.id] = { name: sig.name.trim(), date: sig.date || undefined, time: sig.time || undefined };
        break;
      }
      default:
        if (!isText(value)) invalid(field);
        if (value.trim()) clean[field.id] = value;
    }
  }
  return clean;
}

/** Builds stored responses from the submitted answers, copying each template's current form. */
export function buildFormResponses(
  input: { templateId: string; answers: Record<string, unknown> }[],
  templates: TemplateForForms[],
): PermitFormResponse[] {
  const byId = new Map(templates.map((template) => [template.id, template]));
  return input.map((response) => {
    const template = byId.get(response.templateId);
    if (!template) {
      throw new BadRequestException('A form on this permit refers to a template that no longer exists');
    }
    const config = template.config as TemplateConfig;
    return { templateId: template.id, name: template.name, config, answers: sanitizeAnswers(config, response.answers) };
  });
}

export type FormAnswerChange = {
  templateId: string;
  sectionId: string;
  fieldId: string;
  from: FormAnswer | null;
  to: FormAnswer | null;
};

/** Every answer that differs between two saves of a permit's forms, including removed forms and cleared answers. */
export function diffFormAnswers(before: PermitFormResponse[], after: PermitFormResponse[]): FormAnswerChange[] {
  const changes: FormAnswerChange[] = [];
  const templateIds = new Set([...before, ...after].map((response) => response.templateId));
  for (const templateId of templateIds) {
    const old = before.find((response) => response.templateId === templateId);
    const next = after.find((response) => response.templateId === templateId);
    const oldAnswers = old?.answers ?? {};
    const newAnswers = next?.answers ?? {};
    const sectionOf = new Map<string, string>();
    for (const config of [old?.config, next?.config]) {
      for (const section of config?.sections ?? []) {
        for (const field of section.fields) sectionOf.set(field.id, section.id);
      }
    }
    for (const fieldId of new Set([...Object.keys(oldAnswers), ...Object.keys(newAnswers)])) {
      const from = oldAnswers[fieldId] ?? null;
      const to = newAnswers[fieldId] ?? null;
      if (!sameAnswer(from, to)) {
        changes.push({ templateId, sectionId: sectionOf.get(fieldId) ?? '', fieldId, from, to });
      }
    }
  }
  return changes;
}

const fieldsAt = (config: TemplateConfig, stage: TemplateRequiredStage) =>
  config.sections.flatMap((section) => section.fields).filter((field) => (field.requiredAt ?? 'submit') === stage);

/**
 * Sets the answers to fields required at `stage` (approval or closure), leaving every other answer
 * as it was. Uses the form copied onto the permit, or the template's form when the permit has none yet.
 */
export function applyStageAnswers(
  responses: PermitFormResponse[],
  input: { templateId: string; answers: Record<string, unknown> }[],
  templates: TemplateForForms[],
  stage: TemplateRequiredStage,
  /** The signed-in person: every new or changed signature given here is theirs, whatever name was typed. */
  signer: string,
): PermitFormResponse[] {
  const next = [...responses];
  for (const { templateId, answers } of input) {
    const index = next.findIndex((response) => response.templateId === templateId);
    const template = templates.find((candidate) => candidate.id === templateId);
    const stored = next[index] ?? (template && { templateId, name: template.name, config: template.config as TemplateConfig, answers: {} });
    if (!stored) throw new BadRequestException('A form on this permit refers to a template that no longer exists');
    const fields = fieldsAt(stored.config, stage);
    const kept = Object.fromEntries(Object.entries(stored.answers).filter(([id]) => !fields.some((field) => field.id === id)));
    const clean = sanitizeAnswers({ ...stored.config, sections: [{ id: stage, title: stage, fields }] }, answers);
    for (const field of fields.filter((f) => f.type === 'signature' && clean[f.id])) {
      const before = stored.answers[field.id];
      // A signature sent back unchanged is someone's existing attestation: keep it exactly as stored.
      // Only a new or changed signature is this person's, recorded under their own name.
      if (before !== undefined && sameAnswer(before, clean[field.id])) clean[field.id] = before;
      else clean[field.id] = { ...(clean[field.id] as SignatureAnswer), name: signer };
    }
    const updated = { ...stored, answers: { ...kept, ...clean } };
    if (index === -1) next.push(updated);
    else next[index] = updated;
  }
  return next;
}

const LATER_STAGES: TemplateRequiredStage[] = ['approval', 'closure'];
const isLaterStage = (field: TemplateField) => LATER_STAGES.includes(field.requiredAt ?? 'submit');

/**
 * Keeps approval/closure fields as they were stored: a draft save never writes them, because only
 * the person taking that decision may (through the decision itself).
 */
export function keepLaterStageAnswers(stored: PermitFormResponse[], incoming: PermitFormResponse[]): PermitFormResponse[] {
  return incoming.map((response) => {
    const before = stored.find((r) => r.templateId === response.templateId)?.answers ?? {};
    const answers = { ...response.answers };
    for (const field of response.config.sections.flatMap((s) => s.fields).filter(isLaterStage)) {
      if (before[field.id] === undefined) delete answers[field.id];
      else answers[field.id] = before[field.id];
    }
    return { ...response, answers };
  });
}

/** The stages whose answers a permit collects again when it enters `status` (a new approval or closure round). */
export function stagesReopenedBy(status: string): TemplateRequiredStage[] {
  if (status === 'pending_approval') return ['approval', 'closure'];
  if (status === 'execution_completed') return ['closure'];
  return [];
}

/** Removes the answers to fields required at the given stages. */
export function clearStageAnswers(responses: PermitFormResponse[], stages: TemplateRequiredStage[]): PermitFormResponse[] {
  return responses.map((response) => {
    const ids = new Set(response.config.sections.flatMap((s) => s.fields).filter((f) => stages.includes(f.requiredAt ?? 'submit')).map((f) => f.id));
    return { ...response, answers: Object.fromEntries(Object.entries(response.answers).filter(([id]) => !ids.has(id))) };
  });
}

/**
 * The forms a stage decision must check: every form captured on the permit, as captured (so
 * archiving or re-scoping a template later never removes a requirement), plus applicable
 * templates the permit has no answers for yet.
 */
export function formsToCheck(responses: PermitFormResponse[], applicable: TemplateForForms[]): TemplateForForms[] {
  const captured = responses.map((r) => ({ id: r.templateId, name: r.name, config: r.config }));
  return [...captured, ...applicable.filter((t) => !responses.some((r) => r.templateId === t.id))];
}

/** Required fields for this stage left empty, per template that applies to the permit. */
export function missingFormAnswers(
  applicable: TemplateForForms[],
  responses: PermitFormResponse[],
  stage: TemplateRequiredStage = 'submit',
): string[] {
  const errors: string[] = [];
  for (const template of applicable) {
    const config = template.config as TemplateConfig | null;
    const answers = responses.find((response) => response.templateId === template.id)?.answers ?? {};
    const missing = (config?.sections ?? [])
      .flatMap((section) => section.fields)
      .filter((field) => field.required && (field.requiredAt ?? 'submit') === stage && answers[field.id] === undefined)
      .map((field) => field.label);
    if (missing.length) {
      errors.push(
        `${template.name}: ${missing.length} required ${missing.length === 1 ? 'answer' : 'answers'} missing (${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''})`,
      );
    }
  }
  return errors;
}
