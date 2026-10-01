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
      if (JSON.stringify(from) !== JSON.stringify(to)) {
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
    const updated = { ...stored, answers: { ...kept, ...clean } };
    if (index === -1) next.push(updated);
    else next[index] = updated;
  }
  return next;
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
