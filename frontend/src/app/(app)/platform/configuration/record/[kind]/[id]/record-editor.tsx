"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { StringListField } from "@/components/organisation/string-list-field";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import {
  industriesApi,
  platformDefaultsApi,
  type DefaultPermitType,
  type DefaultPpeCategory,
  type DefaultPpeItem,
} from "@/lib/platform/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import { Alert } from "../../../catalogue";

const TEXTAREA_CLASS =
  "rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const CODE_PATTERN = String.raw`[A-Za-z0-9][A-Za-z0-9._\-/]*`;
const DEFAULT_COLOR = "#2563EB";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const SEVERITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const KINDS = {
  industry: { noun: "industry", back: "Industries", href: "/platform/configuration?tab=industries" },
  "permit-type": { noun: "permit type", back: "Permit types", href: "/platform/configuration?tab=permit-types" },
  "location-type": { noun: "location type", back: "Locations", href: "/platform/configuration?tab=locations" },
  "asset-type": { noun: "asset type", back: "Assets", href: "/platform/configuration?tab=assets" },
  hazard: { noun: "hazard", back: "Hazards", href: "/platform/configuration?tab=hazards" },
  "ppe-category": { noun: "PPE category", back: "PPE", href: "/platform/configuration?tab=ppe" },
  "ppe-item": { noun: "PPE item", back: "PPE", href: "/platform/configuration?tab=ppe&section=items" },
  "energy-source": { noun: "energy source", back: "LOTOTO", href: "/platform/configuration?tab=lototo" },
} as const;

type Kind = keyof typeof KINDS;

function isKind(value: string): value is Kind {
  return value in KINDS;
}

export function RecordEditor({ kind, recordId }: { kind: string; recordId: string }) {
  if (!isKind(kind)) {
    return (
      <AdminPage>
        <AdminPageHeader title="Unknown catalogue" description="This page is not a configuration record." back={{ href: "/platform/configuration", label: "App configuration" }} />
      </AdminPage>
    );
  }
  const meta = KINDS[kind];
  const id = recordId === "new" ? null : recordId;
  const title = `${id ? "Edit" : "Add"} ${meta.noun}`;
  return (
    <AdminPage>
      <AdminPageHeader
        title={title}
        description={
          kind === "industry"
            ? "Name is required. Description can be left blank. Saving updates every tenant that uses this industry."
            : "Copied onto a tenant when it is created. Tenants that already exist keep their own copy."
        }
        back={{ href: meta.href, label: meta.back }}
      />
      {kind === "industry" ? <NamedForm id={id} back={meta.href} mode="industry" /> : null}
      {kind === "location-type" ? <NamedForm id={id} back={meta.href} mode="location-type" /> : null}
      {kind === "asset-type" ? <NamedForm id={id} back={meta.href} mode="asset-type" /> : null}
      {kind === "ppe-category" ? <NameOnlyForm id={id} back={meta.href} mode="ppe-category" /> : null}
      {kind === "energy-source" ? <NameOnlyForm id={id} back={meta.href} mode="energy-source" /> : null}
      {kind === "permit-type" ? <PermitTypeForm id={id} back={meta.href} /> : null}
      {kind === "ppe-item" ? <PpeItemForm id={id} back={meta.href} /> : null}
      {kind === "hazard" ? <HazardForm id={id} back={meta.href} /> : null}
    </AdminPage>
  );
}

function NamedForm({ id, back, mode }: { id: string | null; back: string; mode: "industry" | "location-type" | "asset-type" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load =
      mode === "industry"
        ? industriesApi.list().then((rows) => rows.find((row) => row.id === id))
        : mode === "location-type"
          ? platformDefaultsApi.locationTypes().then((rows) => rows.find((row) => row.id === id))
          : platformDefaultsApi.assetTypes().then((rows) => rows.find((row) => row.id === id));
    load
      .then((row) => {
        if (!row) setError("This record was not found");
        else {
          setName(row.name);
          setDescription(row.description ?? "");
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id, mode]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "location-type" && name.trim().toLowerCase() === "site") {
      setError("Site is not a location type");
      return;
    }
    setSaving(true);
    setError(null);
    const body = { name: name.trim(), description: description.trim() || undefined };
    try {
      if (mode === "industry") {
        if (id) await industriesApi.update(id, body);
        else await industriesApi.create(body);
      } else if (mode === "location-type") {
        if (id) await platformDefaultsApi.updateLocationType(id, body);
        else await platformDefaultsApi.createLocationType(body);
      } else if (id) await platformDefaultsApi.updateAssetType(id, body);
      else await platformDefaultsApi.createAssetType(body);
      toast(`${name.trim()} saved`);
      router.push(back);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <form onSubmit={(event) => void save(event)} className="grid max-w-2xl gap-4">
      {error ? <Alert message={error} /> : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input required pattern={NAME_PATTERN} title={NAME_HINT} maxLength={mode === "industry" ? 128 : 64} className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
        <textarea rows={4} maxLength={2000} className={TEXTAREA_CLASS} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </form>
  );
}

function NameOnlyForm({ id, back, mode }: { id: string | null; back: string; mode: "ppe-category" | "energy-source" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = mode === "ppe-category" ? platformDefaultsApi.ppeCategories() : platformDefaultsApi.energySources();
    load
      .then((rows) => {
        const row = rows.find((item) => item.id === id);
        if (!row) setError("This record was not found");
        else setName(row.name);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id, mode]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "ppe-category") {
        if (id) await platformDefaultsApi.updatePpeCategory(id, name.trim());
        else await platformDefaultsApi.createPpeCategory(name.trim());
      } else if (id) await platformDefaultsApi.updateEnergySource(id, name.trim());
      else await platformDefaultsApi.createEnergySource(name.trim());
      toast(`${name.trim()} saved`);
      router.push(back);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <form onSubmit={(event) => void save(event)} className="grid max-w-xl gap-4">
      {error ? <Alert message={error} /> : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input required pattern={NAME_PATTERN} title={NAME_HINT} maxLength={mode === "ppe-category" ? 128 : 64} className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
    </form>
  );
}

function PermitTypeForm({ id, back }: { id: string | null; back: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    platformDefaultsApi
      .permitTypes()
      .then((rows) => {
        const row = rows.find((item) => item.id === id);
        if (!row) setError("This record was not found");
        else {
          setCode(row.code);
          setName(row.name);
          setDescription(row.description ?? "");
          setColor(HEX_COLOR.test(row.color) ? row.color : DEFAULT_COLOR);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!HEX_COLOR.test(color)) {
      setError("Colour must be a hex value such as #2563EB");
      return;
    }
    setSaving(true);
    setError(null);
    const body = { code: code.trim(), name: name.trim(), description: description.trim() || undefined, color };
    try {
      if (id) await platformDefaultsApi.updatePermitType(id, body);
      else await platformDefaultsApi.createPermitType(body);
      toast(`${name.trim()} saved`);
      router.push(back);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <form onSubmit={(event) => void save(event)} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {error ? <div className="sm:col-span-2"><Alert message={error} /></div> : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Code</span>
        <input required pattern={CODE_PATTERN} maxLength={64} className={`${FIELD_CLASS} font-mono`} value={code} onChange={(event) => setCode(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input required pattern={NAME_PATTERN} title={NAME_HINT} maxLength={255} className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
        <textarea rows={3} maxLength={4000} className={TEXTAREA_CLASS} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Colour</span>
        <span className="flex items-center gap-2">
          <input type="color" value={HEX_COLOR.test(color) ? color : DEFAULT_COLOR} onChange={(event) => setColor(event.target.value.toUpperCase())} />
          <input required pattern="#[0-9A-Fa-f]{6}" className={`${FIELD_CLASS} font-mono`} value={color} onChange={(event) => setColor(event.target.value)} />
        </span>
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

function PpeItemForm({ id, back }: { id: string | null; back: string }) {
  const router = useRouter();
  const [categories, setCategories] = useState<DefaultPpeCategory[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([platformDefaultsApi.ppeCategories(), id ? platformDefaultsApi.ppeItems() : Promise.resolve([])])
      .then(([cats, items]) => {
        setCategories(cats);
        if (!id) {
          setCategoryId(cats[0]?.id ?? "");
          return;
        }
        const row = items.find((item) => item.id === id);
        if (!row) setError("This record was not found");
        else {
          setCode(row.code);
          setName(row.name);
          setCategoryId(row.categoryId);
          setDescription(row.description ?? "");
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body = { code: code.trim(), name: name.trim(), categoryId, description: description.trim() || undefined };
    try {
      if (id) await platformDefaultsApi.updatePpeItem(id, body);
      else await platformDefaultsApi.createPpeItem(body);
      toast(`${name.trim()} saved`);
      router.push(back);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <form onSubmit={(event) => void save(event)} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      {error ? <div className="sm:col-span-2"><Alert message={error} /></div> : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Code</span>
        <input required pattern={CODE_PATTERN} maxLength={64} className={`${FIELD_CLASS} font-mono`} value={code} onChange={(event) => setCode(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input required pattern={NAME_PATTERN} title={NAME_HINT} maxLength={255} className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Category</span>
        <AppSelect required value={categoryId} className={FIELD_CLASS} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Please select a category..</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </AppSelect>
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
        <textarea rows={3} maxLength={2000} className={TEXTAREA_CLASS} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving || categories.length === 0}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

type HazardDraft = {
  code: string;
  name: string;
  category: string;
  severity: string;
  description: string;
  risks: string[];
  consequences: string[];
  controls: string[];
  permitTypeCodes: string[];
  ppeIds: string[];
};

const EMPTY_HAZARD: HazardDraft = {
  code: "",
  name: "",
  category: "",
  severity: "medium",
  description: "",
  risks: [],
  consequences: [],
  controls: [],
  permitTypeCodes: [],
  ppeIds: [],
};

function HazardForm({ id, back }: { id: string | null; back: string }) {
  const router = useRouter();
  const [form, setForm] = useState<HazardDraft>(EMPTY_HAZARD);
  const [permitTypes, setPermitTypes] = useState<DefaultPermitType[]>([]);
  const [ppe, setPpe] = useState<DefaultPpeItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      platformDefaultsApi.permitTypes(),
      platformDefaultsApi.ppeItems(),
      id ? platformDefaultsApi.hazards() : Promise.resolve([]),
    ])
      .then(([types, items, hazards]) => {
        setPermitTypes(types);
        setPpe(items);
        if (!id) return;
        const row = hazards.find((item) => item.id === id);
        if (!row) {
          setError("This record was not found");
          return;
        }
        setForm({
          code: row.code,
          name: row.name,
          category: row.category,
          severity: row.severity,
          description: row.description ?? "",
          risks: row.risks ?? [],
          consequences: row.consequences ?? [],
          controls: row.controls ?? [],
          permitTypeCodes: row.permitTypeCodes ?? [],
          ppeIds: row.ppeIds ?? [],
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category.trim(),
      severity: form.severity,
      description: form.description.trim() || undefined,
      risks: form.risks.map((item) => item.trim()).filter(Boolean),
      consequences: form.consequences.map((item) => item.trim()).filter(Boolean),
      controls: form.controls.map((item) => item.trim()).filter(Boolean),
      permitTypeCodes: form.permitTypeCodes,
      ppeIds: form.ppeIds,
    };
    try {
      if (id) await platformDefaultsApi.updateHazard(id, body);
      else await platformDefaultsApi.createHazard(body);
      toast(`${form.name.trim()} saved`);
      router.push(back);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <form onSubmit={(event) => void save(event)} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      {error ? <div className="sm:col-span-2"><Alert message={error} /></div> : null}
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input required pattern={NAME_PATTERN} title={NAME_HINT} maxLength={255} className={FIELD_CLASS} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Code</span>
        <input required pattern={CODE_PATTERN} maxLength={64} className={`${FIELD_CLASS} font-mono`} value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Category</span>
        <input required pattern={NAME_PATTERN} title={NAME_HINT} maxLength={255} className={FIELD_CLASS} value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">Risk / severity</span>
        <AppSelect value={form.severity} className={FIELD_CLASS} onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}>
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </AppSelect>
      </label>
      <label className="grid gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
        <textarea rows={3} className={TEXTAREA_CLASS} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
      </label>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="text-sm font-medium">Associated permit types</legend>
        <div className="flex flex-wrap gap-2">
          {permitTypes.map((type) => {
            const checked = form.permitTypeCodes.includes(type.code);
            return (
              <label key={type.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      permitTypeCodes: checked
                        ? prev.permitTypeCodes.filter((code) => code !== type.code)
                        : [...prev.permitTypeCodes, type.code],
                    }))
                  }
                />
                {type.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="text-sm font-medium">Associated PPE</legend>
        <div className="flex flex-wrap gap-2">
          {ppe.map((item) => {
            const checked = form.ppeIds.includes(item.id);
            return (
              <label key={item.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      ppeIds: checked ? prev.ppeIds.filter((ppeId) => ppeId !== item.id) : [...prev.ppeIds, item.id],
                    }))
                  }
                />
                {item.name} <span className="text-muted-foreground">{item.code}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <StringListField label="Risks" values={form.risks} addLabel="Add risk" onChange={(risks) => setForm((prev) => ({ ...prev, risks }))} />
      </div>
      <div className="sm:col-span-2">
        <StringListField label="Potential consequences" values={form.consequences} addLabel="Add consequence" onChange={(consequences) => setForm((prev) => ({ ...prev, consequences }))} />
      </div>
      <div className="sm:col-span-2">
        <StringListField label="Controls" values={form.controls} addLabel="Add control" onChange={(controls) => setForm((prev) => ({ ...prev, controls }))} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
