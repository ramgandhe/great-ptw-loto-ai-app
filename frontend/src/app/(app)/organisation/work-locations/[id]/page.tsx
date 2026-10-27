"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { hazardsApi, sitesApi } from "@/lib/organisation/api";
import { personName } from "@/components/organisation/work-location-fields";
import { placeApi, type NamedType, type WorkLocationDetail, type WorkLocationRecord } from "@/lib/place/api";
import { listTenantUsers } from "@/lib/workforce/api";
import type { TenantUser } from "@/lib/workforce/types";

export default function WorkLocationViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [location, setLocation] = useState<WorkLocationDetail | null>(null);
  const [siteName, setSiteName] = useState("");
  const [parentName, setParentName] = useState("");
  const [typeName, setTypeName] = useState("");
  const [hazardNames, setHazardNames] = useState<string[]>([]);
  const [approverNames, setApproverNames] = useState<string[]>([]);
  const [approverNote, setApproverNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      placeApi.getWorkLocation(id),
      sitesApi.list().catch(() => []),
      placeApi.listLocationTypes().catch(() => [] as NamedType[]),
      hazardsApi.list().catch(() => []),
      listTenantUsers().catch(() => [] as TenantUser[]),
    ])
      .then(async ([detail, sites, types, hazards, users]) => {
        if (cancelled) return;
        const siblings = await placeApi.listWorkLocations(detail.siteId).catch(() => [] as WorkLocationRecord[]);
        if (cancelled) return;
        setLocation(detail);
        setSiteName(sites.find((site) => site.id === detail.siteId)?.name ?? "Site");
        const parent = siblings.find((row) => row.id === detail.parentId);
        setParentName(parent?.pathText || parent?.name || "");
        setTypeName(types.find((type) => type.id === detail.locationTypeId)?.name ?? "");
        const hazardById = new Map(hazards.map((hazard) => [hazard.id, hazard.name]));
        setHazardNames((detail.hazardIds ?? []).map((hazardId) => hazardById.get(hazardId) ?? "Hazard"));
        const userById = new Map(users.map((user) => [user.id, personName(user)]));
        setApproverNames(detail.approvers.userIds.map((userId) => userById.get(userId) ?? "Person"));
        if (detail.approvers.warning) {
          setApproverNote("No approver is set on this location or above it. Any permit approver for this site may approve.");
        } else if (detail.approvers.inheritedFrom) {
          const source = siblings.find((row) => row.id === detail.approvers.inheritedFrom);
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

  async function archive() {
    if (!location) return;
    if (!(await confirmAction(`Archive ${location.name}? It stays on closed permits.`))) return;
    setSaving(true);
    setError(null);
    try {
      await placeApi.archiveWorkLocation(location.id);
      toast(`${location.name} archived`);
      router.push(`/organisation/work-locations?siteId=${location.siteId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to archive this work location");
    } finally {
      setSaving(false);
    }
  }

  const back = {
    href: location ? `/organisation/work-locations?siteId=${location.siteId}` : "/organisation/work-locations",
    label: "Work locations",
  };

  return (
    <AdminPage>
      <AdminPageHeader
        title={location?.name ?? "Work location"}
        description={location?.code ?? "Details for this work location."}
        back={back}
        action={
          location && location.status !== "archived" ? (
            <Button type="button" onClick={() => router.push(`/organisation/work-locations/${id}/edit`)}>
              Edit
            </Button>
          ) : null
        }
      />
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && location ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Code</dt>
              <dd className="mt-1 font-mono">{location.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-1">
                <OrgStatusBadge status={location.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Site</dt>
              <dd className="mt-1">{siteName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nest under</dt>
              <dd className="mt-1">{parentName || "Top of the site"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="mt-1">{typeName || "No type"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap">{location.description?.trim() || "None"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Hazards</dt>
              <dd className="mt-1">{hazardNames.length > 0 ? hazardNames.join(", ") : "None"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Approvers</dt>
              <dd className="mt-1">{approverNames.length > 0 ? approverNames.join(", ") : "None set"}</dd>
              {approverNote ? <p className="mt-1 text-muted-foreground">{approverNote}</p> : null}
            </div>
          </dl>
          {location.status !== "archived" ? (
            <div className="mt-4">
              <Button type="button" variant="destructive" disabled={saving} onClick={() => void archive()}>
                Archive
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </AdminPage>
  );
}
