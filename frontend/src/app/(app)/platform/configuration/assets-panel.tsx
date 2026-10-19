"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultAssetType } from "@/lib/platform/api";
import { Alert, CatalogueAdd, recordHref } from "./catalogue";

const QUERY = "tab=assets";

export function AssetsPanel() {
  return (
    <div className="grid gap-4">
      <SegmentedToggle
        label="Assets"
        value="asset-types"
        onChange={() => undefined}
        options={[{ value: "asset-types", label: "Asset types" }]}
      />
      <AssetTypes />
    </div>
  );
}

function AssetTypes() {
  const router = useRouter();
  const [rows, setRows] = useState<DefaultAssetType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return platformDefaultsApi
      .assetTypes()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load asset types"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(row: DefaultAssetType) {
    if (!(await confirmAction(`Remove ${row.name} from the default asset types?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removeAssetType(row.id);
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the asset type");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Asset types copied onto a tenant when it is created. A name and a description.
      </p>
      <CatalogueAdd href={recordHref("asset-type", "new", QUERY)} label="Add asset type" />
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="row-hover border-t border-border first:border-t-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.description || "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => router.push(recordHref("asset-type", row.id, QUERY)) },
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
