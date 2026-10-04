"use client";

import { useState } from "react";
import { Check, CheckCheck, ChevronDown, PenLine } from "lucide-react";
import { laterStageNote, requiredForSubmit, type TemplateConfig, type TemplateField, type TemplatePrefillSource } from "@/lib/organisation/templates";
import { isAnswered } from "@/lib/permit/form";
import type { FormAnswer, FormAnswers, SignatureAnswer } from "@/lib/permit/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INPUT =
  "h-11 w-full rounded-lg border border-input bg-input-fill px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

const CHECK_OPTIONS = [
  { value: "yes", label: "Yes", on: "border-(--status-success) bg-(--status-success-bg) text-(--status-success)" },
  { value: "no", label: "No", on: "border-(--status-danger) bg-(--status-danger-bg) text-(--status-danger)" },
  { value: "na", label: "N/A", on: "border-(--border-strong) bg-muted text-foreground" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-60",
        "inline-flex items-center gap-1.5",
        selected ? "border-2 border-primary bg-primary/10 font-semibold" : "border-input bg-input-fill hover:bg-muted",
      )}
    >
      {selected ? <Check className="size-4" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function FieldInput({
  field,
  value,
  disabled,
  signerName,
  signOnly,
  onChange,
}: {
  field: TemplateField;
  value: FormAnswer | undefined;
  disabled?: boolean;
  signerName: string;
  /** Approval/closure signatures: the person can only sign as themselves (the server records them as signer). */
  signOnly?: boolean;
  onChange: (value: FormAnswer | undefined) => void;
}) {
  const id = `ff-${field.id}`;
  if (field.type === "signature" && signOnly) {
    const sig = value as SignatureAnswer | undefined;
    const now = new Date();
    return sig?.name ? (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          Signed by {sig.name}
          {sig.date ? <span className="text-muted-foreground">, {sig.date} {sig.time ?? ""}</span> : null}
        </span>
        <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} onClick={() => onChange(undefined)}>
          Remove
        </Button>
      </div>
    ) : (
      // No id here: the field's label would become the button's name; its own text says what it does.
      <Button
        type="button"
        variant="outline"
        aria-describedby={`${id}-label`}
        className="min-h-11 justify-self-start"
        disabled={disabled}
        onClick={() =>
          onChange({
            name: signerName,
            date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
            time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
          })
        }
      >
        <PenLine aria-hidden />
        Sign as {signerName || "me"}, now
      </Button>
    );
  }
  switch (field.type) {
    case "check":
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="inline-flex shrink-0 overflow-hidden rounded-lg border border-input">
          {CHECK_OPTIONS.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(selected ? undefined : option.value)}
                className={cn(
                  "min-h-11 min-w-12 border-l border-input px-3 text-sm first:border-l-0 disabled:opacity-60",
                  selected ? cn(option.on, "font-semibold") : "bg-input-fill hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    case "textarea":
      return (
        <textarea
          id={id}
          rows={3}
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT, "h-auto py-2")}
        />
      );
    case "number":
      return (
        <span className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            step="any"
            inputMode="decimal"
            disabled={disabled}
            value={value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            className={cn(INPUT, "max-w-40")}
          />
          {field.unit ? <span className="text-sm text-muted-foreground">{field.unit}</span> : null}
        </span>
      );
    case "date":
    case "time":
      return (
        <input
          id={id}
          type={field.type}
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT, "max-w-48")}
        />
      );
    case "select":
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <Chip key={option} selected={value === option} disabled={disabled} onClick={() => onChange(value === option ? undefined : option)}>
              {option}
            </Chip>
          ))}
        </div>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <Chip
              key={option}
              selected={selected.includes(option)}
              disabled={disabled}
              onClick={() => onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option])}
            >
              {option}
            </Chip>
          ))}
        </div>
      );
    }
    case "signature": {
      const sig = (value as SignatureAnswer | undefined) ?? { name: "" };
      const set = (patch: Partial<SignatureAnswer>) => onChange({ ...sig, ...patch });
      // Sized by its container, so it also fits a narrow decision panel.
      return (
        <div className="@container">
        <div className="grid gap-2 @lg:grid-cols-[1fr_9rem_7rem_auto] @lg:items-center">
          <input
            id={id}
            aria-label={`${field.label}: name`}
            placeholder="Name"
            disabled={disabled}
            value={sig.name}
            onChange={(e) => set({ name: e.target.value })}
            className={INPUT}
          />
          <input aria-label={`${field.label}: date`} type="date" disabled={disabled} value={sig.date ?? ""} onChange={(e) => set({ date: e.target.value })} className={INPUT} />
          <input aria-label={`${field.label}: time`} type="time" disabled={disabled} value={sig.time ?? ""} onChange={(e) => set({ time: e.target.value })} className={INPUT} />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => {
              const now = new Date();
              set({
                name: sig.name || signerName,
                date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
                time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
              });
            }}
          >
            <PenLine aria-hidden />
            {sig.name ? "Now" : "Me, now"}
          </Button>
        </div>
        </div>
      );
    }
    default:
      return <input id={id} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={INPUT} />;
  }
}

/**
 * Fill in one permit template, a section at a time (each folds open). Answers the permit already gives
 * (`fromPermit`: department, place, dates, crew, job) are not asked again; they follow the permit.
 * Yes/No/N.A. answers are one tap. A section's unanswered checks can be
 * confirmed as Yes together, after the questions and with an explicit confirmation that lists them;
 * answers already given (No, N/A) are never changed. The server records each answer under the signed-in person.
 */
export function TemplateFormFill({
  name,
  config,
  answers,
  disabled,
  signerName,
  showMissing,
  anchorId,
  fromPermit,
  onChange,
}: {
  /** Prefill sources the permit already holds: those fields are not shown. */
  fromPermit?: Set<TemplatePrefillSource>;
  /** After a refused submit: mark the required questions still unanswered. */
  showMissing?: boolean;
  /** Where an error link for this form lands. */
  anchorId?: string;
  name: string;
  config: TemplateConfig;
  answers: FormAnswers;
  disabled?: boolean;
  signerName: string;
  onChange: (answers: FormAnswers) => void;
}) {
  const asked = (field: TemplateField) => !(field.prefill && fromPermit?.has(field.prefill));
  const sections = config.sections.map((section) => ({ ...section, fields: section.fields.filter(asked) })).filter((section) => section.fields.length > 0);
  const linked = config.sections.flatMap((section) => section.fields).filter((field) => !asked(field));
  const fields = sections.flatMap((section) => section.fields);
  const leftIn = (list: TemplateField[]) => list.filter((field) => requiredForSubmit(field) && !isAnswered(answers[field.id])).length;
  const answered = fields.filter((field) => isAnswered(answers[field.id])).length;
  const requiredLeft = leftIn(fields);
  const [confirming, setConfirming] = useState<string | null>(null);
  // The first section with something required left starts open; after a refused submit, every such section is.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set([(sections.find((s) => leftIn(s.fields) > 0) ?? sections[0])?.id ?? ""]));
  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setAnswer = (fieldId: string, value: FormAnswer | undefined) => {
    const next = { ...answers };
    if (value === undefined) delete next[fieldId];
    else next[fieldId] = value;
    onChange(next);
  };

  return (
    <article id={anchorId} className="rounded-xl border border-border bg-card" aria-label={name}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h3 className="font-semibold">{name}</h3>
          {config.reference ? <p className="text-xs text-muted-foreground">Format {config.reference}</p> : null}
        </div>
        <p className="text-sm tabular-nums">
          {answered} of {fields.length} answered
          {requiredLeft ? <span className="text-(--status-warning)"> · {requiredLeft} required left</span> : <span className="text-(--status-success)"> · required done</span>}
        </p>
      </header>
      <div className="grid gap-2 px-5 py-4">
        {linked.length ? (
          <p className="mb-2 text-sm text-muted-foreground">From this permit, not asked again: {linked.map((field) => field.label).join(", ")}.</p>
        ) : null}
        {sections.map((section) => {
          const openChecks = section.fields.filter((field) => field.type === "check" && !laterStageNote(field) && !isAnswered(answers[field.id]));
          const left = leftIn(section.fields);
          const later = section.fields.every((field) => laterStageNote(field));
          const expanded = openIds.has(section.id) || Boolean(showMissing && left);
          return (
            <section key={section.id} aria-labelledby={`sec-${section.id}`} className="border-b border-border pb-2 last:border-b-0">
              <h4 id={`sec-${section.id}`} className="text-sm font-semibold">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggle(section.id)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md text-left hover:bg-muted/50"
                >
                  <span className="flex-1">{section.title}</span>
                  <span className={cn("text-xs font-medium", later ? "text-muted-foreground" : left ? "text-(--status-warning)" : "text-(--status-success)")}>
                    {later ? "Signed later" : left ? `${left} left` : "Done"}
                  </span>
                  <ChevronDown aria-hidden className={cn("size-4 transition-transform", expanded ? "rotate-180" : "")} />
                </button>
              </h4>
              {expanded ? (
              <>
              <ol className="mt-2 grid gap-3">
                {section.fields.map((field) => (
                  <li
                    key={field.id}
                    data-missing={showMissing && requiredForSubmit(field) && !isAnswered(answers[field.id]) ? "" : undefined}
                    className={field.type === "check" ? "flex flex-wrap items-center justify-between gap-x-4 gap-y-2" : "grid gap-1.5"}
                  >
                    <label id={`ff-${field.id}-label`} htmlFor={`ff-${field.id}`} className="text-sm text-(--text-secondary)">
                      {field.label}
                      {requiredForSubmit(field) ? <span className="text-destructive"> *</span> : null}
                      {laterStageNote(field) ? <span className="block text-xs text-muted-foreground">{laterStageNote(field)}</span> : null}
                      {field.help ? <span className="block text-xs text-muted-foreground">{field.help}</span> : null}
                      {showMissing && requiredForSubmit(field) && !isAnswered(answers[field.id]) ? (
                        <span className="block text-xs font-medium text-destructive">Required before submitting</span>
                      ) : null}
                    </label>
                    {/* Approval and closure fields are signed by that decision's maker, at that decision. */}
                    {laterStageNote(field) ? (
                      <p id={`ff-${field.id}`} className="text-sm text-muted-foreground">
                        {!isAnswered(answers[field.id]) ? "Not filled in yet" : field.type === "signature" ? `Signed by ${(answers[field.id] as SignatureAnswer).name}` : "Answered"}
                      </p>
                    ) : (
                      <FieldInput
                        field={field}
                        value={answers[field.id]}
                        disabled={disabled}
                        signerName={signerName}
                        onChange={(value) => setAnswer(field.id, value)}
                      />
                    )}
                  </li>
                ))}
              </ol>
              {openChecks.length > 1 && !disabled ? (
                confirming === section.id ? (
                  <div role="group" aria-labelledby={`confirm-${section.id}`} className="mt-3 grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p id={`confirm-${section.id}`} className="font-medium">
                      Confirm these {openChecks.length} checks are Yes
                    </p>
                    <ul className="list-disc pl-5">
                      {openChecks.map((field) => (
                        <li key={field.id}>{field.label}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">Your answers are recorded under your name.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="min-h-11"
                        onClick={() => {
                          onChange({ ...answers, ...Object.fromEntries(openChecks.map((field) => [field.id, "yes"])) });
                          setConfirming(null);
                        }}
                      >
                        I confirm these {openChecks.length} checks are Yes
                      </Button>
                      <Button type="button" variant="ghost" className="min-h-11" onClick={() => setConfirming(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => setConfirming(section.id)}>
                    <CheckCheck aria-hidden />
                    Confirm {openChecks.length} unanswered checks as Yes
                  </Button>
                )
              ) : null}
              </>
              ) : null}
            </section>
          );
        })}
        {config.declaration ? <p className="rounded-lg bg-muted/60 p-3 text-xs italic">{config.declaration}</p> : null}
      </div>
    </article>
  );
}
