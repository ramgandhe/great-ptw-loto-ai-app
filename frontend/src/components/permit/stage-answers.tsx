"use client";

import { fieldsAtStage } from "@/lib/organisation/templates";
import { isAnswered } from "@/lib/permit/form";
import type { FormAnswers, StoredFormResponse } from "@/lib/permit/types";
import { FieldInput } from "./template-form-fill";

type Stage = "approval" | "closure";
/** Edited stage answers per template id; templates not touched are left out. */
export type StageAnswerEdits = Record<string, FormAnswers>;

const answersOf = (response: StoredFormResponse, stage: Stage, edits: StageAnswerEdits) =>
  edits[response.templateId] ??
  Object.fromEntries(fieldsAtStage(response.config, stage).flatMap((field) => (field.id in response.answers ? [[field.id, response.answers[field.id]]] : [])));

/** Required stage answers still empty, counting the person's edits. */
export function stageAnswersLeft(responses: StoredFormResponse[], stage: Stage, edits: StageAnswerEdits): number {
  return responses.reduce(
    (left, response) => left + fieldsAtStage(response.config, stage).filter((field) => !isAnswered(answersOf(response, stage, edits)[field.id])).length,
    0,
  );
}

/** Request body part for the decision; undefined when nothing was edited. */
export function stageAnswersPayload(edits: StageAnswerEdits, expectedRevision: number) {
  const formResponses = Object.entries(edits).map(([templateId, answers]) => ({ templateId, answers }));
  return formResponses.length ? { expectedRevision, formResponses } : undefined;
}

/**
 * The permit's form fields that are signed at approval or closure, shown beside that decision.
 * The server records each answer under the signed-in person, with the decision.
 */
export function StageAnswers({
  responses,
  stage,
  edits,
  onChange,
  signerName,
  disabled,
}: {
  responses: StoredFormResponse[];
  stage: Stage;
  edits: StageAnswerEdits;
  onChange: (edits: StageAnswerEdits) => void;
  signerName: string;
  disabled?: boolean;
}) {
  const forms = responses.filter((response) => fieldsAtStage(response.config, stage).length > 0);
  if (forms.length === 0) return null;
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="text-sm font-medium">Sign the form for {stage}</legend>
      {forms.map((response) => {
        const answers = answersOf(response, stage, edits);
        return (
          <div key={response.templateId} className="grid gap-3">
            {forms.length > 1 ? <p className="text-xs font-medium text-muted-foreground">{response.name}</p> : null}
            {fieldsAtStage(response.config, stage).map((field) => (
              <div key={field.id} className="grid gap-1.5">
                <label id={`ff-${field.id}-label`} htmlFor={`ff-${field.id}`} className="text-sm">
                  {field.label}
                  <span className="text-destructive"> *</span>
                  {field.help ? <span className="block text-xs text-muted-foreground">{field.help}</span> : null}
                </label>
                <FieldInput
                  field={field}
                  value={answers[field.id]}
                  disabled={disabled}
                  signerName={signerName}
                  signOnly
                  onChange={(value) => {
                    const next = { ...answers };
                    if (value === undefined) delete next[field.id];
                    else next[field.id] = value;
                    onChange({ ...edits, [response.templateId]: next });
                  }}
                />
              </div>
            ))}
          </div>
        );
      })}
    </fieldset>
  );
}
