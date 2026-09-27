"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { accessRequestsApi, SITE_COUNT_OPTIONS, type AccessRequestPayload } from "@/lib/platform/api";

const EMPTY = {
  fullName: "",
  workEmail: "",
  phone: "",
  companyName: "",
  jobTitle: "",
  siteCount: "",
  message: "",
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AccessRequestForm() {
  const [form, setForm] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function update(key: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload: AccessRequestPayload = {
      fullName: form.fullName.trim(),
      workEmail: form.workEmail.trim(),
      companyName: form.companyName.trim(),
      phone: form.phone.trim() || undefined,
      jobTitle: form.jobTitle.trim() || undefined,
      siteCount: (form.siteCount || undefined) as AccessRequestPayload["siteCount"],
      message: form.message.trim() || undefined,
      consent,
    };
    try {
      await accessRequestsApi.submit(payload);
      setSentTo(payload.workEmail);
      setForm(EMPTY);
      setConsent(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "Too Many Requests"
          ? "Too many requests from this network. Wait a minute, then send the form again."
          : err instanceof ApiError
            ? `We couldn't send your request: ${err.message}`
            : "We couldn't reach the server. Check your connection and send the form again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <CircleCheck className="size-7 text-(--status-success)" aria-hidden />
        <h2 className="mt-4 font-heading text-2xl font-bold">Request sent</h2>
        <p className="mt-2 leading-7 text-muted-foreground">
          We will reply to <span className="font-medium text-foreground">{sentTo}</span> to plan your
          setup.
        </p>
        <Button type="button" variant="outline" className="mt-6 h-10 px-4" onClick={() => setSentTo(null)}>
          Send another request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Full name</span>
          <input required minLength={2} autoComplete="name" value={form.fullName} onChange={update("fullName")} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Work email</span>
          <input required type="email" autoComplete="email" value={form.workEmail} onChange={update("workEmail")} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Company</span>
          <input required minLength={2} autoComplete="organization" value={form.companyName} onChange={update("companyName")} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">
            Job title <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input autoComplete="organization-title" value={form.jobTitle} onChange={update("jobTitle")} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input type="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={update("phone")} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">
            Number of sites <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <select value={form.siteCount} onChange={update("siteCount")} className={inputClass}>
            <option value="">Select</option>
            {SITE_COUNT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "1" ? "1 site" : `${opt} sites`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">
          What work do you want to control? <span className="font-normal text-muted-foreground">(optional)</span>
        </span>
        <textarea
          rows={4}
          maxLength={2000}
          value={form.message}
          onChange={update("message")}
          placeholder="For example: hot work and confined-space permits across two plants, with LOTOTO on packaging lines."
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          required
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-(--accent-primary)"
        />
        <span>
          I agree that my details may be used to respond to this request, as described in the{" "}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-4">
            privacy policy
          </Link>
          .
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={saving} className="h-11 px-6 text-base">
          {saving ? "Sending request…" : "Send request"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Already invited?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
