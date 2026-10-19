"use client";
import { AppSelect } from "@/components/ui/select";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ApiError } from "@/lib/api";
import { sitesApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import {
  placeApi,
  type NamedType,
  type WorkLocationRecord,
} from "@/lib/place/api";
import { listTenantUsers } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  AdminPage,
  AdminPageHeader,
  FIELD_CLASS,
} from "@/components/layout/admin-page-header";
import { HazardLinks } from "@/components/organisation/hazard-links";

function personName(user: TenantUser): string {
  return (
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    user.username
  );
}

function LocationBranch({
  rows,
  parentId,
  selectedId,
  onSelect,
}: {
  rows: WorkLocationRecord[];
  parentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const children = rows
    .filter((row) => (row.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (children.length === 0) return null;
  return (
    <ul
      className={parentId ? "ml-4 border-l border-border pl-2" : "grid gap-1"}
    >
      {children.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm ${selectedId === row.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
            onClick={() => onSelect(row.id)}
          >
            <span>{row.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.code}
            </span>
          </button>
          <LocationBranch
            rows={rows}
            parentId={row.id}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

const emptyForm = {
  name: "",
  code: "",
  parentId: "",
  locationTypeId: "",
  description: "",
  hazardIds: [] as string[],
};

export default function WorkLocationsPage() {
  const [sites, setSites] = useState<OrgRecord[]>([]);
  const [siteId, setSiteId] = useState("");
  const [rows, setRows] = useState<WorkLocationRecord[]>([]);
  const [types, setTypes] = useState<NamedType[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [approverNote, setApproverNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const approverUsers = users.filter(
    (user) =>
      user.roles.includes("permit-approver") || user.roles.includes("hod"),
  );

  async function loadLocations(nextSiteId: string) {
    const [locations, locationTypes] = await Promise.all([
      placeApi.listWorkLocations(nextSiteId),
      placeApi.listLocationTypes(),
    ]);
    setRows(locations);
    setTypes(locationTypes.filter((type) => type.status !== "archived"));
  }

  useEffect(() => {
    Promise.all([
      sitesApi.list(),
      listTenantUsers(),
      placeApi.listLocationTypes(),
    ])
      .then(([siteRows, userRows, locationTypes]) => {
        const active = siteRows.filter((site) => site.status !== "archived");
        setSites(active);
        setUsers(userRows.filter((user) => user.enabled));
        setTypes(locationTypes.filter((type) => type.status !== "archived"));
        const first = active[0]?.id ?? "";
        setSiteId(first);
        if (first) return loadLocations(first);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Failed to load work locations",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const typeNameOf = useMemo(
    () => new Map(types.map((type) => [type.id, type.name])),
    [types],
  );

  function openNew() {
    setSelectedId(null);
    setForm(emptyForm);
    setApproverIds([]);
    setApproverNote(null);
    setFormOpen(true);
    setError(null);
  }

  async function openExisting(id: string) {
    setError(null);
    setSelectedId(id);
    setFormOpen(true);
    try {
      const detail = await placeApi.getWorkLocation(id);
      setForm({
        name: detail.name,
        code: detail.code,
        parentId: detail.parentId ?? "",
        locationTypeId: detail.locationTypeId ?? "",
        description: detail.description ?? "",
        hazardIds: detail.hazardIds ?? [],
      });
      setApproverIds(detail.ownApproverIds);
      if (detail.approvers.warning) {
        setApproverNote(
          "No approver is set on this location or above it. Any permit approver for this site may approve.",
        );
      } else if (detail.approvers.inheritedFrom) {
        const source = rows.find(
          (row) => row.id === detail.approvers.inheritedFrom,
        );
        setApproverNote(
          `Approvers come from ${source?.name ?? "a parent location"} until you set them here.`,
        );
      } else {
        setApproverNote("These approvers are set on this location.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load this work location",
      );
    }
  }

  async function changeSite(next: string) {
    setSiteId(next);
    setSelectedId(null);
    setFormOpen(false);
    setError(null);
    try {
      await loadLocations(next);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load work locations",
      );
    }
  }

  async function saveLocation(event: React.FormEvent) {
    event.preventDefault();
    if (!siteId) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      parentId: form.parentId || null,
      locationTypeId: form.locationTypeId || null,
      description: form.description.trim(),
      hazardIds: form.hazardIds,
    };
    try {
      if (selectedId) {
        await placeApi.updateWorkLocation(selectedId, payload);
        toast("Work location saved");
      } else {
        const created = await placeApi.createWorkLocation({
          siteId,
          name: payload.name,
          code: payload.code,
          ...(payload.parentId ? { parentId: payload.parentId } : {}),
          ...(payload.locationTypeId
            ? { locationTypeId: payload.locationTypeId }
            : {}),
          ...(payload.description ? { description: payload.description } : {}),
          hazardIds: payload.hazardIds,
        });
        setSelectedId(created.id);
        toast("Work location added");
      }
      await loadLocations(siteId);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to save this work location",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveApprovers() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await placeApi.putApprovers(selectedId, approverIds);
      toast(
        approverIds.length === 0
          ? "This location now uses the approvers above it"
          : "Approvers saved",
      );
      await openExisting(selectedId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to save approvers",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    if (!selectedId) return;
    const name =
      rows.find((row) => row.id === selectedId)?.name ?? "this work location";
    if (!(await confirmAction(`Archive ${name}? It stays on closed permits.`))) return;
    setSaving(true);
    setError(null);
    try {
      await placeApi.archiveWorkLocation(selectedId);
      toast(`${name} archived`);
      setSelectedId(null);
      setFormOpen(false);
      await loadLocations(siteId);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to archive this work location",
      );
    } finally {
      setSaving(false);
    }
  }

  const parentOptions = rows.filter((row) => row.id !== selectedId);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Work locations"
        description="Any depth under a site. A location filter on permits includes the locations under it."
        action={
          siteId && !formOpen ? (
            <Button type="button" size="lg" onClick={openNew}>
              <Plus aria-hidden />
              Add location
            </Button>
          ) : null
        }
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {!loading && sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a{" "}
          <Link
            href="/organisation/sites"
            className="text-primary hover:underline"
          >
            site
          </Link>{" "}
          first.
        </p>
      ) : null}
      {sites.length > 0 ? (
        <label className="grid max-w-sm gap-1.5 text-sm">
          <span className="font-medium">Site</span>
          <AppSelect
            className={FIELD_CLASS}
            value={siteId}
            onChange={(event) => void changeSite(event.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </AppSelect>
        </label>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {siteId && rows.length === 0 && !formOpen ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No work locations yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the first area people will name on a permit.
          </p>
        </div>
      ) : siteId ? (
        <LocationBranch
          rows={rows}
          parentId={null}
          selectedId={selectedId}
          onSelect={(id) => void openExisting(id)}
        />
      ) : null}
      {formOpen ? (
        <form
          onSubmit={(event) => void saveLocation(event)}
          className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">
            {selectedId ? "Location details" : "New location"}
          </h2>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input
              required
              className={FIELD_CLASS}
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Code</span>
            <input
              required
              className={FIELD_CLASS}
              value={form.code}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, code: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Nest Under</span>
            <AppSelect
              className={FIELD_CLASS}
              value={form.parentId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, parentId: event.target.value }))
              }
            >
              <option value="">Please select a parent..</option>
              {parentOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.pathText || row.name}
                </option>
              ))}
            </AppSelect>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Type</span>
            <AppSelect
              className={FIELD_CLASS}
              value={form.locationTypeId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  locationTypeId: event.target.value,
                }))
              }
            >
              <option value="">No type</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </AppSelect>
          </label>
          <HazardLinks
            hazardIds={form.hazardIds}
            onChange={(hazardIds) => setForm((prev) => ({ ...prev, hazardIds }))}
          />
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              className={`${FIELD_CLASS} h-20 py-2`}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </label>
          {form.locationTypeId ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Type label: {typeNameOf.get(form.locationTypeId)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : selectedId
                  ? "Save location"
                  : "Add location"}
            </Button>
            {selectedId ? (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => void archiveSelected()}
              >
                Archive
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
          </div>
          {selectedId ? (
            <fieldset className="grid gap-3 sm:col-span-2">
              <legend className="font-medium">Approvers</legend>
              {approverNote ? (
                <p className="text-sm text-muted-foreground">{approverNote}</p>
              ) : null}
              {approverUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No permit approvers are set up yet.
                </p>
              ) : (
                <div className="grid gap-2">
                  {approverUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={approverIds.includes(user.id)}
                        onChange={() =>
                          setApproverIds((current) =>
                            current.includes(user.id)
                              ? current.filter((id) => id !== user.id)
                              : [...current, user.id],
                          )
                        }
                      />
                      {personName(user)}
                    </label>
                  ))}
                </div>
              )}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void saveApprovers()}
                >
                  Save approvers
                </Button>
              </div>
            </fieldset>
          ) : null}
        </form>
      ) : null}
      <div className="flex justify-end">
        <Link href="/organisation/work-locations/types" className={buttonVariants({ variant: "outline" })}>
          Add Location Type
        </Link>
      </div>
    </AdminPage>
  );
}
