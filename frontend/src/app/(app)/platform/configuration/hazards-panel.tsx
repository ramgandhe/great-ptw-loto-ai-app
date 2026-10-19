"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultHazard } from "@/lib/platform/api";
import { Alert, CatalogueAdd, recordHref } from "./catalogue";

const QUERY = "tab=hazards";

export function HazardsPanel() {
  const router = useRouter();
  const [rows, setRows] = useState<DefaultHazard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return platformDefaultsApi
      .hazards()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load hazards"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(row: DefaultHazard) {
    if (!(await confirmAction(`Remove ${row.name} from the default hazards?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removeHazard(row.id);
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the hazard");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Hazards copied onto a tenant when it is created, including the permit types and PPE ticked here.
      </p>
      <CatalogueAdd href={recordHref("hazard", "new", QUERY)} label="Add hazard" />
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => router.push(recordHref("hazard", row.id, QUERY)) },
                        { label: "Remove", danger: true, onClick: () => void remove(row) },
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
