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
  const [workstations, setWorkstations] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>>["workstations"]>([]);
  const [machinery, setMachinery] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>>["machinery"]>([]);
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
          setWorkstations(options.workstations);
          setMachinery(options.machinery);
          const fromQuery = searchParams.get("machineryId");
          if (fromQuery) {
            setMachineryId(fromQuery);
          }
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : "Failed to load form data");
        });
    }

    loadFormData();
    window.addEventListener("focus", loadFormData);
    return () => window.removeEventListener("focus", loadFormData);
  }, [searchParams]);

  useEffect(() => {
    if (machinery.length === 0) {
      return;
    }
    if (machineryId && !filteredMachinery.some((item) => item.id === machineryId)) {
      setMachineryId("");
    }
  }, [filteredMachinery, machineryId, machinery.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!machineryId || !title.trim()) {
      setError("Machinery and title are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const plan = await createLototoPlan({
        machineryId,
        title: title.trim(),
        description: description.trim() || undefined,
        workstationId: workstationId || undefined,
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
          Attach a LOTOTO procedure to machinery. Permits can then select it when LOTOTO is required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

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
          required
          value={machineryId}
          onChange={setMachineryId}
          placeholder={filteredMachinery.length === 0 ? "No machinery available" : "Select machinery"}
          hint={
            filteredMachinery.length === 0
              ? "Add machinery under Organisation → Machinery."
              : workstationId
                ? "Showing machinery for the selected workstation."
                : undefined
          }
          options={filteredMachinery.map((item) => ({
            value: item.id,
            label: formatOrgOptionLabel(item),
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
