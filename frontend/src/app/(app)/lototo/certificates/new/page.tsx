"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorNote } from "@/components/safety/record-list";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { listLototoProcedures } from "@/lib/lototo/api";
import { createIsolationCertificate } from "@/lib/lototo/certificates";
import type { LototoProcedureListItem } from "@/lib/lototo/types";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function NewIsolationPage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<LototoProcedureListItem[] | null>(null);
  const [procedureId, setProcedureId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLototoProcedures({ published: true })
      .then(setProcedures)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Published procedures could not be loaded."));
  }, []);

  const selected = procedures?.find((row) => row.id === procedureId);

  function chooseProcedure(id: string) {
    const next = procedures?.find((row) => row.id === id);
    setProcedureId(id);
    if (!titleTouched) setTitle(next?.title ?? "");
  }

  async function submit() {
    if (!selected) {
      setError("Choose a published procedure.");
      return;
    }
    if (!title.trim()) {
      setError("Give this isolation a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createIsolationCertificate({
        title: title.trim(),
        procedureId: selected.id,
        workLocationId: selected.workLocationId ?? undefined,
        assetId: selected.assetId ?? undefined,
      });
      router.push(`/lototo/certificates/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The isolation could not be started.");
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
      <PageHeader
        title="New isolation"
        description="Copy a published procedure. Its points freeze on this certificate."
        back={{ href: "/lototo", label: "Isolations" }}
      />
      <ErrorNote message={error} />
      {procedures === null ? (
        <p className="text-sm text-muted-foreground">Loading published procedures…</p>
      ) : procedures.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Publish a procedure first.{" "}
          <button type="button" className="underline" onClick={() => router.push("/lototo/procedures")}>
            Open the procedure library
          </button>
        </p>
      ) : (
        <form
          className="grid max-w-xl gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Procedure</span>
            <AppSelect className={FIELD} value={procedureId} onChange={(event) => chooseProcedure(event.target.value)} required>
              <option value="">Select a published procedure</option>
              {procedures.map((row) => (
                <option key={row.id} value={row.id}>{row.code} — {row.title}</option>
              ))}
            </AppSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Title</span>
            <input
              className={FIELD}
              value={title}
              onChange={(event) => {
                setTitleTouched(true);
                setTitle(event.target.value);
              }}
              required
            />
          </label>
          <div>
            <Button type="submit" disabled={saving}>{saving ? "Starting…" : "Start draft"}</Button>
          </div>
        </form>
      )}
    </main>
  );
}
