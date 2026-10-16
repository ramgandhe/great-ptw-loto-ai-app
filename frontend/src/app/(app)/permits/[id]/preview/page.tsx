"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Check, ClipboardList, FileText, Paperclip, ShieldCheck, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PermitFormResponses } from "@/components/permit/permit-form-responses";
import { permitGaps, identityFromPermit, PermitSummary } from "@/components/permit/permit-summary";
import { PermitStatusBadge } from "@/components/permit/permit-status-badge";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatWindow } from "@/lib/format";
import { permitDetailToForm } from "@/lib/permit/form";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";

export default function PermitPreviewPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPermit(params.id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load permit"));
  }, [params.id]);

  if (error) {
    return (
      <main className="page-in mx-auto flex w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
        <Alert variant="destructive">
          <TriangleAlert aria-hidden />
          <AlertTitle>Permit preview could not be loaded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="page-in mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8" aria-busy="true">
        <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="h-[36rem] animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          <div className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        </div>
        <span className="sr-only">Loading permit preview…</span>
      </main>
    );
  }

  const form = permitDetailToForm(detail);
  const identity = identityFromPermit(detail.permit);
  const gaps = permitGaps(form);
  const isDraft = detail.permit.status === "draft";

  return (
    <main className="page-in mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-8 sm:pt-8">
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            <FileText className="size-4 text-primary" aria-hidden />
            Permit record <span aria-hidden>/</span> Read-only preview
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-muted-foreground">{detail.permit.reference ?? "Draft permit"}</span>
            <PermitStatusBadge status={detail.permit.status} />
          </div>
          <h1 className="mt-2 max-w-4xl font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {detail.permit.title || "Untitled permit"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Review the permit record, controls and supporting evidence.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={`/permits/${detail.permit.id}`}>
            <Button variant="outline"><ArrowLeft aria-hidden /> Permit details</Button>
          </Link>
          {isDraft ? (
            <Link href={`/permits/${detail.permit.id}/edit`}>
              <Button>Edit draft</Button>
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)" aria-label="Permit snapshot">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/35 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold">Permit snapshot</h2>
              </div>
              {identity.version ? <span className="font-mono text-xs text-muted-foreground">Version {identity.version}</span> : null}
            </div>
            <div className="p-4 sm:p-6">
              <PermitSummary
                form={form}
                status={detail.permit.status}
                reference={detail.permit.reference}
                identity={identity}
                attachments={detail.attachments}
                showHeader={false}
              />
            </div>
          </section>

          <PermitFormResponses responses={detail.permit.formResponses ?? []} expanded />

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <Paperclip className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold">Supporting files</h2>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{detail.attachments.length}</span>
            </div>
            {detail.attachments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No attachments are recorded for this permit.</p>
            ) : (
              <ul className="divide-y divide-border">
                {detail.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{attachment.fileName}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">{Math.round(attachment.fileSize / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[4.5rem]">
          <section className="rounded-xl border border-border bg-card p-5 shadow-(--shadow-card)">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Record status</h2>
                <div className="mt-2"><PermitStatusBadge status={detail.permit.status} /></div>
              </div>
            </div>
            <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Permit number</dt>
                <dd className="mt-0.5 font-mono font-medium">{detail.permit.reference ?? "Not issued"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden /> Planned window
                </dt>
                <dd className="mt-0.5 font-medium">{formatWindow(form.plannedStartAt, form.plannedEndAt)}</dd>
              </div>
              {identity.submittedAt ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Submitted</dt>
                  <dd className="mt-0.5 font-medium">{formatDateTime(identity.submittedAt)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-(--shadow-card)">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{isDraft ? "Draft completeness" : "Permit checks"}</h2>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{gaps.length ? `${gaps.length} open` : "Clear"}</span>
            </div>
            {gaps.length === 0 ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-(--status-success)">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                Required permit information is present.
              </p>
            ) : (
              <div className="mt-3">
                <p className="mb-2 flex items-start gap-2 text-sm text-(--status-warning)">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {isDraft ? "Complete these details before submission." : "Some permit details are not recorded."}
                </p>
                <ul className="space-y-1.5 border-l border-border pl-3 text-xs text-muted-foreground">
                  {gaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
