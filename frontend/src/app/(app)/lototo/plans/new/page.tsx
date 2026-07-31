"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { createLototoPlan } from "@/lib/lototo/api";
import {
  filterMachineryByWorkstation,
  loadLototoFormOptions,
} from "@/lib/lototo/form-options";
import {
  formatOrgOptionLabel,
  SelectField,
} from "@/components/lototo/select-field";
import { fieldClassName, FormField } from "@/components/permit/form-field";
import { Button } from "@/components/ui/button";

function NewLototoPlanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [permits, setPermits] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>>["permits"]>([]);
  const [workstations, setWorkstations] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>>["workstations"]>([]);
  const [machinery, setMachinery] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>>["machinery"]>([]);
  const [permitId, setPermitId] = useState(searchParams.get("permitId") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workstationId, setWorkstationId] = useState("");
  const [machineryId, setMachineryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMachinery = useMemo(
    () => filterMachineryByWorkstation(machinery, workstationId),
    [machinery, workstationId],
  );

  useEffect(() => {
    function loadFormData() {
      loadLototoFormOptions()
        .then((options) => {
          setPermits(options.permits);
          setWorkstations(options.workstations);
          setMachinery(options.machinery);
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : "Failed to load form data");
        });
    }

    loadFormData();
    window.addEventListener("focus", loadFormData);
    return () => window.removeEventListener("focus", loadFormData);
  }, []);

  useEffect(() => {
    if (machineryId && !filteredMachinery.some((item) => item.id === machineryId)) {
      setMachineryId("");
    }
  }, [filteredMachinery, machineryId]);

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
        <p className="text-sm text-muted-foreground">
          Link a plan to an approved, active, or suspended permit.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <SelectField
          id="lototo-permit"
          label="Permit"
          required
          value={permitId}
          onChange={setPermitId}
          placeholder={permits.length === 0 ? "No eligible permits" : "Select permit"}
          hint={
            permits.length === 0
              ? "Complete permit approval before creating a LOTOTO plan."
              : undefined
          }
          options={permits.map((permit) => ({
            value: permit.id,
            label: `${permit.title}${permit.reference ? ` (${permit.reference})` : ""} · ${permit.status.replace(/_/g, " ")}`,
          }))}
        />

        <FormField label="Title" htmlFor="lototo-title">
          <input
            id="lototo-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClassName}
            placeholder="Compressor isolation plan"
          />
        </FormField>

        <FormField label="Description" htmlFor="lototo-description">
          <textarea
            id="lototo-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={fieldClassName}
          />
        </FormField>

        <SelectField
          id="lototo-workstation"
          label="Workstation"
          value={workstationId}
          onChange={setWorkstationId}
          placeholder="None"
          hint={
            workstations.length === 0
              ? "Add workstations under Organisation → Workstations."
              : "Optional — filters machinery below."
          }
          options={workstations.map((ws) => ({
            value: ws.id,
            label: formatOrgOptionLabel(ws),
          }))}
        />

        <SelectField
          id="lototo-machinery"
          label="Machinery"
          value={machineryId}
          onChange={setMachineryId}
          placeholder={filteredMachinery.length === 0 ? "No machinery available" : "None"}
          hint={
            filteredMachinery.length === 0
              ? "Add machinery under Organisation → Machinery."
              : workstationId
                ? "Showing machinery for the selected workstation."
                : "Optional — select a workstation to narrow the list."
          }
          options={filteredMachinery.map((item) => ({
            value: item.id,
            label: formatOrgOptionLabel(item),
          }))}
        />

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
