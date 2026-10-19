"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { industriesApi, type Industry } from "@/lib/platform/api";
import { Alert, CatalogueAdd, recordHref } from "./catalogue";

const QUERY = "tab=industries";

export function IndustriesPanel() {
  const router = useRouter();
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return industriesApi
      .list()
      .then(setIndustries)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load industries"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(industry: Industry) {
    if (!(await confirmAction(`Remove ${industry.name}?`))) return;
    setError(null);
    try {
      await industriesApi.remove(industry.id, false);
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== "IN_USE") {
        setError(err instanceof ApiError ? err.message : "Could not remove the industry");
        return;
      }
      const lines = Array.isArray(err.details) ? err.details.map(String) : [];
      const extra = lines.length ? `\n\n${lines.map((line) => `• ${line}`).join("\n")}` : "";
      if (!(await confirmAction(`${industry.name} is used by tenants.${extra}\n\nRemove it anyway? Those tenants will be set to Others.`))) {
        return;
      }
      try {
        await industriesApi.remove(industry.id, true);
      } catch (forceErr) {
        setError(forceErr instanceof ApiError ? forceErr.message : "Could not remove the industry");
        return;
      }
    }
    toast(`${industry.name} removed`);
    await load();
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Industries a platform admin can assign when creating or editing a tenant. Others stays on the list. Editing one updates the tenants that already use it.
      </p>
      <CatalogueAdd href={recordHref("industry", "new", QUERY)} label="Add industry" />
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Industry</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {industries.map((industry) => (
                <tr key={industry.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-medium">
                    {industry.name}
                    {industry.isFallback ? <span className="ml-2 font-normal text-muted-foreground">Default</span> : null}
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">{industry.description || "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => router.push(recordHref("industry", industry.id, QUERY)) },
                        industry.isFallback
                          ? null
                          : { label: "Remove", danger: true, onClick: () => void remove(industry) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
