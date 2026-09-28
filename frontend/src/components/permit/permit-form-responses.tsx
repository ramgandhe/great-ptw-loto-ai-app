import { AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { TemplateField } from "@/lib/organisation/templates";
import type { FormAnswer, SignatureAnswer, StoredFormResponse } from "@/lib/permit/types";
import { cn } from "@/lib/utils";

const CHECK_LABEL: Record<string, { label: string; className: string }> = {
  yes: { label: "Yes", className: "bg-(--status-success-bg) text-(--status-success)" },
  no: { label: "No", className: "bg-(--status-danger-bg) text-(--status-danger)" },
  na: { label: "N/A", className: "bg-muted text-muted-foreground" },
};

function Answer({ field, value }: { field: TemplateField; value: FormAnswer | undefined }) {
  if (value === undefined) return <span className="text-muted-foreground">Not answered</span>;
  if (field.type === "check") {
    const check = CHECK_LABEL[value as string];
    return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", check?.className)}>{check?.label ?? String(value)}</span>;
  }
  if (field.type === "signature") {
    const sig = value as SignatureAnswer;
    const when = sig.date ? formatDateTime(`${sig.date}T${sig.time || "00:00"}`) : null;
    return (
      <span>
        {sig.name}
        {when ? <span className="text-muted-foreground"> · {sig.time ? when : sig.date}</span> : null}
      </span>
    );
  }
  if (Array.isArray(value)) return <span>{value.join(", ")}</span>;
  return (
    <span className="whitespace-pre-line">
      {String(value)}
      {field.unit ? ` ${field.unit}` : ""}
    </span>
  );
}

/** Filled-in permit forms and check sheets, read only. Any "No" answer is called out at the top. */
/** `expanded`: show every form open, e.g. for printing. */
export function PermitFormResponses({ responses, expanded = false }: { responses: StoredFormResponse[]; expanded?: boolean }) {
  if (responses.length === 0) return null;
  return (
    <div className="grid gap-3">
      {responses.map((response) => {
        const fields = response.config.sections.flatMap((section) => section.fields);
        const noAnswers = fields.filter((field) => field.type === "check" && response.answers[field.id] === "no");
        const answered = fields.filter((field) => response.answers[field.id] !== undefined).length;
        return (
          <details key={response.templateId} className="group rounded-xl border border-border bg-card" open={expanded || noAnswers.length > 0}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-medium">{response.name}</span>
                {response.config.reference ? <span className="text-sm text-muted-foreground"> · {response.config.reference}</span> : null}
              </span>
              <span className="flex items-center gap-2 text-sm">
                {noAnswers.length ? (
                  <span className="inline-flex items-center gap-1 font-medium text-(--status-danger)">
                    <AlertTriangle className="size-4" aria-hidden />
                    {noAnswers.length} answered No
                  </span>
                ) : null}
                <span className="tabular-nums text-muted-foreground">
                  {answered} of {fields.length} answered
                </span>
              </span>
            </summary>
            <div className="grid gap-4 border-t border-border px-4 py-3">
              {response.config.sections.map((section) => (
                <section key={section.id}>
                  <h4 className="mb-1.5 text-sm font-semibold">{section.title}</h4>
                  <dl className="grid gap-1.5 text-sm">
                    {section.fields.map((field) => (
                      <div key={field.id} className="grid gap-x-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
                        <dt className="text-muted-foreground">{field.label}</dt>
                        <dd>
                          <Answer field={field} value={response.answers[field.id]} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
