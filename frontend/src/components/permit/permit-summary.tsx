"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Paperclip, TriangleAlert } from "lucide-react";
import type { PermitAttachment, PermitFormState } from "@/lib/permit/types";
import { gasTestingApi, masterDataApi } from "@/lib/master-data/api";
import { listLototoPlans } from "@/lib/lototo/api";
import { formatWindow } from "@/lib/format";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";
import { PermitStatusBadge } from "./permit-status-badge";

type Catalogues = {
  hazards: Map<string, string>;
  ppe: Map<string, string>;
  lototo: Map<string, string>;
  gas: Map<string, string>;
};

const named = <T extends { id: string }>(rows: T[], label: (row: T) => string) =>
  new Map(rows.map((row) => [row.id, label(row)]));

/** Plain-language list of what the permit is still missing. */
export function permitGaps(form: PermitFormState): string[] {
  const gaps: string[] = [];
  if (!form.locationId && !form.workstationId && !form.machineryId) gaps.push("Where the work happens");
  if (!form.plannedStartAt || !form.plannedEndAt) gaps.push("Planned start and end");
  if (!form.hazards.some((h) => h.hazardCategoryId)) gaps.push("Hazards");
  if (!form.ppe.some((p) => p.ppeCatalogueId)) gaps.push("PPE");
  if (form.lototoRequired && !form.lototo.some((l) => l.lototoPlanId)) gaps.push("LOTOTO procedure (marked as required)");
  if (form.gasTestingRequired && !form.gasTesting.some((g) => g.gasTestingCatalogueId)) gaps.push("Gas tests (marked as required)");
  if (!form.executors.some((e) => e.workforceUserId)) gaps.push("Executor");
  return gaps;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-border py-4 first:border-t-0 first:pt-0 sm:grid-cols-[9rem_1fr] sm:gap-6">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="min-w-0 space-y-3 text-sm">{children}</div>
    </section>
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

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="font-normal text-muted-foreground">{empty}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-sm font-normal">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function PermitSummary({
  form,
  status = "draft",
  reference,
  attachments = [],
  showHeader = true,
}: {
  form: PermitFormState;
  status?: string;
  reference?: string | null;
  attachments?: PermitAttachment[];
  /** Pages that already show the title, reference and status pass false to avoid repeating them. */
  showHeader?: boolean;
}) {
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [catalogues, setCatalogues] = useState<Catalogues | null>(null);

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
    Promise.all([
      masterDataApi.hazards().catch(() => []),
      masterDataApi.ppe().catch(() => []),
      listLototoPlans().catch(() => []),
      gasTestingApi.list().catch(() => []),
    ]).then(([hazards, ppe, lototo, gas]) =>
      setCatalogues({
        hazards: named(hazards, (row) => row.name),
        ppe: named(ppe, (row) => row.name),
        lototo: named(lototo, (row) => row.title),
        gas: named(gas, (row) => `${row.parameter} (${row.unit})`),
      }),
    );
  }, []);

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

  const hazards = form.hazards
    .filter((h) => h.hazardCategoryId)
    .map((h) => `${pick(catalogues?.hazards, h.hazardCategoryId)}${h.description ? `: ${h.description}` : ""}`);
  const ppe = form.ppe
    .filter((p) => p.ppeCatalogueId)
    .map((p) => `${pick(catalogues?.ppe, p.ppeCatalogueId)}${p.quantity > 1 ? ` × ${p.quantity}` : ""}`);
  const lototo = form.lototo.filter((l) => l.lototoPlanId).map((l) => pick(catalogues?.lototo, l.lototoPlanId));
  const gas = form.gasTesting
    .filter((g) => g.gasTestingCatalogueId)
    .map((g) => pick(catalogues?.gas, g.gasTestingCatalogueId));
  const executors = form.executors.filter((e) => e.workforceUserId);
  const officers = form.safetyOfficers.filter((e) => e.workforceUserId).map((e) => person(e.workforceUserId));
  const viewers = form.viewers.filter((e) => e.workforceUserId).map((e) => person(e.workforceUserId));
  const gaps = permitGaps(form);
  const typeName = nameOf(lookups?.permitTypes, form.permitTypeId);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {showHeader ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{form.title || "Untitled permit"}</h3>
            {reference ? <p className="font-mono text-xs text-muted-foreground">{reference}</p> : null}
          </div>
          <PermitStatusBadge status={status} />
        </div>
      ) : null}

      {gaps.length > 0 ? (
        <div role="note" className="mb-4 flex gap-3 rounded-lg bg-(--status-warning-bg) px-4 py-3 text-sm text-(--status-warning)">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Not provided yet: </span>
            {gaps.join(", ")}.
          </p>
        </div>
      ) : null}

      <Section title="Work">
        <Field label="Permit type">{typeName ?? (lookups ? "Not set" : loading)}</Field>
        {form.workScope ? <p className="whitespace-pre-wrap leading-6">{form.workScope}</p> : null}
      </Section>

      <Section title="Where">
        {path.length > 0 ? (
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

      <Section title="When">
        <p className="font-medium">{formatWindow(form.plannedStartAt, form.plannedEndAt)}</p>
      </Section>

      <Section title="Safety controls">
        <Field label="Hazards">
          <Chips items={hazards} empty="None recorded" />
        </Field>
        <Field label="PPE">
          <Chips items={ppe} empty="None recorded" />
        </Field>
        <Field label="Energy isolation (LOTOTO)">
          {form.lototoRequired ? <Chips items={lototo} empty="Required, no procedure attached" /> : <span className="font-normal text-muted-foreground">Not required</span>}
        </Field>
        <Field label="Gas testing">
          {form.gasTestingRequired ? <Chips items={gas} empty="Required, no tests selected" /> : <span className="font-normal text-muted-foreground">Not required</span>}
        </Field>
      </Section>

      <Section title="People">
        <Field label="Executors">
          {executors.length === 0 ? (
            <span className="font-normal text-muted-foreground">Not assigned</span>
          ) : (
            <ul className="space-y-0.5">
              {executors.map((e) => (
                <li key={e.workforceUserId}>
                  {person(e.workforceUserId)}
                  {e.isPrimary ? <span className="ml-2 text-xs font-normal text-muted-foreground">Primary</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Field>
        {officers.length > 0 ? <Field label="Safety officers">{officers.join(", ")}</Field> : null}
        {viewers.length > 0 ? <Field label="Viewers">{viewers.join(", ")}</Field> : null}
      </Section>

      {attachments.length > 0 ? (
        <Section title="Attachments">
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
    </div>
  );
}
