"use client";

import { laterStageNote, requiredForSubmit, type TemplateConfig, type TemplateField } from "@/lib/organisation/templates";

const CONTROL = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground";

function FieldControl({ field }: { field: TemplateField }) {
  switch (field.type) {
    case "check":
      return (
        <span className="inline-flex overflow-hidden rounded-lg border border-border text-xs" aria-hidden>
          {["Yes", "No", "N/A"].map((option) => (
            <span key={option} className="border-l border-border px-2.5 py-1.5 first:border-l-0">
              {option}
            </span>
          ))}
        </span>
      );
    case "textarea":
      return <span className={`${CONTROL} block h-16`} aria-hidden />;
    case "select":
    case "multiselect":
      return (
        <span className="flex flex-wrap gap-1.5" aria-hidden>
          {(field.options?.length ? field.options : ["Option"]).map((option) => (
            <span key={option} className="rounded-full border border-border px-2.5 py-1 text-xs">
              {field.type === "multiselect" ? "☐ " : ""}
              {option}
            </span>
          ))}
        </span>
      );
    case "signature":
      return (
        <span className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4" aria-hidden>
          {["Name", "Date", "Time", "Sign"].map((part) => (
            <span key={part} className="border-b border-dashed border-border pb-1">
              {part}
            </span>
          ))}
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-2" aria-hidden>
          <span className={CONTROL} />
          {field.unit ? <span className="text-sm text-muted-foreground">{field.unit}</span> : null}
        </span>
      );
  }
}

/** Read-only rendering of a template, as the person filling in the permit will see it. */
export function TemplateFormPreview({ name, config }: { name: string; config: TemplateConfig }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-heading text-lg font-bold">{name || "Untitled template"}</p>
        {config.reference ? <p className="text-xs text-muted-foreground">Format {config.reference}</p> : null}
      </div>
      {config.sections.map((section) => (
        <section key={section.id}>
          <h3 className="border-b border-border pb-1 text-sm font-semibold">{section.title || "Untitled section"}</h3>
          {section.fields.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No fields in this section yet.</p>
          ) : (
            <ol className="mt-2 grid gap-3">
              {section.fields.map((field) => (
                <li key={field.id} className={field.type === "check" ? "flex flex-wrap items-center justify-between gap-2" : "grid gap-1.5"}>
                  <span className="text-sm">
                    {field.label || "Untitled field"}
                    {requiredForSubmit(field) ? <span className="text-destructive"> *</span> : null}
                    {laterStageNote(field) ? <span className="block text-xs text-muted-foreground">{laterStageNote(field)}</span> : null}
                    {field.help ? <span className="block text-xs text-muted-foreground">{field.help}</span> : null}
                  </span>
                  <FieldControl field={field} />
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
      {config.declaration ? <p className="rounded-lg bg-muted/60 p-3 text-xs italic">{config.declaration}</p> : null}
    </div>
  );
}
