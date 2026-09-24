"use client";

import { useEffect, useMemo, useState } from "react";
import type { PermitAttachment, PermitFormState } from "@/lib/permit/types";
import { gasTestingApi, masterDataApi } from "@/lib/master-data/api";
import { departmentsApi, locationsApi, machineryApi, plantsApi, workstationsApi } from "@/lib/organisation/api";
import { listLototoPlans } from "@/lib/lototo/api";
import { listTenantUserNames } from "@/lib/workforce/api";
import { PermitStatusBadge } from "./permit-status-badge";

function labelOf(items: { id: string; name?: string | null; code?: string | null }[], id: string) {
  if (!id) {
    return "—";
  }
  const match = items.find((item) => item.id === id);
  return match?.name || match?.code || id;
}

function personName(people: { id: string; name?: string | null; email?: string | null; username?: string }[], id: string) {
  if (!id) {
    return "—";
  }
  const match = people.find((item) => item.id === id);
  if (!match) {
    return id;
  }
  const name = match.name || match.username || "Unknown";
  return match.email ? `${name} (${match.email})` : name;
}

export function PermitSummary({
  form,
  status = "draft",
  reference,
  attachments = [],
}: {
  form: PermitFormState;
  status?: string;
  reference?: string | null;
  attachments?: PermitAttachment[];
}) {
  const [lookups, setLookups] = useState<{
    permitTypes: { id: string; name?: string | null }[];
    plants: { id: string; name?: string | null }[];
    departments: { id: string; name?: string | null }[];
    locations: { id: string; name?: string | null }[];
    workstations: { id: string; name?: string | null }[];
    machinery: { id: string; name?: string | null }[];
    hazards: { id: string; name?: string | null }[];
    ppe: { id: string; name?: string | null }[];
    lototo: { id: string; name?: string | null }[];
    gas: { id: string; name?: string | null }[];
    people: { id: string; name?: string | null; email?: string | null; username?: string }[];
  } | null>(null);

  useEffect(() => {
    Promise.all([
      masterDataApi.permitTypes(),
      plantsApi.list(),
      departmentsApi.list(),
      locationsApi.list(),
      workstationsApi.list(),
      machineryApi.list(),
      masterDataApi.hazards(),
      masterDataApi.ppe(),
      listLototoPlans().catch(() => []),
      gasTestingApi.list().catch(() => []),
      listTenantUserNames().catch(() => []),
    ]).then(([permitTypes, plants, departments, locations, workstations, machinery, hazards, ppe, lototo, gas, peopleRows]) => {
      const people = peopleRows.map((user) => ({
        id: user.id,
        name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || user.username,
        email: user.email,
        username: user.username,
      }));
      setLookups({
        permitTypes,
        plants,
        departments,
        locations,
        workstations,
        machinery,
        hazards,
        ppe,
        lototo: lototo.map((plan) => ({ id: plan.id, name: plan.title })),
        gas: gas.map((item) => ({ id: item.id, name: `${item.parameter} (${item.unit})` })),
        people,
      });
    }).catch(() => setLookups({
      permitTypes: [],
      plants: [],
      departments: [],
      locations: [],
      workstations: [],
      machinery: [],
      hazards: [],
      ppe: [],
      lototo: [],
      gas: [],
      people: [],
    }));
  }, []);

  const names = useMemo(() => lookups, [lookups]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{form.title || "Untitled permit"}</h3>
        <PermitStatusBadge status={status} />
      </div>
      {reference ? (
        <p className="mb-3 text-sm text-muted-foreground">Reference: {reference}</p>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Permit type</dt>
          <dd className="font-medium">{names ? labelOf(names.permitTypes, form.permitTypeId) : "Loading…"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plant</dt>
          <dd className="font-medium">{names ? labelOf(names.plants, form.plantId) : "Loading…"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Department</dt>
          <dd className="font-medium">{names ? labelOf(names.departments, form.departmentId) : "Loading…"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Location</dt>
          <dd className="font-medium">{names ? labelOf(names.locations, form.locationId) : "Loading…"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Workstation</dt>
          <dd className="font-medium">{names ? labelOf(names.workstations, form.workstationId) : "Loading…"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Machinery</dt>
          <dd className="font-medium">{names ? labelOf(names.machinery, form.machineryId) : "Loading…"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Planned start</dt>
          <dd className="font-medium">{form.plannedStartAt || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Planned end</dt>
          <dd className="font-medium">{form.plannedEndAt || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Work scope</dt>
          <dd className="font-medium whitespace-pre-wrap">{form.workScope || "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Hazards</dt>
          <dd className="font-medium">
            {form.hazards.filter((h) => h.hazardCategoryId.trim()).length === 0
              ? "—"
              : form.hazards
                  .filter((h) => h.hazardCategoryId.trim())
                  .map((h) => `${names ? labelOf(names.hazards, h.hazardCategoryId) : h.hazardCategoryId}${h.description ? ` — ${h.description}` : ""}`)
                  .join("; ")}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">PPE</dt>
          <dd className="font-medium">
            {form.ppe.filter((p) => p.ppeCatalogueId.trim()).length === 0
              ? "—"
              : form.ppe
                  .filter((p) => p.ppeCatalogueId.trim())
                  .map((p) => `${names ? labelOf(names.ppe, p.ppeCatalogueId) : p.ppeCatalogueId} × ${p.quantity}`)
                  .join("; ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">LOTOTO required</dt>
          <dd className="font-medium">{form.lototoRequired ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">LOTOTO procedures</dt>
          <dd className="font-medium">
            {form.lototo.filter((item) => item.lototoPlanId.trim()).length === 0
              ? "—"
              : form.lototo
                  .filter((item) => item.lototoPlanId.trim())
                  .map((item) => (names ? labelOf(names.lototo, item.lototoPlanId) : item.lototoPlanId))
                  .join("; ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gas testing required</dt>
          <dd className="font-medium">{form.gasTestingRequired ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gas testing</dt>
          <dd className="font-medium">
            {form.gasTesting.filter((item) => item.gasTestingCatalogueId.trim()).length === 0
              ? "—"
              : form.gasTesting
                  .filter((item) => item.gasTestingCatalogueId.trim())
                  .map((item) => (names ? labelOf(names.gas, item.gasTestingCatalogueId) : item.gasTestingCatalogueId))
                  .join("; ")}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Executors</dt>
          <dd className="font-medium">
            {form.executors.filter((e) => e.workforceUserId.trim()).length === 0
              ? "—"
              : form.executors
                  .filter((e) => e.workforceUserId.trim())
                  .map((e) => `${names ? personName(names.people, e.workforceUserId) : e.workforceUserId}${e.isPrimary ? " (primary)" : ""}`)
                  .join("; ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Viewers</dt>
          <dd className="font-medium">
            {form.viewers.filter((e) => e.workforceUserId.trim()).length === 0
              ? "—"
              : form.viewers
                  .filter((e) => e.workforceUserId.trim())
                  .map((e) => (names ? personName(names.people, e.workforceUserId) : e.workforceUserId))
                  .join("; ")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Safety officers</dt>
          <dd className="font-medium">
            {form.safetyOfficers.filter((e) => e.workforceUserId.trim()).length === 0
              ? "—"
              : form.safetyOfficers
                  .filter((e) => e.workforceUserId.trim())
                  .map((e) => (names ? personName(names.people, e.workforceUserId) : e.workforceUserId))
                  .join("; ")}
          </dd>
        </div>
      </dl>
      {attachments.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">Attachments</p>
          <ul className="mt-1 grid gap-1 text-sm font-medium">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                {attachment.fileName} ({Math.round(attachment.fileSize / 1024)} KB)
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
