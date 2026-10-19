"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmAction } from "@/components/ui/confirm-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { platformDefaultsApi, type DefaultPpeCategory, type DefaultPpeItem } from "@/lib/platform/api";
import { Alert, CatalogueAdd, recordHref } from "./catalogue";

export type PpeSection = "categories" | "items";

export function PpePanel({
  section,
  onSectionChange,
}: {
  section: PpeSection;
  onSectionChange: (section: PpeSection) => void;
}) {
  return (
    <div className="grid gap-4">
      <SegmentedToggle
        label="PPE"
        value={section}
        onChange={onSectionChange}
        options={[
          { value: "categories", label: "Categories" },
          { value: "items", label: "Items" },
        ]}
      />
      {section === "categories" ? <Categories /> : <Items />}
    </div>
  );
}

function Categories() {
  const router = useRouter();
  const [rows, setRows] = useState<DefaultPpeCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return platformDefaultsApi
      .ppeCategories()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load categories"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(row: DefaultPpeCategory) {
    if (!(await confirmAction(`Remove ${row.name}?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removePpeCategory(row.id, false);
    } catch (err) {
      if (!(err instanceof ApiError) || err.code !== "IN_USE") {
        setError(err instanceof ApiError ? err.message : "Could not remove the category");
        return;
      }
      const lines = Array.isArray(err.details) ? err.details.map(String) : [];
      const extra = lines.length ? `\n\n${lines.map((line) => `• ${line}`).join("\n")}` : "";
      if (!(await confirmAction(`${row.name} is used by default PPE items.${extra}\n\nRemove it anyway? Those items will be set to Others.`))) {
        return;
      }
      try {
        await platformDefaultsApi.removePpeCategory(row.id, true);
      } catch (forceErr) {
        setError(forceErr instanceof ApiError ? forceErr.message : "Could not remove the category");
        return;
      }
    }
    toast(`${row.name} removed`);
    await load();
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        A category is a name only. Others stays on the list. Editing a category updates the default PPE items that use it.
      </p>
      <CatalogueAdd href={recordHref("ppe-category", "new", "tab=ppe")} label="Add category" />
      {error ? <Alert message={error} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="table-box">
          <table className="min-w-full text-sm">
            <thead className="table-tone text-left text-xs">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">Category</th>
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
                        { label: "Edit", onClick: () => router.push(recordHref("ppe-category", row.id, "tab=ppe")) },
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

function Items() {
  const router = useRouter();
  const [rows, setRows] = useState<DefaultPpeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    return platformDefaultsApi
      .ppeItems()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load PPE items"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function remove(row: DefaultPpeItem) {
    if (!(await confirmAction(`Remove ${row.name} from the default PPE items?`))) return;
    setError(null);
    try {
      await platformDefaultsApi.removePpeItem(row.id);
      toast(`${row.name} removed`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the PPE item");
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Each item has a code, a name, a category, and a description. The category is chosen from the default category list.
      </p>
      <CatalogueAdd href={recordHref("ppe-item", "new", "tab=ppe&section=items")} label="Add PPE item" />
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
                  <td className="px-4 py-3">{row.categoryName}</td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">{row.description || "—"}</td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        { label: "Edit", onClick: () => router.push(recordHref("ppe-item", row.id, "tab=ppe&section=items")) },
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
