"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { createIncident } from "@/lib/incidents/api";
import type { CreateIncidentPayload, IncidentType } from "@/lib/incidents/types";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { Button } from "@/components/ui/button";

const INCIDENT_TYPES: IncidentType[] = ["incident", "near_miss", "unsafe_condition"];

export default function NewIncidentPage() {
  const router = useRouter();
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [incidentType, setIncidentType] = useState<IncidentType>("incident");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [permitId, setPermitId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listPermits()
      .then(setPermits)
      .catch(() => setPermits([]));
  }, []);

  async function handleSubmit(submit: boolean) {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: CreateIncidentPayload = {
        incidentType,
        title: title.trim(),
        description: description.trim(),
        locationDescription: locationDescription.trim() || undefined,
        occurredAt: new Date(occurredAt).toISOString(),
        permitIds: permitId ? [permitId] : undefined,
        submit,
      };
      const incident = await createIncident(payload);
      router.push(`/incidents/${incident.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create incident");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Report incident</h1>
        <p className="text-sm text-muted-foreground">Record an incident, near miss or unsafe condition.</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(true);
        }}
      >
        <label className="block text-sm">
          Type
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={incidentType}
            onChange={(e) => setIncidentType(e.target.value as IncidentType)}
          >
            {INCIDENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Title
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            className="mt-1 min-h-28 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Location
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={locationDescription}
            onChange={(e) => setLocationDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Occurred at
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Linked permit (optional)
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={permitId}
            onChange={(e) => setPermitId(e.target.value)}
          >
            <option value="">None</option>
            {permits.map((permit) => (
              <option key={permit.id} value={permit.id}>
                {permit.title} {permit.reference ? `(${permit.reference})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit report"}
          </Button>
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleSubmit(false)}>
            Save draft
          </Button>
        </div>
      </form>
    </main>
  );
}
