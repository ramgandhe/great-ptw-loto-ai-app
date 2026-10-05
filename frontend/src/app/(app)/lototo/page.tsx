"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorNote, RecordList, RecordRow } from "@/components/safety/record-list";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { hasAnyRole } from "@/lib/auth/rbac";
import { LOTOTO_LIBRARY_WRITE_ROLES } from "@/lib/auth/roles";
import { listLototoProcedures, deactivateLototoProcedure, reactivateLototoProcedure, deleteLototoProcedure } from "@/lib/lototo/api";
import type { LototoProcedureListItem } from "@/lib/lototo/types";
import { loadLookups, nameOf, type Lookups } from "@/lib/lookups";

function ProcedureLibrary() {
  const router = useRouter();
  const params = useSearchParams();
  const machineryId = params.get("machineryId") ?? undefined;
  const { roles } = useAuthProfile();
  const canWrite = hasAnyRole(roles, LOTOTO_LIBRARY_WRITE_ROLES);
  const [rows, setRows] = useState<LototoProcedureListItem[] | null>(null);
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLookups().then(setLookups, () => undefined);
    listLototoProcedures(machineryId ? { machineryId } : undefined)
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Procedures could not be loaded."));
  }, [machineryId]);

  async function reload() {
    const next = await listLototoProcedures(machineryId ? { machineryId } : undefined);
    setRows(next);
  }

  async function runAction(id: string, action: "deactivate" | "reactivate" | "delete") {
    setError(null);
    try {
      if (action === "deactivate") {
        if (!window.confirm("Deactivate this procedure? It will no longer be offered on new permits.")) {
          return;
        }
        await deactivateLototoProcedure(id);
      } else if (action === "reactivate") {
        await reactivateLototoProcedure(id);
      } else {
        if (!window.confirm("Delete this unused procedure?")) {
          return;
        }
        await deleteLototoProcedure(id);
      }
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That action could not be completed.");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="LOTOTO procedures"
        description="Define reusable lockout procedures per machine. Isolation during work is recorded on the permit."
        actions={
          canWrite ? (
            <Button type="button" size="lg" onClick={() => router.push(`/lototo/procedures/new${machineryId ? `?machineryId=${machineryId}` : ""}`)}>
              <Plus aria-hidden />
              New procedure
            </Button>
          ) : null
        }
      />
      <ErrorNote message={error} />
      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading procedures…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No LOTOTO procedures yet"
          hint={canWrite ? "Create a procedure for a machine. Executors will attach the published version on a permit." : undefined}
        />
      ) : (
        <RecordList headers={["Procedure", "Machinery", "Status", ""]}>
          {rows.map((row, i) => (
            <RecordRow
              key={row.id}
              index={i}
              href={`/lototo/procedures/${row.id}`}
              title={row.title}
              reference={row.code}
              context={nameOf(lookups?.machinery, row.machineryId) ?? "Machinery"}
              status={<span className="text-sm capitalize">{row.status}</span>}
              action={
                canWrite ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {row.status === "published" ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void runAction(row.id, "deactivate")}>
                        Deactivate
                      </Button>
                    ) : null}
                    {row.status === "inactive" ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void runAction(row.id, "reactivate")}>
                        Reactivate
                      </Button>
                    ) : null}
                    {row.status !== "published" ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void runAction(row.id, "delete")}>
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ) : null
              }
            />
          ))}
        </RecordList>
      )}
    </main>
  );
}

export default function LototoPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading LOTOTO…</main>}>
      <ProcedureLibrary />
    </Suspense>
  );
}
