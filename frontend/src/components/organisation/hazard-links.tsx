"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";
import { StringListField } from "@/components/organisation/string-list-field";
import { hazardsApi } from "@/lib/organisation/api";
import { masterDataApi, type HazardRecord, type MasterDataRecord } from "@/lib/master-data/api";

const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const emptyHazard = {
  name: "",
  code: "",
  category: "",
  description: "",
  severity: "medium",
  consequences: [""],
  risks: [""],
  controls: [""],
  permitTypeCodes: [] as string[],
  ppeIds: [] as string[],
};

/** Link hazards that already exist, or add one with the organisation hazard fields. */
export function HazardLinks({
  hazardIds,
  onChange,
}: {
  hazardIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [ppe, setPpe] = useState<MasterDataRecord[]>([]);
  const [types, setTypes] = useState<MasterDataRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyHazard);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  function reload() {
    hazardsApi
      .list()
      .then(setHazards)
      .catch(() => setHazards([]))
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    reload();
    masterDataApi.ppe().then(setPpe).catch(() => setPpe([]));
    masterDataApi.permitTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  function toggle(id: string) {
    onChange(hazardIds.includes(id) ? hazardIds.filter((item) => item !== id) : [...hazardIds, id]);
  }

  async function createHazard(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!draft.name.trim() || !draft.code.trim() || !draft.category.trim()) {
      setError("Name, code and category are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await hazardsApi.create({
        name: draft.name.trim(),
        code: draft.code.trim(),
        category: draft.category.trim(),
        description: draft.description.trim() || undefined,
        severity: draft.severity,
        consequences: draft.consequences,
        risks: draft.risks,
        controls: draft.controls,
        permitTypeCodes: draft.permitTypeCodes,
        ppeIds: draft.ppeIds,
      });
      toast("Hazard added");
      setDraft(emptyHazard);
      setAdding(false);
      reload();
      if (!hazardIds.includes(created.id)) onChange([...hazardIds, created.id]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the hazard.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Hazards</span>
        <Button type="button" variant="outline" onClick={() => setAdding((open) => !open)}>
          {adding ? "Cancel new hazard" : "Add hazard"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Optional. Link hazards from the organisation list, or add one here.</p>
      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading hazards…</p>
      ) : hazards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hazards yet.</p>
      ) : (
        <div className="grid max-h-48 gap-1 overflow-auto rounded-lg border border-border p-2">
          {hazards.map((hazard) => (
            <label key={hazard.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={hazardIds.includes(hazard.id)} onChange={() => toggle(hazard.id)} />
              <span>{hazard.name}</span>
              {hazard.code ? <span className="text-muted-foreground">{hazard.code}</span> : null}
            </label>
          ))}
        </div>
      )}
      {adding ? (
        <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input required className={FIELD_CLASS} value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Code</span>
            <input required className={FIELD_CLASS} value={draft.code} onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Category</span>
            <input required className={FIELD_CLASS} value={draft.category} onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Risk / severity</span>
            <AppSelect className={FIELD_CLASS} value={draft.severity} onChange={(event) => setDraft((prev) => ({ ...prev, severity: event.target.value }))}>
              {SEVERITIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </AppSelect>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Description</span>
            <textarea className={`${FIELD_CLASS} h-20 py-2`} value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          {types.length > 0 ? (
            <fieldset className="grid gap-2 sm:col-span-2">
              <legend className="text-sm font-medium">Associated permit types</legend>
              <div className="flex flex-wrap gap-2">
                {types.map((type) => {
                  const code = type.code ?? "";
                  const checked = draft.permitTypeCodes.includes(code);
                  return (
                    <label key={type.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft((prev) => ({
                            ...prev,
                            permitTypeCodes: checked ? prev.permitTypeCodes.filter((item) => item !== code) : [...prev.permitTypeCodes, code],
                          }))
                        }
                      />
                      {type.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <div className="sm:col-span-2">
            <StringListField label="Risks" values={draft.risks} addLabel="Add risk" onChange={(risks) => setDraft((prev) => ({ ...prev, risks }))} />
          </div>
          <div className="sm:col-span-2">
            <StringListField label="Potential consequences" values={draft.consequences} addLabel="Add consequence" onChange={(consequences) => setDraft((prev) => ({ ...prev, consequences }))} />
          </div>
          <div className="sm:col-span-2">
            <StringListField label="Controls" values={draft.controls} addLabel="Add control" onChange={(controls) => setDraft((prev) => ({ ...prev, controls }))} />
          </div>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="text-sm font-medium">Associated PPE</legend>
            <p className="text-xs text-muted-foreground">Optional.</p>
            {ppe.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PPE items yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ppe.map((item) => {
                  const checked = draft.ppeIds.includes(item.id);
                  return (
                    <label key={item.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft((prev) => ({
                            ...prev,
                            ppeIds: checked ? prev.ppeIds.filter((id) => id !== item.id) : [...prev.ppeIds, item.id],
                          }))
                        }
                      />
                      {item.name}
                      {item.code ? <span className="text-muted-foreground">{item.code}</span> : null}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
          <div>
            <Button type="button" disabled={saving} onClick={(event) => void createHazard(event)}>
              {saving ? "Saving…" : "Save hazard"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
