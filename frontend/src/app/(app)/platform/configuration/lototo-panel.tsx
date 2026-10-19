"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultPpeCategory } from "@/lib/platform/api";
import { Alert, CatalogueAdd, recordHref } from "./catalogue";

const QUERY = "tab=lototo";

export function LototoPanel() {
  return (
    <div className="grid gap-4">
      <SegmentedToggle
        label="LOTOTO"
        value="energy-source"
        onChange={() => undefined}
        options={[{ value: "energy-source", label: "Energy source" }]}
      />
      <EnergySources />
    </div>
  );
}

function EnergySources() {
  const router = useRouter();
  const [rows, setRows] = useState<DefaultPpeCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return platformDefaultsApi
      .energySources()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load energy sources"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(row: DefaultPpeCategory) {
    if (!(await confirmAction(`Remove ${row.name} from the default energy sources?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removeEnergySource(row.id);
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the energy source");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Energy sources copied onto a tenant when it is created. Each one is a name. Other stays on the list.
      </p>
      <CatalogueAdd href={recordHref("energy-source", "new", QUERY)} label="Add energy source" />
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Energy source</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-medium">
                    {row.name}
                    {row.isFallback ? <span className="ml-2 font-normal text-muted-foreground">Default</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => router.push(recordHref("energy-source", row.id, QUERY)) },
                        row.isFallback ? null : { label: "Remove", danger: true, onClick: () => void remove(row) },
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
