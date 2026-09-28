"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Plus, Search } from "lucide-react";
import { ApiError } from "@/lib/api";
import { masterDataApi, type MasterDataRecord } from "@/lib/master-data/api";
import { KIND_LABEL, fieldCount, permitTemplatesApi, type PermitTemplate } from "@/lib/organisation/templates";
import { AdminPage, AdminPageHeader } from "@/components/layout/admin-page-header";
import { OrgStatusBadge } from "@/components/organisation/org-status-badge";
import { Button } from "@/components/ui/button";

export default function TemplatesPage() {
  const router = useRouter();
  const [items, setItems] = useState<PermitTemplate[]>([]);
  const [types, setTypes] = useState<MasterDataRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    return Promise.all([permitTemplatesApi.list(), masterDataApi.permitTypes()])
      .then(([templates, permitTypes]) => {
        setItems(templates.sort((a, b) => (a.code ?? a.name).localeCompare(b.code ?? b.name)));
        setTypes(permitTypes);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load templates"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const typeById = useMemo(() => new Map(types.map((type) => [type.id, type])), [types]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((t) => [t.name, t.code, t.config?.reference].some((v) => v?.toLowerCase().includes(q))) : items;
  }, [items, query]);

  async function run(action: () => Promise<string | void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (result) setMessage(result);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function createTemplate() {
    setBusy(true);
    try {
      const created = await permitTemplatesApi.create({
        name: "New check sheet",
        config: { kind: "check-sheet", sections: [{ id: "checks", title: "Checks", fields: [] }] },
      });
      router.push(`/organisation/templates/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the template");
      setBusy(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Permit templates"
        description="The permit form and check sheets people fill in, linked to the permit types they apply to."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await permitTemplatesApi.importReference();
                  return result.created
                    ? `Imported ${result.created} reference template${result.created === 1 ? "" : "s"}.`
                    : "All reference templates are already here.";
                })
              }
            >
              <FileDown aria-hidden />
              Import reference set
            </Button>
            <Button size="lg" disabled={busy} onClick={() => void createTemplate()}>
              <Plus aria-hidden />
              New template
            </Button>
          </div>
        }
      />

      {message ? (
        <p role="status" className="text-sm font-medium text-(--status-success)">
          {message}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {items.length > 5 ? (
        <label className="relative flex h-10 items-center sm:w-80">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search templates</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${items.length} templates`}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">No templates yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Import the reference set (a safe work permit and eight check sheets for electrical, height, hot work,
            confined space and more), then adjust them to your site.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((template) => {
            const linked = template.permitTypeIds.map((id) => typeById.get(id)).filter((t): t is MasterDataRecord => Boolean(t));
            return (
              <li key={template.id} className="rounded-xl border border-border bg-card transition-colors hover:border-(--border-strong)">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
                  <button
                    type="button"
                    onClick={() => router.push(`/organisation/templates/${template.id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      <OrgStatusBadge status={template.status} />
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {template.config ? KIND_LABEL[template.config.kind] : "Form not set up"}
                      {template.config?.reference ? ` · ${template.config.reference}` : template.code ? ` · ${template.code}` : ""}
                      {` · ${template.config?.sections.length ?? 0} sections, ${fieldCount(template.config)} fields`}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {linked.length === 0 ? (
                        <span className="text-xs text-(--status-warning)">Not linked to a permit type</span>
                      ) : linked.length === types.length && types.length > 1 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">All permit types</span>
                      ) : (
                        linked.map((type) => (
                          <span key={type.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
                            <span className="size-2 rounded-full" style={{ backgroundColor: type.color ?? "transparent" }} aria-hidden />
                            {type.name}
                          </span>
                        ))
                      )}
                    </span>
                  </button>
                  <div className="flex gap-3 text-sm">
                    <button type="button" className="text-primary hover:underline" onClick={() => router.push(`/organisation/templates/${template.id}`)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-primary hover:underline disabled:opacity-50"
                      onClick={() =>
                        void run(async () => {
                          const copy = await permitTemplatesApi.duplicate(template.id);
                          return `Duplicated as “${copy.name}” (draft).`;
                        })
                      }
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"
                      onClick={() => {
                        if (window.confirm(`Archive “${template.name}”? It will no longer be offered on permits.`)) {
                          void run(async () => {
                            await permitTemplatesApi.archive(template.id);
                            return `Archived ${template.name}.`;
                          });
                        }
                      }}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
