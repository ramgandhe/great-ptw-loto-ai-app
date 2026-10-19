"use client";

import { useEffect, useState } from "react";
import { ChevronRight, NotebookPen, Paperclip, TriangleAlert, type LucideIcon } from "lucide-react";
import { DOMAIN_ICONS } from "@/lib/domain-icons";
import { PermitTypeChip } from "./permit-type-chip";
import type { PermitAttachment, PermitFormState } from "@/lib/permit/types";
import { catalogueLinesForPermit } from "@/lib/permit/form";
import { gasTestingApi, masterDataApi, type GasTestingRecord, type HazardRecord } from "@/lib/master-data/api";
import { getLototoProcedure, getLototoProcedureVersion, listLototoProcedures } from "@/lib/lototo/api";
import type { LototoProcedureVersion } from "@/lib/lototo/types";
import { formatDateTime, formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { PermitStatusBadge } from "./permit-status-badge";
import { cn } from "@/lib/utils";

type Catalogues = {
  hazards: Map<string, HazardRecord>;
  ppe: Map<string, string>;
  lototo: Map<string, string>;
  gas: Map<string, GasTestingRecord>;
};

const named = <T extends { id: string }>(rows: T[], label: (row: T) => string) =>
  new Map(rows.map((row) => [row.id, label(row)]));

const recordSections = [
  "Permit",
  "Work",
  "Where",
  "When",
  "Hazards",
  "PPE",
  "LOTOTO",
  "Gas testing",
  "People",
  "Attachments",
  "Notes",
] as const;

function recordSectionId(title: string) {
  return `permit-record-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Plain-language list of what the permit is still missing. */
export function permitGaps(form: PermitFormState): string[] {
  const gaps: string[] = [];
  if (!form.workLocationId && !form.locationId && !form.workstationId && !form.machineryId) gaps.push("Where the work happens");
  if (!form.plannedStartAt || !form.plannedEndAt) gaps.push("Planned start and end");
  if (!form.hazards.some((h) => h.hazardCategoryId)) gaps.push("Hazards");
  if (form.lototoRequired && !form.lototo.some((l) => l.procedureId)) gaps.push("LOTOTO procedure (marked as required)");
  if (form.gasTestingRequired && !form.gasTesting.some((g) => !g.removedReason?.trim() && (g.gasTestingCatalogueId || g.parameter?.trim()))) gaps.push("Gas tests (marked as required)");
  if (!form.executors.some((e) => e.workforceUserId)) gaps.push("Executor");
  return gaps;
}

/**
 * Each part of a permit has its own icon and colour, the same on screen and on paper:
 * work in the permit type's colour, hazards red, PPE amber, isolation violet, gas tests blue.
 */
const SECTION = {
  work: { icon: DOMAIN_ICONS.permit, color: "var(--accent-primary)" },
  where: { icon: DOMAIN_ICONS.location, color: "var(--st-approved)" },
  when: { icon: DOMAIN_ICONS.schedule, color: "var(--st-pending_closure)" },
  hazards: { icon: DOMAIN_ICONS.hazard, color: "var(--status-danger)" },
  notes: { icon: NotebookPen, color: "var(--muted-foreground)" },
  ppe: { icon: DOMAIN_ICONS.ppe, color: "var(--status-warning)" },
  lototo: { icon: DOMAIN_ICONS.lototo, color: "var(--st-execution_completed)" },
  gas: { icon: DOMAIN_ICONS.gas, color: "var(--status-info)" },
  people: { icon: DOMAIN_ICONS.people, color: "var(--st-draft)" },
  attachments: { icon: DOMAIN_ICONS.attachment, color: "var(--muted-foreground)" },
} as const;

function Section({
  kind,
  title,
  id,
  color,
  icon,
  wide = false,
  children,
}: {
  kind: keyof typeof SECTION;
  title: string;
  id?: string;
  color?: string;
  icon?: LucideIcon;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { icon: baseIcon, color: base } = SECTION[kind];
  const Icon = icon ?? baseIcon;
  const tone = color ?? base;
  return (
    <div className={`permit-summary-section-container min-w-0 ${wide ? "col-span-full" : ""}`}>
      <section
        id={id ?? recordSectionId(title)}
        aria-labelledby={`${id ?? recordSectionId(title)}-title`}
        style={{ "--chip": tone } as React.CSSProperties}
        className="permit-summary-section grid scroll-mt-20 gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:gap-6 sm:p-5 print:break-inside-avoid"
      >
        <h3 id={`${id ?? recordSectionId(title)}-title`} className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="chip flex size-7 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
          {title}
        </h3>
        <div className="min-w-0 space-y-3 text-sm">{children}</div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}

function Chips({ items, empty, missing = false }: { items: string[]; empty: string; missing?: boolean }) {
  if (items.length === 0)
    return <span className={missing ? "font-semibold text-(--status-danger)" : "font-normal text-muted-foreground"}>{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="chip rounded-full px-2.5 py-0.5 text-sm font-medium">
          {item}
        </li>
      ))}
    </ul>
  );
}

export type PermitIdentity = {
  number?: string | null;
  version?: number;
  versionAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  initiatorId?: string | null;
  submittedSignedName?: string | null;
  approvedBy?: string | null;
  approvedSignedName?: string | null;
  safetyApprovedAt?: string | null;
  approverSiteVisited?: boolean | null;
};

export function identityFromPermit(permit: {
  reference?: string | null;
  permitVersion?: number | null;
  permitVersionAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdBy?: string | null;
  submittedBy?: string | null;
  submittedSignedName?: string | null;
  approvedBy?: string | null;
  approvedSignedName?: string | null;
  safetyApprovedAt?: string | null;
  approverSiteVisited?: boolean | null;
}): PermitIdentity {
  return {
    number: permit.reference ?? null,
    version: permit.permitVersion ?? 1,
    versionAt: permit.permitVersionAt ?? null,
    submittedAt: permit.submittedAt ?? null,
    approvedAt: permit.approvedAt ?? null,
    initiatorId: permit.submittedBy ?? permit.createdBy ?? null,
    submittedSignedName: permit.submittedSignedName ?? null,
    approvedBy: permit.approvedBy ?? null,
    approvedSignedName: permit.approvedSignedName ?? null,
    safetyApprovedAt: permit.safetyApprovedAt ?? null,
    approverSiteVisited: permit.approverSiteVisited ?? null,
  };
}

export function PermitSummary({
  form,
  status = "draft",
  reference,
  identity,
  attachments = [],
  showHeader = true,
  placeText,
  showSectionNavigation = false,
  singleColumn = false,
  additionalSections = [],
}: {
  form: PermitFormState;
  status?: string;
  reference?: string | null;
  identity?: PermitIdentity;
  attachments?: PermitAttachment[];
  placeText?: string;
  showSectionNavigation?: boolean;
  singleColumn?: boolean;
  additionalSections?: { id: string; label: string }[];
  /** Pages that already show the title, reference and status pass false to avoid repeating them. */
  showHeader?: boolean;
}) {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [catalogues, setCatalogues] = useState<Catalogues | null>(null);
  const [lototoVersions, setLototoVersions] = useState<Record<string, LototoProcedureVersion>>({});

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
    Promise.all([
      masterDataApi.hazards().catch(() => []),
      masterDataApi.ppe().catch(() => []),
      listLototoProcedures({ published: true }).catch(() => []),
      gasTestingApi.list().catch(() => []),
    ]).then(([hazards, ppe, lototo, gas]) =>
      setCatalogues({
        hazards: new Map(hazards.map((row) => [row.id, row])),
        ppe: named(ppe, (row) => (row.code ? `${row.name} (${row.code})` : row.name)),
        lototo: named(lototo, (row) => `${row.code} ${row.title}`),
        gas: new Map(gas.map((row) => [row.id, row])),
      }),
    );
  }, []);

  useEffect(() => {
    const ids = form.lototo.filter((item) => item.procedureId);
    if (ids.length === 0) {
      return;
    }
    Promise.all(
      ids.map(async (item) => {
        if (item.procedureVersionId) {
          const version = await getLototoProcedureVersion(item.procedureVersionId);
          return [item.procedureId, version] as const;
        }
        const procedure = await getLototoProcedure(item.procedureId);
        const version = procedure.publishedVersion ?? procedure.draftVersion;
        return version ? ([item.procedureId, version] as const) : null;
      }),
    )
      .then((rows) => {
        const next: Record<string, LototoProcedureVersion> = {};
        for (const row of rows) {
          if (row) {
            next[row[0]] = row[1];
          }
        }
        setLototoVersions(next);
      })
      .catch(() => undefined);
  }, [form.lototo]);

  const loading = "Loading…";
  const pick = (map: Map<string, string> | undefined, id: string) => map?.get(id) ?? (catalogues ? "Unknown item" : loading);
  const person = (id: string) => lookups?.people.get(id)?.name ?? (lookups ? "Unknown person" : loading);

  const path = [
    nameOf(lookups?.plants, form.plantId),
    nameOf(lookups?.departments, form.departmentId),
    nameOf(lookups?.locations, form.locationId),
    nameOf(lookups?.workstations, form.workstationId),
    nameOf(lookups?.machinery, form.machineryId),
  ]
    .filter((part): part is string => Boolean(part))
    // A workstation often shares its location's name; don't print it twice.
    .filter((part, index, parts) => part !== parts[index - 1]);

  const hazardRows = form.hazards.filter((h) => h.hazardCategoryId);
  const selectedPpe = form.ppe.filter((p) => p.ppeCatalogueId);
  const ppe = catalogues
    ? selectedPpe.map((p) => {
        const name = catalogues.ppe.get(p.ppeCatalogueId) ?? "Unknown item";
        return `${name}${p.quantity > 1 ? ` × ${p.quantity}` : ""}`;
      })
    : [];
  const gasRows = form.gasTesting.filter((g) => g.gasTestingCatalogueId || g.parameter?.trim());
  const activeGasRows = gasRows.filter((g) => !g.removedReason?.trim());
  const excludedGasRows = gasRows.filter((g) => g.removedReason?.trim());
  const executors = form.executors.filter((e) => e.workforceUserId);
  const operator = executors.find((e) => e.isPrimary) ?? executors[0];
  const officers = form.safetyOfficers.filter((e) => e.workforceUserId).map((e) => person(e.workforceUserId));
  const viewers = form.viewers.filter((e) => e.workforceUserId).map((e) => person(e.workforceUserId));
  const gaps = permitGaps(form);
  const type = form.permitTypeId ? lookups?.permitTypes.get(form.permitTypeId) : undefined;

  return (
    <div className={cn("grid min-w-0 gap-3 print:grid-cols-1", singleColumn ? "grid-cols-1" : "lg:grid-cols-2")}>
      {showSectionNavigation ? (
        <nav aria-label="Permit record sections" className="sticky top-16 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur lg:col-span-2 print:hidden">
          {[
            ...recordSections
              .filter((title) => title !== "Attachments" || attachments.length > 0)
              .map((title) => ({ id: recordSectionId(title), label: title })),
            ...additionalSections,
          ].map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex min-h-9 shrink-0 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {label}
              </a>
          ))}
        </nav>
      ) : null}
      {showHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div>
            <h3 className="text-lg font-semibold">{form.title || "Untitled permit"}</h3>
            {reference ? <p className="font-mono text-xs text-muted-foreground">{reference}</p> : null}
          </div>
          <PermitStatusBadge status={status} />
        </div>
      ) : null}

      {gaps.length > 0 ? (
        <div role="note" className="flex gap-3 rounded-lg bg-(--status-warning-bg) px-4 py-3 text-sm text-(--status-warning)">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Not provided yet: </span>
            {gaps.join(", ")}.
          </p>
        </div>
      ) : null}

      <Section kind="work" title="Permit">
        <div className="permit-summary-facts grid gap-3">
          <Field label="Number">{identity?.number || reference || "Not issued until submitted"}</Field>
          <Field label="Version">
            {`v${identity?.version ?? 1}`}
            {identity?.versionAt ? ` · ${formatDateTime(identity.versionAt)}` : ""}
          </Field>
          <Field label="Submitted">{identity?.submittedAt ? formatDateTime(identity.submittedAt) : "Not submitted"}</Field>
          <Field label="Approved">{identity?.approvedAt ? formatDateTime(identity.approvedAt) : "Not approved"}</Field>
        </div>
      </Section>

      <Section kind="work" title="Work" color={type?.color ?? undefined} wide>
        <Field label="Permit type">{type ? <PermitTypeChip name={type.name} color={type.color} /> : lookups ? "Not set" : loading}</Field>
        <Field label="Permit scope">
          {form.workScope.trim()
            ? <p className="whitespace-pre-wrap leading-6">{form.workScope.trim()}</p>
            : <span className="font-normal text-muted-foreground">Not provided</span>}
        </Field>
        <Field label="Emergency contact number">
          {form.emergencyPhone.trim() || <span className="font-normal text-muted-foreground">Not provided</span>}
        </Field>
      </Section>

      <Section kind="where" title="Where" icon={form.assetIds.length || form.machineryId ? DOMAIN_ICONS.machinery : undefined}>
        {placeText ? (
          <p className="font-medium">{placeText}</p>
        ) : path.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1 font-medium">
            {path.map((part, index) => (
              <span key={`${part}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden /> : null}
                {part}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-muted-foreground">{lookups ? "Not set" : loading}</p>
        )}
      </Section>

      <Section kind="when" title="When">
        <div className="permit-summary-facts grid gap-3">
          <Field label="Planned start">{form.plannedStartAt ? formatDateTime(form.plannedStartAt) : "Not set"}</Field>
          <Field label="Planned end (expiry)">{form.plannedEndAt ? formatDateTime(form.plannedEndAt) : "Not set"}</Field>
        </div>
        <p className="text-muted-foreground">{formatWindow(form.plannedStartAt, form.plannedEndAt)}</p>
      </Section>

      <Section kind="hazards" title="Hazards" wide>
        {hazardRows.length === 0 ? (
          <span className="font-semibold text-(--status-danger)">None recorded</span>
        ) : (
          <div className="grid gap-4">
            {hazardRows.map((item, index) => {
              const catalogue = catalogues?.hazards.get(item.hazardCategoryId);
              const controls = [
                ...catalogueLinesForPermit(catalogue?.controls, item.omittedControls),
                ...(item.extraControls ?? []).filter((line) => line.trim()),
              ];
              const risks = [
                ...(catalogue?.risks ?? []),
                ...(item.extraRisks ?? []).filter((line) => line.trim()),
              ];
              const consequences = [
                ...catalogueLinesForPermit(catalogue?.consequences, item.omittedConsequences),
                ...(item.extraConsequences ?? []).filter((line) => line.trim()),
              ];
              const omittedControls = (catalogue?.controls ?? []).filter((line) => item.omittedControls?.includes(line));
              const omittedConsequences = (catalogue?.consequences ?? []).filter((line) => item.omittedConsequences?.includes(line));
              return (
                <article key={item.hazardCategoryId} className="overflow-hidden rounded-xl border border-border bg-background">
                  <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <span className="font-mono text-sm font-bold">{String(index + 1).padStart(2, "0")}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold">
                        {catalogue?.name ?? "Hazard"}
                        {catalogue?.code ? <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{catalogue.code}</span> : null}
                      </h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">{catalogue?.category || "Uncategorised"}</p>
                    </div>
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                      !catalogues
                        ? "bg-muted text-muted-foreground"
                        : catalogue?.severity?.toLowerCase().includes("high")
                          ? "bg-(--status-danger-bg) text-(--status-danger)"
                          : catalogue?.severity?.toLowerCase().includes("low")
                            ? "bg-(--status-info-bg) text-(--status-info)"
                            : "bg-(--status-warning-bg) text-(--status-warning)",
                    )}>
                      {catalogues ? `${catalogue?.severity ?? "Unclassified"} severity` : "Loading"}
                    </span>
                  </header>
                  {catalogue?.description ? <p className="border-b border-border px-4 py-3 text-sm leading-6 text-muted-foreground">{catalogue.description}</p> : null}
                  {!catalogues ? (
                    <p className="p-4 text-sm text-muted-foreground">Loading hazard assessment…</p>
                  ) : (
                    <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
                      {[
                        { title: "Risks", items: risks, tone: "text-(--status-warning)" },
                        { title: "Potential consequences", items: consequences, tone: "text-(--status-danger)" },
                        { title: "Required controls", items: controls, tone: "text-(--status-success)" },
                      ].map(({ title, items, tone }) => (
                        <section key={title} className="p-4">
                          <h5 className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {title}
                            <span className="font-mono text-[10px]">{items.length}</span>
                          </h5>
                          {items.length ? (
                            <ul className="grid gap-2 text-sm leading-5">
                              {items.map((line) => (
                                <li key={line} className="flex items-start gap-2">
                                  <span className={cn("mt-0.5 shrink-0 font-semibold", tone)} aria-hidden>{title === "Required controls" ? "✓" : "•"}</span>
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">None listed</p>
                          )}
                        </section>
                      ))}
                    </div>
                  )}
                  {omittedControls.length || omittedConsequences.length ? (
                    <details className="permit-hazard-details group border-t border-border bg-(--status-warning-bg)/40 px-4">
                      <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-xs font-medium marker:content-none">
                        <span>Items excluded for this permit <span className="text-muted-foreground">· {omittedControls.length + omittedConsequences.length}</span></span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                      </summary>
                      <div className="grid gap-3 border-t border-border py-3 text-sm sm:grid-cols-2">
                        {omittedConsequences.length ? <Field label="Excluded consequences">{omittedConsequences.join("; ")}</Field> : null}
                        {omittedControls.length ? <Field label="Excluded controls">{omittedControls.join("; ")}</Field> : null}
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Section>
      <Section kind="ppe" title="PPE" wide>
        {catalogues ? (
          <Chips items={ppe} empty="None recorded" missing={selectedPpe.length === 0} />
        ) : (
          <span className="text-sm text-muted-foreground">Loading…</span>
        )}
      </Section>
      <Section kind="lototo" title="LOTOTO" wide>
        {form.lototoRequired ? (
          form.lototo.filter((item) => item.procedureId).length === 0 ? (
            <span className="font-semibold text-(--status-danger)">Required, no procedure attached</span>
          ) : (
            <div className="grid gap-4">
              {form.lototo
                .filter((item) => item.procedureId)
                .map((item) => {
                  const version = lototoVersions[item.procedureId];
                  return (
                      <article key={item.procedureId} className="grid gap-4 rounded-xl border border-border border-l-4 border-l-(--st-execution_completed) bg-background p-4 sm:p-5">
                        <header className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{pick(catalogues?.lototo, item.procedureId)}</p>
                            {version?.description ? <p className="mt-1 text-sm text-muted-foreground">{version.description}</p> : null}
                          </div>
                          <span className="rounded-full bg-(--st-execution_completed)/10 px-2.5 py-1 text-xs font-semibold text-(--st-execution_completed)">Isolation procedure</span>
                        </header>
                        {version?.note ? <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{version.note}</p> : null}
                        <Field label={`Isolation points · ${version?.lockoutPoints?.length ?? 0}`}>
                          {version?.lockoutPoints?.length ? (
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {version.lockoutPoints.map((point, index) => (
                                <li key={point.id ?? point.pointCode} className="rounded-lg border border-border bg-card p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-(--st-execution_completed)/10 font-mono text-xs font-semibold text-(--st-execution_completed)">{String(index + 1).padStart(2, "0")}</span>
                                    <span className="font-semibold">{point.pointCode}</span>
                                    <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{point.energyType}</span>
                                  </div>
                                  {point.action ? <p className="mt-2 text-sm">{point.action}</p> : null}
                                  {point.locationText ? <p className="mt-1 text-xs text-muted-foreground">{point.locationText}</p> : null}
                                  {point.photo?.url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={point.photo.url} alt="" className="mt-2 max-h-32 w-fit rounded-md border border-border object-contain" />
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="font-normal text-muted-foreground">None listed</span>
                          )}
                        </Field>
                        <div className="grid gap-3 lg:grid-cols-2">
                        <Field label="Apply isolation">
                          {(version?.sequenceSteps.filter((s) => s.phase === "apply") ?? []).length ? (
                            <ol className="mt-2 grid gap-2 rounded-lg border border-border bg-card p-3">
                              {version!.sequenceSteps.filter((s) => s.phase === "apply").map((step) => (
                                <li key={`${step.phase}-${step.sequenceOrder}`} className="flex items-start gap-2 border-b border-border/70 pb-2 last:border-0 last:pb-0">
                                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-(--st-execution_completed)/10 font-mono text-[10px] font-semibold text-(--st-execution_completed)">{String(step.sequenceOrder).padStart(2, "0")}</span>
                                  <span className="pt-0.5">{step.title}</span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <span className="font-normal text-muted-foreground">None</span>
                          )}
                        </Field>
                        <Field label="Restore sequence">
                          {(version?.sequenceSteps.filter((s) => s.phase === "remove") ?? []).length ? (
                            <ol className="mt-2 grid gap-2 rounded-lg border border-border bg-card p-3">
                              {version!.sequenceSteps.filter((s) => s.phase === "remove").map((step) => (
                                <li key={`${step.phase}-${step.sequenceOrder}`} className="flex items-start gap-2 border-b border-border/70 pb-2 last:border-0 last:pb-0">
                                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[10px] font-semibold">{String(step.sequenceOrder).padStart(2, "0")}</span>
                                  <span className="pt-0.5">{step.title}</span>
                                </li>
                              ))}
                            </ol>
                        ) : (
                          <span className="font-normal text-muted-foreground">None</span>
                        )}
                      </Field>
                        </div>
                        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(item.extraPoints ?? []).some((p) => p.pointCode) ? (
                        <Field label="Extra points">
                          {(item.extraPoints ?? [])
                            .filter((p) => p.pointCode)
                            .map((p) => `${p.pointCode} (${p.energyType})`)
                            .join(", ")}
                        </Field>
                      ) : null}
                      {(item.stepNa ?? []).some((row) => row.reason) ? (
                        <Field label="N/A">
                          {(item.stepNa ?? [])
                            .filter((row) => row.reason)
                            .map((row) => row.reason)
                            .join("; ")}
                        </Field>
                      ) : null}
                      <Field label="LOTOTO crew">
                        {item.crew.filter((row) => row.workforceUserId).length
                          ? item.crew
                              .filter((row) => row.workforceUserId)
                              .map((row) => person(row.workforceUserId))
                              .join(", ")
                          : "Not assigned"}
                      </Field>
                      <Field label="Verifiers">
                        {item.verifiers.filter((row) => row.workforceUserId).length
                          ? item.verifiers
                              .filter((row) => row.workforceUserId)
                              .map((row) => person(row.workforceUserId))
                              .join(", ")
                          : "Not assigned"}
                      </Field>
                        </div>
                      {(item.verification ?? []).filter((row) => row.signedName).length > 0 ? (
                        <Field label="Who reviewed LOTOTO">
                          {(item.verification ?? [])
                            .filter((row) => row.signedName)
                            .map(
                              (row) =>
                                `${row.phase === "remove" ? "Restore" : "Isolation"}: ${row.signedName}${row.verifiedAt ? ` · ${formatDateTime(row.verifiedAt)}` : ""}${row.result ? ` (${row.result})` : ""}`,
                            )
                            .join("; ")}
                        </Field>
                      ) : null}
                    </article>
                  );
                })}
            </div>
          )
        ) : (
          <span className="font-normal text-muted-foreground">Not required for this work</span>
        )}
        {form.lototo.some((item) => item.frozenAt) ? (
          <p className="text-xs text-muted-foreground">Procedure content is frozen at approval. Assigned people can still be changed until work starts.</p>
        ) : null}
      </Section>
      <Section kind="gas" title="Gas testing" wide>
        {form.gasTestingRequired ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-(--status-info)/30 bg-(--status-info-bg) px-3 py-2">
              <span className="text-sm font-semibold text-(--status-info)">Gas testing required</span>
              <span className="font-mono text-xs text-(--status-info)">{activeGasRows.length} active test{activeGasRows.length === 1 ? "" : "s"}</span>
            </div>
            {activeGasRows.length === 0 ? (
              <p className="rounded-lg border border-(--status-danger)/30 bg-(--status-danger-bg) px-3 py-2 text-sm font-medium text-(--status-danger)">
                No active test parameters recorded.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
              {activeGasRows.map((item) => {
                const row = item.gasTestingCatalogueId ? catalogues?.gas.get(item.gasTestingCatalogueId) : undefined;
                const minimum = item.minimum ?? row?.minimum;
                const maximum = item.maximum ?? row?.maximum;
                const unit = item.unit || row?.unit || (catalogues ? "Not set" : loading);
                return (
                  <article key={`${item.gasTestingCatalogueId ?? item.parameter}-${item.sourceName ?? ""}`} className="overflow-hidden rounded-xl border border-border bg-background">
                    <div className="border-l-4 border-l-(--status-info) px-4 py-3">
                      <p className="font-semibold">{item.parameter || row?.parameter || (catalogues ? "Unknown parameter" : loading)}</p>
                      {item.sourceName ? <p className="mt-0.5 text-xs text-muted-foreground">{item.sourceName}</p> : null}
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-end gap-3 border-t border-border bg-muted/40 px-4 py-3">
                      <Field label="Acceptable range">
                        <span className="font-mono text-lg font-semibold">
                          {minimum != null && maximum != null ? `${minimum}–${maximum}` : catalogues ? "Not set" : loading}
                        </span>
                      </Field>
                      <Field label="Unit">{unit}</Field>
                    </div>
                  </article>
                );
              })}
              </div>
            )}
            {excludedGasRows.length ? (
              <details className="permit-hazard-details group rounded-lg border border-border bg-muted/30 px-3">
                <summary className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm font-medium marker:content-none">
                  <span>Excluded test parameters <span className="font-mono text-xs text-muted-foreground">· {excludedGasRows.length}</span></span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <ul className="grid gap-2 border-t border-border py-3 sm:grid-cols-2">
                  {excludedGasRows.map((item) => {
                    const row = item.gasTestingCatalogueId ? catalogues?.gas.get(item.gasTestingCatalogueId) : undefined;
                    return (
                      <li key={`${item.gasTestingCatalogueId ?? item.parameter}-${item.sourceName ?? ""}`} className="rounded-md border border-border bg-background p-3">
                        <p className="text-sm font-medium">{item.parameter || row?.parameter || (catalogues ? "Unknown parameter" : loading)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.removedReason}</p>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}
          </div>
        ) : (
          <span className="font-normal text-muted-foreground">Not required for this work</span>
        )}
      </Section>

      <Section kind="people" title="People" wide>
        <Field label="Initiator (receiver)">
          {identity?.initiatorId ? person(identity.initiatorId) : <span className="font-normal text-muted-foreground">Not submitted</span>}
        </Field>
        <Field label="Received">{identity?.submittedAt ? formatDateTime(identity.submittedAt) : "—"}</Field>
        <Field label="Initiator signature">{identity?.submittedSignedName?.trim() || "—"}</Field>
        {officers.length > 0 ? (
          <>
            <Field label="Safety officer">{officers.join(", ")}</Field>
            <Field label="Safety officer signed">
              {identity?.safetyApprovedAt ? formatDateTime(identity.safetyApprovedAt) : "Not signed"}
            </Field>
            <Field label="Safety officer signature">
              {form.safetyApprovalSignedName.trim()
                ? `${form.safetyApprovalSignedName.trim()}${form.safetyApprovalComment.trim() ? ` — ${form.safetyApprovalComment.trim()}` : ""}`
                : "—"}
            </Field>
          </>
        ) : null}
        <Field label="Crew">
          {executors.length === 0 ? (
            <span className="font-normal text-muted-foreground">Not assigned</span>
          ) : (
            <ul className="space-y-0.5">
              {executors.map((e) => (
                <li key={e.workforceUserId}>
                  {person(e.workforceUserId)}
                  {e.isPrimary ? <span className="ml-2 text-xs font-normal text-muted-foreground">Primary</span> : null}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">signature —</span>
                </li>
              ))}
            </ul>
          )}
        </Field>
        <Field label="Approver">
          {identity?.approvedBy ? person(identity.approvedBy) : <span className="font-normal text-muted-foreground">Not approved</span>}
        </Field>
        <Field label="Approved">{identity?.approvedAt ? formatDateTime(identity.approvedAt) : "—"}</Field>
        <Field label="Approver signature">{identity?.approvedSignedName?.trim() || "—"}</Field>
        <Field label="Operator">
          {operator ? (
            <>
              {person(operator.workforceUserId)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">signature —</span>
            </>
          ) : (
            <span className="font-normal text-muted-foreground">Not assigned</span>
          )}
        </Field>
        {viewers.length > 0 ? <Field label="Viewers">{viewers.join(", ")}</Field> : null}
        <Field label="Site visited and verified">
          Receiver: {form.receiverSiteVisited ? "Yes" : "No"}
          {" · "}
          Operator: {form.executorSiteVisited ? "Yes" : "No"}
          {officers.length > 0 ? ` · Safety officer: ${form.safetyOfficerSiteVisited ? "Yes" : "No"}` : ""}
          {identity?.approverSiteVisited != null
            ? ` · Approver: ${identity.approverSiteVisited ? "Yes" : "No"}`
            : ""}
        </Field>
      </Section>

      {attachments.length > 0 ? (
        <Section kind="attachments" title="Attachments">
          <ul className="space-y-1">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center gap-2">
                <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
                {attachment.fileName}
                <span className="text-xs text-muted-foreground">{Math.round(attachment.fileSize / 1024)} KB</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <Section kind="notes" title="Notes" wide>
        {form.siteNotes.trim() ? (
          <p className="whitespace-pre-wrap leading-6">{form.siteNotes.trim()}</p>
        ) : (
          <span className="text-muted-foreground">None recorded</span>
        )}
      </Section>
    </div>
  );
}
