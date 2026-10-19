"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultPermitType } from "@/lib/platform/api";
import { Alert, CatalogueAdd, recordHref } from "./catalogue";

const QUERY = "tab=permit-types";

export function PermitTypesPanel() {
  const router = useRouter();
  const [rows, setRows] = useState<DefaultPermitType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return platformDefaultsApi
      .permitTypes()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit types"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(row: DefaultPermitType) {
    if (!(await confirmAction(`Remove ${row.name} from the default permit types?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removePermitType(row.id);
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the permit type");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Permit types copied onto a tenant when it is created. Each one has a code, a name, a description, and a colour.
      </p>
      <CatalogueAdd href={recordHref("permit-type", "new", QUERY)} label="Add permit type" />
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
                <th className="px-4 py-2.5 font-medium">Colour</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
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
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ backgroundColor: row.color }} />
                      {row.color}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">{row.description || "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => router.push(recordHref("permit-type", row.id, QUERY)) },
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
