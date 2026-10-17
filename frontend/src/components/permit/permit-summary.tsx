"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Paperclip, TriangleAlert, type LucideIcon } from "lucide-react";
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

type Catalogues = {
  hazards: Map<string, HazardRecord>;
  ppe: Map<string, string>;
  lototo: Map<string, string>;
  gas: Map<string, GasTestingRecord>;
};

const named = <T extends { id: string }>(rows: T[], label: (row: T) => string) =>
  new Map(rows.map((row) => [row.id, label(row)]));

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
  ppe: { icon: DOMAIN_ICONS.ppe, color: "var(--status-warning)" },
  lototo: { icon: DOMAIN_ICONS.lototo, color: "var(--st-execution_completed)" },
  gas: { icon: DOMAIN_ICONS.gas, color: "var(--status-info)" },
  people: { icon: DOMAIN_ICONS.people, color: "var(--st-draft)" },
  attachments: { icon: DOMAIN_ICONS.attachment, color: "var(--muted-foreground)" },
} as const;

function Section({
  kind,
  title,
  color,
  icon,
  children,
}: {
  kind: keyof typeof SECTION;
  title: string;
  color?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const { icon: baseIcon, color: base } = SECTION[kind];
  const Icon = icon ?? baseIcon;
  const tone = color ?? base;
  return (
    <section
      style={{ "--chip": tone } as React.CSSProperties}
      className="grid gap-2 border-t border-border py-4 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr] sm:gap-6 print:break-inside-avoid"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden className="chip flex size-7 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
        {title}
      </h3>
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
}: {
  form: PermitFormState;
  status?: string;
  reference?: string | null;
  identity?: PermitIdentity;
  attachments?: PermitAttachment[];
  placeText?: string;
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
        ppe: named(ppe, (row) => row.name),
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
  const ppe = form.ppe
    .filter((p) => p.ppeCatalogueId)
    .map((p) => `${pick(catalogues?.ppe, p.ppeCatalogueId)}${p.quantity > 1 ? ` × ${p.quantity}` : ""}`);
  const gasRows = form.gasTesting.filter((g) => g.gasTestingCatalogueId || g.parameter?.trim());
  const executors = form.executors.filter((e) => e.workforceUserId);
  const operator = executors.find((e) => e.isPrimary) ?? executors[0];
  const officers = form.safetyOfficers.filter((e) => e.workforceUserId).map((e) => person(e.workforceUserId));
  const viewers = form.viewers.filter((e) => e.workforceUserId).map((e) => person(e.workforceUserId));
  const gaps = permitGaps(form);
  const type = form.permitTypeId ? lookups?.permitTypes.get(form.permitTypeId) : undefined;

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

      <Section kind="work" title="Permit">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Number">{identity?.number || reference || "Not issued until submitted"}</Field>
          <Field label="Version">
            {`v${identity?.version ?? 1}`}
            {identity?.versionAt ? ` · ${formatDateTime(identity.versionAt)}` : ""}
          </Field>
          <Field label="Submitted">{identity?.submittedAt ? formatDateTime(identity.submittedAt) : "Not submitted"}</Field>
          <Field label="Approved">{identity?.approvedAt ? formatDateTime(identity.approvedAt) : "Not approved"}</Field>
        </div>
      </Section>

      <Section kind="work" title="Work" color={type?.color ?? undefined}>
        <Field label="Permit type">{type ? <PermitTypeChip name={type.name} color={type.color} /> : lookups ? "Not set" : loading}</Field>
        {form.workScope ? <p className="whitespace-pre-wrap leading-6">{form.workScope}</p> : null}
        {form.emergencyPhone.trim() ? <Field label="Emergency phone">{form.emergencyPhone.trim()}</Field> : null}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Planned start">{form.plannedStartAt ? formatDateTime(form.plannedStartAt) : "Not set"}</Field>
          <Field label="Planned end (expiry)">{form.plannedEndAt ? formatDateTime(form.plannedEndAt) : "Not set"}</Field>
        </div>
        <p className="text-muted-foreground">{formatWindow(form.plannedStartAt, form.plannedEndAt)}</p>
      </Section>

      <Section kind="hazards" title="Hazards">
        {hazardRows.length === 0 ? (
          <span className="font-semibold text-(--status-danger)">None recorded</span>
        ) : (
          <div className="grid gap-4">
            {hazardRows.map((item) => {
              const catalogue = catalogues?.hazards.get(item.hazardCategoryId);
              return (
                <div key={item.hazardCategoryId} className="grid gap-2">
                  <p className="font-medium">
                    {catalogue?.name ?? "Hazard"}
                    {catalogue?.code ? ` (${catalogue.code})` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {catalogue?.category || "—"} · <span className="capitalize">{catalogue?.severity ?? "medium"}</span>
                  </p>
                  {catalogue?.description ? <p className="whitespace-pre-wrap text-sm">{catalogue.description}</p> : null}
                  <Field label="Risks">
                    {(catalogue?.risks ?? []).length ? (
                      <ul className="list-disc pl-5 font-normal">
                        {(catalogue?.risks ?? []).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="font-normal text-muted-foreground">None listed</span>
                    )}
                  </Field>
                  {(item.extraRisks ?? []).filter((line) => line.trim()).length ? (
                    <Field label="Extra risks (this permit)">
                      <ul className="list-disc pl-5 font-normal">
                        {(item.extraRisks ?? []).filter((line) => line.trim()).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </Field>
                  ) : null}
                  <Field label="Potential consequences">
                    {catalogueLinesForPermit(catalogue?.consequences, item.omittedConsequences).length ? (
                      <ul className="list-disc pl-5 font-normal">
                        {catalogueLinesForPermit(catalogue?.consequences, item.omittedConsequences).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="font-normal text-muted-foreground">None listed</span>
                    )}
                  </Field>
                  {(item.extraConsequences ?? []).filter((line) => line.trim()).length ? (
                    <Field label="Extra consequences (this permit)">
                      <ul className="list-disc pl-5 font-normal">
                        {(item.extraConsequences ?? []).filter((line) => line.trim()).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </Field>
                  ) : null}
                  <Field label="Controls">
                    {catalogueLinesForPermit(catalogue?.controls, item.omittedControls).length ? (
                      <ul className="list-disc pl-5 font-normal">
                        {catalogueLinesForPermit(catalogue?.controls, item.omittedControls).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="font-normal text-muted-foreground">None listed</span>
                    )}
                  </Field>
                  {(item.extraControls ?? []).filter((line) => line.trim()).length ? (
                    <Field label="Extra controls (this permit)">
                      <ul className="list-disc pl-5 font-normal">
                        {(item.extraControls ?? []).filter((line) => line.trim()).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </Field>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <Section kind="ppe" title="PPE">
        <Chips items={ppe} empty="None recorded" missing />
      </Section>
      <Section kind="lototo" title="LOTOTO">
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
                    <div key={item.procedureId} className="grid gap-2">
                      <p className="font-medium">{pick(catalogues?.lototo, item.procedureId)}</p>
                      {version?.note ? <Field label="Note">{version.note}</Field> : null}
                      {version?.description ? <Field label="Description">{version.description}</Field> : null}
                      <Field label="Isolation points">
                        {version?.lockoutPoints?.length ? (
                          <ul className="space-y-2">
                            {version.lockoutPoints.map((point) => (
                              <li key={point.id ?? point.pointCode}>
                                <p>
                                  {point.pointCode} · {point.energyType}
                                  {point.action ? ` — ${point.action}` : ""}
                                </p>
                                {point.locationText ? (
                                  <p className="font-normal text-muted-foreground">{point.locationText}</p>
                                ) : null}
                                {point.photo?.url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={point.photo.url} alt="" className="mt-1 max-h-32 w-fit rounded-md border border-border object-contain" />
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="font-normal text-muted-foreground">None listed</span>
                        )}
                      </Field>
                      <Field label="Apply sequence">
                        {(version?.sequenceSteps.filter((s) => s.phase === "apply") ?? []).length ? (
                          version!.sequenceSteps
                            .filter((s) => s.phase === "apply")
                            .map((step) => (
                              <p key={`${step.phase}-${step.sequenceOrder}`}>
                                {step.sequenceOrder}. {step.title}
                              </p>
                            ))
                        ) : (
                          <span className="font-normal text-muted-foreground">None</span>
                        )}
                      </Field>
                      <Field label="Remove sequence">
                        {(version?.sequenceSteps.filter((s) => s.phase === "remove") ?? []).length ? (
                          version!.sequenceSteps
                            .filter((s) => s.phase === "remove")
                            .map((step) => (
                              <p key={`${step.phase}-${step.sequenceOrder}`}>
                                {step.sequenceOrder}. {step.title}
                              </p>
                            ))
                        ) : (
                          <span className="font-normal text-muted-foreground">None</span>
                        )}
                      </Field>
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
                    </div>
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
      <Section kind="gas" title="Gas testing">
        {form.gasTestingRequired ? (
          gasRows.length === 0 ? (
            <span className="font-semibold text-(--status-danger)">Required, no tests selected</span>
          ) : (
            <div className="grid gap-3">
              {gasRows.map((item) => {
                const row = item.gasTestingCatalogueId ? catalogues?.gas.get(item.gasTestingCatalogueId) : undefined;
                const minimum = item.minimum ?? row?.minimum;
                const maximum = item.maximum ?? row?.maximum;
                return (
                  <div key={item.gasTestingCatalogueId} className="grid gap-1">
                    <p className="font-medium">{item.parameter || row?.parameter || (catalogues ? "Unknown parameter" : loading)}{item.removedReason ? " (removed for this permit)" : ""}</p>
                    {item.removedReason ? <p className="text-muted-foreground">{item.removedReason}</p> : (
                      <>
                        <Field label="Acceptable range">
                          {minimum != null && maximum != null ? `${minimum}–${maximum}` : catalogues ? "—" : loading}
                        </Field>
                        <Field label="Unit">{item.unit || row?.unit || (catalogues ? "—" : loading)}</Field>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <span className="font-normal text-muted-foreground">Not required for this work</span>
        )}
      </Section>

      <Section kind="people" title="People">
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
    </div>
  );
}
