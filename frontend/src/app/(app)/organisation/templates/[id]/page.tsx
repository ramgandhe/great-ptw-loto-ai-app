"use client";

import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import {
  KIND_LABEL,
  TEMPLATE_FIELD_TYPES,
  TEMPLATE_PREFILL_SOURCES,
  TEMPLATE_REQUIRED_STAGES,
  fieldCount,
  newId,
  permitTemplatesApi,
  type PermitTemplate,
  type TemplateConfig,
  type TemplateField,
  type TemplateFieldType,
  type TemplatePrefillSource,
  type TemplateRequiredStage,
  type TemplateSection,
} from "@/lib/organisation/templates";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { TemplateFormPreview } from "@/components/permit-template/template-form-preview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Draft = Pick<PermitTemplate, "name" | "code" | "description" | "status" | "permitTypeIds" | "appliesToAllTypes"> & { config: TemplateConfig };

const EMPTY_CONFIG: TemplateConfig = { kind: "check-sheet", sections: [] };

function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [types, setTypes] = useState<MasterDataRecord[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([permitTemplatesApi.get(id), masterDataApi.permitTypes()])
      .then(([template, permitTypes]) => {
        const loaded: Draft = {
          name: template.name,
          code: template.code,
          description: template.description,
          status: template.status,
          permitTypeIds: template.permitTypeIds,
          appliesToAllTypes: template.appliesToAllTypes,
          config: template.config ?? EMPTY_CONFIG,
        };
        setDraft(loaded);
        setSaved(JSON.stringify(loaded));
        setTypes(permitTypes.filter((type) => type.isActive !== false));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load the template"));
  }, [id]);

  const dirty = draft !== null && JSON.stringify(draft) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const problems = useMemo(() => {
    if (!draft) return [];
    const list: string[] = [];
    if (!draft.name.trim()) list.push("Give the template a name.");
    draft.config.sections.forEach((section, si) => {
      if (!section.title.trim()) list.push(`Section ${si + 1} needs a title.`);
      section.fields.forEach((field, fi) => {
        if (!field.label.trim()) list.push(`Field ${fi + 1} in “${section.title || `section ${si + 1}`}” needs a label.`);
        if ((field.type === "select" || field.type === "multiselect") && !field.options?.some((o) => o.trim())) {
          list.push(`“${field.label || `Field ${fi + 1}`}” needs at least one option.`);
        }
      });
    });
    return list;
  }, [draft]);

  if (!draft) {
    return <main className="p-4 text-sm text-muted-foreground sm:p-8">{error ?? "Loading template…"}</main>;
  }

  const setConfig = (patch: Partial<TemplateConfig>) => setDraft((d) => d && { ...d, config: { ...d.config, ...patch } });
  const setSections = (update: (sections: TemplateSection[]) => TemplateSection[]) =>
    setDraft((d) => d && { ...d, config: { ...d.config, sections: update(d.config.sections) } });
  const setSection = (si: number, patch: Partial<TemplateSection>) =>
    setSections((sections) => sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setFields = (si: number, update: (fields: TemplateField[]) => TemplateField[]) =>
    setSections((sections) => sections.map((s, i) => (i === si ? { ...s, fields: update(s.fields) } : s)));
  const setField = (si: number, fi: number, patch: Partial<TemplateField>) =>
    setFields(si, (fields) => fields.map((f, i) => (i === fi ? { ...f, ...patch } : f)));
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function addField(si: number) {
    const field: TemplateField = { id: newId("f"), label: "", type: "check" };
    setFields(si, (fields) => [...fields, field]);
    requestAnimationFrame(() => document.getElementById(`label-${field.id}`)?.focus());
  }

  function addSection() {
    const section: TemplateSection = { id: newId("s"), title: "", fields: [] };
    setSections((sections) => [...sections, section]);
    requestAnimationFrame(() => document.getElementById(`title-${section.id}`)?.focus());
  }

  async function save() {
    if (!draft || problems.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      // Drop options from fields that no longer use them, and empty optional text.
      const config: TemplateConfig = {
        ...draft.config,
        reference: draft.config.reference?.trim() || undefined,
        declaration: draft.config.declaration?.trim() || undefined,
        sections: draft.config.sections.map((section) => ({
          ...section,
          title: section.title.trim(),
          fields: section.fields.map(({ options, unit, help, prefill, requiredAt, ...field }) => ({
            ...field,
            // Submission is the default stage, so only a later stage on a required field is stored.
            ...(field.required && requiredAt && requiredAt !== "submit" ? { requiredAt } : {}),
            ...(prefill && field.type !== "check" && field.type !== "signature" ? { prefill } : {}),
            label: field.label.trim(),
            ...(help?.trim() ? { help: help.trim() } : {}),
            ...(unit?.trim() && field.type === "number" ? { unit: unit.trim() } : {}),
            ...((field.type === "select" || field.type === "multiselect") && options?.some((o) => o.trim())
              ? { options: options.map((o) => o.trim()).filter(Boolean) }
              : {}),
          })),
        })),
      };
      const updated = await permitTemplatesApi.update(id, {
        name: draft.name.trim(),
        code: draft.code?.trim() ?? "",
        description: draft.description?.trim() ?? "",
        status: draft.status,
        permitTypeIds: draft.appliesToAllTypes ? [] : draft.permitTypeIds,
        appliesToAllTypes: draft.appliesToAllTypes,
        config,
      });
      const next: Draft = { ...draft, name: updated.name, code: updated.code, description: updated.description, config };
      setDraft(next);
      setSaved(JSON.stringify(next));
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (dirty && !window.confirm("Duplicate the last saved version? Unsaved changes stay here.")) return;
    try {
      const copy = await permitTemplatesApi.duplicate(id);
      router.push(`/organisation/templates/${copy.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not duplicate");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        back={{ href: "/organisation/templates", label: "Permit templates" }}
        title={draft.name || "Untitled template"}
        description={`${KIND_LABEL[draft.config.kind]} · ${draft.config.sections.length} sections, ${fieldCount(draft.config)} fields`}
      />

      <div className="flex gap-2 xl:hidden" role="tablist" aria-label="Editor view">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn("rounded-full px-3 py-1 text-sm", view === v ? "bg-primary text-primary-foreground" : "bg-muted")}
          >
            {v === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className={cn("flex min-w-0 flex-col gap-5", view === "preview" && "hidden xl:flex")}>
          <section className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2" aria-labelledby="details">
            <h2 id="details" className="font-semibold sm:col-span-2">
              Details
            </h2>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Name</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD_CLASS} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">
                Code <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={`${FIELD_CLASS} font-mono`} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Kind</span>
              <select
                value={draft.config.kind}
                onChange={(e) => setConfig({ kind: e.target.value as TemplateConfig["kind"] })}
                className={FIELD_CLASS}
              >
                <option value="permit">Permit form: the main permit people fill in</option>
                <option value="check-sheet">Check sheet: extra checks for a type of work</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">
                Format number <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <input
                value={draft.config.reference ?? ""}
                placeholder="e.g. SOP/ES/023-F4"
                onChange={(e) => setConfig({ reference: e.target.value })}
                className={FIELD_CLASS}
              />
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <textarea
                rows={2}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <fieldset className="grid gap-2 text-sm sm:col-span-2">
              <legend className="mb-1.5 font-medium">Status</legend>
              <div className="flex flex-wrap gap-4">
                {[
                  { value: "draft", label: "Draft", hint: "Being prepared; not offered on permits." },
                  { value: "published", label: "Published", hint: "Offered on permits of the linked types." },
                ].map((option) => (
                  <label key={option.value} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="status"
                      className="mt-1"
                      checked={draft.status === option.value}
                      onChange={() => setDraft({ ...draft, status: option.value })}
                    />
                    <span>
                      {option.label}
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="types">
            <h2 id="types" className="font-semibold">
              Permit types
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">Which permits use this template.</p>
            <fieldset className="mb-3 grid gap-2 text-sm">
              <legend className="sr-only">Applies to</legend>
              {[
                { all: true, label: "All permit types", hint: "Including permit types added later. Suits the main permit form." },
                { all: false, label: "Only the types I pick", hint: "Suits a check sheet for one kind of work." },
              ].map((option) => (
                <label key={option.label} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="applies-to"
                    className="mt-1"
                    checked={draft.appliesToAllTypes === option.all}
                    onChange={() => setDraft({ ...draft, appliesToAllTypes: option.all })}
                  />
                  <span>
                    {option.label}
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {draft.appliesToAllTypes ? null : types.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No permit types yet.{" "}
                <Link href="/organisation/permit-types" className="text-primary hover:underline">
                  Add permit types
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {types.map((type) => {
                  const checked = draft.permitTypeIds.includes(type.id);
                  return (
                    <label
                      key={type.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        checked ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            permitTypeIds: checked ? draft.permitTypeIds.filter((x) => x !== type.id) : [...draft.permitTypeIds, type.id],
                          })
                        }
                      />
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: type.color ?? "transparent" }} aria-hidden />
                      {type.name}
                      {checked ? <span className="sr-only"> (linked)</span> : null}
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {draft.config.sections.map((section, si) => (
            <section key={section.id} className="rounded-xl border border-border bg-card p-5" aria-label={section.title || `Section ${si + 1}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Section {si + 1}</span>
                <input
                  id={`title-${section.id}`}
                  aria-label={`Section ${si + 1} title`}
                  value={section.title}
                  placeholder="Section title"
                  onChange={(e) => setSection(si, { title: e.target.value })}
                  className={`${FIELD_CLASS} min-w-0 flex-1 font-semibold`}
                />
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label="Move section up" disabled={si === 0} onClick={() => setSections((s) => move(s, si, -1))}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move section down"
                    disabled={si === draft.config.sections.length - 1}
                    onClick={() => setSections((s) => move(s, si, 1))}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete section"
                    onClick={() => {
                      if (section.fields.length === 0 || window.confirm(`Delete “${section.title || "this section"}” and its ${section.fields.length} fields?`)) {
                        setSections((s) => s.filter((_, i) => i !== si));
                      }
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>

              <ol className="mt-3 grid gap-2">
                {section.fields.map((field, fi) => {
                  const open = expanded.has(field.id);
                  const hasOptions = field.type === "select" || field.type === "multiselect";
                  return (
                    <li key={field.id} className="rounded-lg border border-border">
                      <div className="flex flex-wrap items-center gap-2 p-2">
                        <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{fi + 1}</span>
                        <input
                          id={`label-${field.id}`}
                          aria-label={`Field ${fi + 1} label`}
                          value={field.label}
                          placeholder="Question or field label"
                          onChange={(e) => setField(si, fi, { label: e.target.value })}
                          className={`${FIELD_CLASS} h-9 min-w-[10rem] flex-1 text-sm`}
                        />
                        <select
                          aria-label={`Field ${fi + 1} type`}
                          value={field.type}
                          onChange={(e) => {
                            const type = e.target.value as TemplateFieldType;
                            setField(si, fi, { type });
                            if ((type === "select" || type === "multiselect") && !field.options?.length) {
                              setExpanded((prev) => new Set(prev).add(field.id));
                            }
                          }}
                          className={`${FIELD_CLASS} h-9 w-full text-sm sm:w-44`}
                        >
                          {TEMPLATE_FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => setField(si, fi, { required: e.target.checked })} />
                          Required
                        </label>
                        {field.required ? (
                          <select
                            aria-label={`When "${field.label || "this field"}" is required`}
                            value={field.requiredAt ?? "submit"}
                            onChange={(e) => setField(si, fi, { requiredAt: e.target.value as TemplateRequiredStage })}
                            className={`${FIELD_CLASS} h-9 text-sm`}
                          >
                            {TEMPLATE_REQUIRED_STAGES.map((stage) => (
                              <option key={stage.value} value={stage.value}>
                                {stage.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="ml-auto flex">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={open ? "Hide field settings" : "More field settings"}
                            aria-expanded={open}
                            onClick={() => toggle(field.id)}
                          >
                            <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Move field up" disabled={fi === 0} onClick={() => setFields(si, (f) => move(f, fi, -1))}>
                            <ArrowUp aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Move field down"
                            disabled={fi === section.fields.length - 1}
                            onClick={() => setFields(si, (f) => move(f, fi, 1))}
                          >
                            <ArrowDown aria-hidden />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Delete field" onClick={() => setFields(si, (f) => f.filter((_, i) => i !== fi))}>
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </div>
                      {open ? (
                        <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
                          <label className="grid gap-1.5 text-sm sm:col-span-2">
                            <span className="font-medium">Help text</span>
                            <input
                              value={field.help ?? ""}
                              placeholder="Shown under the field, e.g. when it applies"
                              onChange={(e) => setField(si, fi, { help: e.target.value })}
                              className={`${FIELD_CLASS} text-sm`}
                            />
                          </label>
                          {field.type !== "check" && field.type !== "signature" ? (
                            <label className="grid gap-1.5 text-sm">
                              <span className="font-medium">Fill from permit</span>
                              <select
                                value={field.prefill ?? ""}
                                onChange={(e) =>
                                  setField(si, fi, { prefill: (e.target.value || undefined) as TemplatePrefillSource | undefined })
                                }
                                className={`${FIELD_CLASS} text-sm`}
                              >
                                <option value="">Nothing: typed on the form</option>
                                {TEMPLATE_PREFILL_SOURCES.map((source) => (
                                  <option key={source.value} value={source.value}>
                                    {source.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                          {field.type === "number" ? (
                            <label className="grid gap-1.5 text-sm">
                              <span className="font-medium">Unit</span>
                              <input
                                value={field.unit ?? ""}
                                placeholder="%, ppm, °C, hrs"
                                onChange={(e) => setField(si, fi, { unit: e.target.value })}
                                className={`${FIELD_CLASS} text-sm`}
                              />
                            </label>
                          ) : null}
                          {hasOptions ? (
                            <label className="grid gap-1.5 text-sm sm:col-span-2">
                              <span className="font-medium">Options, one per line</span>
                              <textarea
                                rows={4}
                                value={(field.options ?? []).join("\n")}
                                onChange={(e) =>
                                  setField(si, fi, { options: e.target.value.split("\n").map((o) => o.trimStart()).filter((o, i, all) => o || i === all.length - 1) })
                                }
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              />
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => addField(si)}>
                <Plus aria-hidden />
                Add field
              </Button>
            </section>
          ))}

          <Button variant="outline" className="self-start" onClick={addSection}>
            <Plus aria-hidden />
            Add section
          </Button>

          <label className="grid gap-1.5 rounded-xl border border-border bg-card p-5 text-sm">
            <span className="font-semibold">
              Declaration <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <span className="text-muted-foreground">Statement the contractor and issuer agree to when they sign.</span>
            <textarea
              rows={3}
              value={draft.config.declaration ?? ""}
              onChange={(e) => setConfig({ declaration: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
        </div>

        <aside className={cn("min-w-0", view === "edit" && "hidden xl:block")} aria-label="Preview">
          <div className="rounded-xl border border-border bg-card p-5 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto">
            <p className="mb-4 text-xs font-medium text-muted-foreground">Preview</p>
            <TemplateFormPreview name={draft.name} config={draft.config} />
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <p className="text-sm" role="status">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : problems.length ? (
            <span className="text-(--status-warning)">{problems[0]}</span>
          ) : dirty ? (
            <span className="text-muted-foreground">Unsaved changes</span>
          ) : (
            <span className="text-muted-foreground">{message ?? "All changes saved"}</span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void duplicate()}>
            <Copy aria-hidden />
            Duplicate
          </Button>
          <Button disabled={!dirty || saving || problems.length > 0} onClick={() => void save()}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>
    </main>
  );
}
