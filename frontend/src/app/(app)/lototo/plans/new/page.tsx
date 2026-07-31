"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { machineryApi, workstationsApi } from "@/lib/organisation/api";
import type { OrgRecord } from "@/lib/organisation/types";
import { createLototoPlan } from "@/lib/lototo/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { Button } from "@/components/ui/button";

function NewLototoPlanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [workstations, setWorkstations] = useState<OrgRecord[]>([]);
  const [machinery, setMachinery] = useState<OrgRecord[]>([]);
  const [permitId, setPermitId] = useState(searchParams.get("permitId") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workstationId, setWorkstationId] = useState("");
  const [machineryId, setMachineryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      listPermits("approved"),
      workstationsApi.list(),
      machineryApi.list(),
    ])
      .then(([approved, ws, mc]) => {
        setPermits(approved);
        setWorkstations(ws);
        setMachinery(mc);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load form data");
      });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!permitId || !title.trim()) {
      setError("Permit and title are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const plan = await createLototoPlan({
        permitId,
        title: title.trim(),
        description: description.trim() || undefined,
        workstationId: workstationId || undefined,
        machineryId: machineryId || undefined,
      });
      router.push(`/lototo/plans/${plan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create plan");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/lototo" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to LOTOTO plans
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New LOTOTO plan</h1>
        <p className="text-sm text-muted-foreground">Link a plan to an approved permit.</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Permit</span>
          <select
            required
            value={permitId}
            onChange={(e) => setPermitId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">Select approved permit</option>
            {permits.map((permit) => (
              <option key={permit.id} value={permit.id}>
                {permit.title} {permit.reference ? `(${permit.reference})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Title</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2"
            placeholder="Compressor isolation plan"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="rounded-md border border-input bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Workstation (optional)</span>
          <select
            value={workstationId}
            onChange={(e) => setWorkstationId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">None</option>
            {workstations.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Machinery (optional)</span>
          <select
            value={machineryId}
            onChange={(e) => setMachineryId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">None</option>
            {machinery.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create plan"}
          </Button>
          <Link href="/lototo">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </main>
  );
}

export default function NewLototoPlanPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}>
      <NewLototoPlanForm />
    </Suspense>
  );
}
