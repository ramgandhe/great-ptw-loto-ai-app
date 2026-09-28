"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedToggle } from "@/components/ui/toggle-group";
import { ApiError } from "@/lib/api";
import { INCIDENT_TYPES } from "@/lib/analytics/labels";
import { createIncident } from "@/lib/incidents/api";
import type { Incident, IncidentType } from "@/lib/incidents/types";
import { createLototoPlan } from "@/lib/lototo/api";
import { filterMachineryByWorkstation, loadLototoFormOptions } from "@/lib/lototo/form-options";
import { formatOrgOptionLabel } from "@/components/lototo/select-field";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";

/** Same field look as the organisation "Add" forms. */
const FIELD =
  "rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, optional, wide, children }: { label: string; optional?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
      </span>
      {children}
    </label>
  );
}

function Panel({ title, error, onSubmit, children }: { title: string; error: string | null; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), []);
  return (
    <form ref={ref} onSubmit={onSubmit} className="reveal-in grid scroll-mt-48 gap-4 rounded-xl border border-border bg-card p-5 shadow-(--shadow-lg) sm:grid-cols-2">
      <h2 className="font-heading text-lg font-semibold sm:col-span-2">{title}</h2>
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}
      {children}
    </form>
  );
}

/** "New LOTOTO plan" opened in place on the LOTOTO page. After creating, the plan opens so its steps can be added. */
export function LototoPlanCreatePanel({ initialMachineryId, onClose }: { initialMachineryId?: string; onClose: () => void }) {
  const router = useRouter();
  const [options, setOptions] = useState<Awaited<ReturnType<typeof loadLototoFormOptions>> | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workstationId, setWorkstationId] = useState("");
  const [machineryId, setMachineryId] = useState(initialMachineryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLototoFormOptions().then(setOptions, (err) => setError(err instanceof ApiError ? err.message : "Machinery could not be loaded."));
  }, []);

  const machinery = useMemo(() => filterMachineryByWorkstation(options?.machinery ?? [], workstationId), [options, workstationId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
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
      setError(err instanceof ApiError ? err.message : "The plan could not be created. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <Panel title="New LOTOTO plan" error={error} onSubmit={submit}>
      <Field label="Title" wide>
        <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Compressor isolation plan" className={`h-10 ${FIELD}`} />
      </Field>
      <Field label="Workstation" optional>
        <select
          value={workstationId}
          onChange={(e) => {
            setWorkstationId(e.target.value);
            setMachineryId("");
          }}
          className={`h-10 ${FIELD}`}
        >
          <option value="">Any workstation</option>
          {(options?.workstations ?? []).map((ws) => (
            <option key={ws.id} value={ws.id}>
              {formatOrgOptionLabel(ws)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Machinery">
        <select required value={machineryId} onChange={(e) => setMachineryId(e.target.value)} className={`h-10 ${FIELD}`}>
          <option value="">{options === null ? "Loading machinery…" : machinery.length === 0 ? "No machinery here yet" : "Select machinery"}</option>
          {machinery.map((item) => (
            <option key={item.id} value={item.id}>
              {formatOrgOptionLabel(item)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description" optional wide>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`py-2 ${FIELD}`} />
      </Field>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create plan and add steps"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}

/** "Report incident" opened in place on the Incidents page. The new report appears in the list below. */
export function IncidentReportPanel({ initialPermitId, onCreated, onClose }: { initialPermitId?: string; onCreated: (incident: Incident, submitted: boolean) => void; onClose: () => void }) {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [incidentType, setIncidentType] = useState<IncidentType>("near_miss");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  // Local wall-clock time for the datetime-local input.
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [permitId, setPermitId] = useState(initialPermitId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const asDraft = useRef(false);

  useEffect(() => {
    listPermits().then(setPermits, () => setPermits([]));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const submit = !asDraft.current;
    setSubmitting(true);
    setError(null);
    try {
      const incident = await createIncident({
        incidentType,
        title: title.trim(),
        description: description.trim(),
        locationDescription: locationDescription.trim() || undefined,
        occurredAt: new Date(occurredAt).toISOString(),
        permitIds: permitId ? [permitId] : undefined,
        submit,
      });
      onCreated(incident, submit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The report could not be saved. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Report an incident" error={error} onSubmit={submit}>
      <div className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">What happened</span>
        <SegmentedToggle
          label="Incident type"
          value={incidentType}
          onChange={setIncidentType}
          options={(Object.keys(INCIDENT_TYPES) as IncidentType[]).map((key) => ({ value: key, label: INCIDENT_TYPES[key].label }))}
          className="self-start"
        />
      </div>
      <Field label="Title" wide>
        <input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dropped tool from scaffold" className={`h-10 ${FIELD}`} />
      </Field>
      <Field label="Description" wide>
        <textarea required rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`py-2 ${FIELD}`} />
      </Field>
      <Field label="Where" optional>
        <input value={locationDescription} onChange={(e) => setLocationDescription(e.target.value)} placeholder="Tank farm, north walkway" className={`h-10 ${FIELD}`} />
      </Field>
      <Field label="When">
        <input required type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={`h-10 ${FIELD}`} />
      </Field>
      <Field label="Linked permit" optional wide>
        <select value={permitId} onChange={(e) => setPermitId(e.target.value)} className={`h-10 ${FIELD}`}>
          <option value="">None</option>
          {permits.map((permit) => (
            <option key={permit.id} value={permit.id}>
              {permit.reference ? `${permit.reference}  ` : ""}
              {permit.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={submitting} onClick={() => (asDraft.current = false)}>
          {submitting ? "Saving…" : "Submit report"}
        </Button>
        <Button type="submit" variant="outline" disabled={submitting} onClick={() => (asDraft.current = true)}>
          Save as draft
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
