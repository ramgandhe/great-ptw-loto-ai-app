"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import {
  approverPeople,
  personName,
  WorkLocationFields,
  type WorkLocationDraft,
} from "@/components/organisation/work-location-fields";
import { placeApi, type NamedType, type WorkLocationRecord } from "@/lib/place/api";
import { listTenantUsers } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";

export default function EditWorkLocationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [name, setName] = useState("");
  const [form, setForm] = useState<WorkLocationDraft | null>(null);
  const [parents, setParents] = useState<WorkLocationRecord[]>([]);
  const [types, setTypes] = useState<NamedType[]>([]);
  const [people, setPeople] = useState<TenantUser[]>([]);
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [approverNote, setApproverNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    placeApi
      .getWorkLocation(id)
      .then(async (detail) => {
        const [locations, locationTypes, users] = await Promise.all([
          placeApi.listWorkLocations(detail.siteId),
          placeApi.listLocationTypes(),
          listTenantUsers().catch(() => [] as TenantUser[]),
        ]);
        if (cancelled) return;
        setName(detail.name);
        setForm({
          name: detail.name,
          code: detail.code,
          parentId: detail.parentId ?? "",
          locationTypeId: detail.locationTypeId ?? "",
          description: detail.description ?? "",
          hazardIds: detail.hazardIds ?? [],
        });
        setParents(locations.filter((row) => row.id !== detail.id));
        setTypes(locationTypes.filter((type) => type.status !== "archived" || type.id === detail.locationTypeId));
        setPeople(approverPeople(users));
        setApproverIds(detail.ownApproverIds);
        if (detail.approvers.warning) {
          setApproverNote("No approver is set on this location or above it. Any permit approver for this site may approve.");
        } else if (detail.approvers.inheritedFrom) {
          const source = locations.find((row) => row.id === detail.approvers.inheritedFrom);
          setApproverNote(`Approvers come from ${source?.name ?? "a parent location"} until you set them here.`);
        } else {
          setApproverNote("These approvers are set on this location.");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load this work location");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await placeApi.updateWorkLocation(id, {
        name: form.name.trim(),
        code: form.code.trim(),
        parentId: form.parentId || null,
        locationTypeId: form.locationTypeId || null,
        description: form.description.trim(),
        hazardIds: form.hazardIds,
      });
      await placeApi.putApprovers(id, approverIds);
      toast("Work location saved");
      router.push(`/organisation/work-locations/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this work location");
    } finally {
      setSaving(false);
    }
  }

  const back = { href: `/organisation/work-locations/${id}`, label: name || "Work location" };

  return (
    <AdminPage>
      <AdminPageHeader title={name ? `Edit ${name}` : "Edit work location"} description="Name, place in the site, hazards, and approvers." back={back} />
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {form ? (
        <form onSubmit={(event) => void save(event)} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <WorkLocationFields form={form} parents={parents} types={types} onChange={setForm} />
          <fieldset className="grid gap-3 sm:col-span-2">
            <legend className="font-medium">Approvers</legend>
            {approverNote ? <p className="text-sm text-muted-foreground">{approverNote}</p> : null}
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permit approvers are set up yet.</p>
            ) : (
              <div className="grid gap-2">
                {people.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={approverIds.includes(user.id)}
                      onChange={() =>
                        setApproverIds((current) =>
                          current.includes(user.id) ? current.filter((entry) => entry !== user.id) : [...current, user.id],
                        )
                      }
                    />
                    {personName(user)}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Clear every approver to use the ones set on a location above this one.</p>
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save location"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(back.href)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </AdminPage>
  );
}
