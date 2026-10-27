"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSelect } from "@/components/ui/select";
import { AdminPage, AdminPageHeader, FIELD_CLASS } from "@/components/layout/admin-page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { NAME_HINT, NAME_PATTERN } from "@/lib/validation";
import { industriesApi, platformTenantsApi, type Industry, type PlatformTenantDetail, type TenantProfile } from "@/lib/platform/api";

type TenantForm = {
  organisationName: string;
  about: string;
  industryId: string;
  addressLine1: string;
  addressLine2: string;
  state: string;
  country: string;
  pin: string;
};

function formOf(tenant: PlatformTenantDetail): TenantForm {
  return {
    organisationName: tenant.name,
    about: tenant.about ?? "",
    industryId: tenant.industryId,
    addressLine1: tenant.addressLine1 ?? "",
    addressLine2: tenant.addressLine2 ?? "",
    state: tenant.addressState ?? "",
    country: tenant.addressCountry ?? "",
    pin: tenant.addressPin ?? "",
  };
}

function profileOf(form: TenantForm): TenantProfile {
  return {
    organisationName: form.organisationName.trim(),
    about: form.about.trim() || undefined,
    industryId: form.industryId,
    addressLine1: form.addressLine1.trim(),
    addressLine2: form.addressLine2.trim() || undefined,
    state: form.state.trim(),
    country: form.country.trim(),
    pin: form.pin.trim(),
  };
}

export default function PlatformTenantEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [form, setForm] = useState<TenantForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([platformTenantsApi.get(id), industriesApi.list()])
      .then(([detail, industryRows]) => {
        if (cancelled) return;
        setTenant(detail);
        setIndustries(industryRows);
        setForm(formOf(detail));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load tenant");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    const profile = profileOf(form);
    try {
      await platformTenantsApi.update(id, profile);
      toast(`${profile.organisationName} updated`);
      router.push(`/platform/tenants/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update tenant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Edit tenant"
        description="Organisation name, industry, and address. The owner email stays the login."
        back={{ href: `/platform/tenants/${id}`, label: tenant?.name ?? "Tenant" }}
      />
      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !tenant || !form ? null : (
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Organisation name</span>
            <input
              required
              autoFocus
              pattern={NAME_PATTERN}
              title={NAME_HINT}
              maxLength={255}
              value={form.organisationName}
              className={FIELD_CLASS}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, organisationName: event.target.value } : prev))}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Owner email</span>
            <input disabled value={tenant.ownerEmail ?? ""} className={FIELD_CLASS} />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">
              About<span className="font-normal text-muted-foreground"> (optional)</span>
            </span>
            <textarea
              maxLength={2000}
              value={form.about}
              className="min-h-24 rounded-lg border border-border bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onChange={(event) => setForm((prev) => (prev ? { ...prev, about: event.target.value } : prev))}
            />
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium">Industry</span>
            <AppSelect
              required
              value={form.industryId}
              className={FIELD_CLASS}
              onChange={(event) => setForm((prev) => (prev ? { ...prev, industryId: event.target.value } : prev))}
            >
              <option value="">Please select an industry..</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </AppSelect>
          </label>
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
            <h3 className="font-medium sm:col-span-2">Address</h3>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Address line 1</span>
              <input
                required
                pattern={NAME_PATTERN}
                title={NAME_HINT}
                maxLength={255}
                value={form.addressLine1}
                className={FIELD_CLASS}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, addressLine1: event.target.value } : prev))}
              />
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">
                Address line 2<span className="font-normal text-muted-foreground"> (optional)</span>
              </span>
              <input
                pattern={NAME_PATTERN}
                title={NAME_HINT}
                maxLength={255}
                value={form.addressLine2}
                className={FIELD_CLASS}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, addressLine2: event.target.value } : prev))}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">State</span>
              <input
                required
                pattern={NAME_PATTERN}
                title={NAME_HINT}
                maxLength={128}
                value={form.state}
                className={FIELD_CLASS}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, state: event.target.value } : prev))}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Country</span>
              <input
                required
                pattern={NAME_PATTERN}
                title={NAME_HINT}
                maxLength={128}
                value={form.country}
                className={FIELD_CLASS}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, country: event.target.value } : prev))}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">PIN</span>
              <input
                required
                maxLength={32}
                value={form.pin}
                className={FIELD_CLASS}
                onChange={(event) => setForm((prev) => (prev ? { ...prev, pin: event.target.value } : prev))}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save tenant"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(`/platform/tenants/${id}`)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </AdminPage>
  );
}
