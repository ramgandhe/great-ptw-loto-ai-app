"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, ListChecks, X } from "lucide-react";
import { configurationGaps, measureSteps, type SetupStepKey } from "@/lib/organisation/setup";
import { organisationsApi } from "@/lib/organisation/api";
import { ApiError } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import type { Organisation } from "@/lib/organisation/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { ORGANISATION_WRITE_ROLES } from "@/lib/auth/roles";
import { hasAnyRole } from "@/lib/auth/rbac";

/** Organisation hub entry to setup: which required lists are still empty, and which could not be checked. */
export function SetupProgressCard() {
  const [measures, setMeasures] = useState<Partial<Record<SetupStepKey, number>> | null>(null);
  const [org, setOrg] = useState<Organisation | null>(null);
  const [dismissedLocally, setDismissedLocally] = useState<boolean | null>(null);
  const { roles } = useAuthProfile();
  const canManageOrg = hasAnyRole(roles, ORGANISATION_WRITE_ROLES);

  useEffect(() => {
    void measureSteps().then(setMeasures);
    organisationsApi
      .list()
      .then(([first]) => setOrg(first ?? null))
      .catch(() => setOrg(null));
  }, []);

  if (!measures || !org) return null;
  const { missing, unknown } = configurationGaps(measures);
  const ready = missing.length === 0 && unknown.length === 0;

  // Hide only when dismissed is explicitly true (either locally or in org.setupProgress).
  // Do not automatically hide based on ready or completed; keep the completed card visible
  // with a Completed badge until an administrator explicitly dismisses it.
  const isDismissed = dismissedLocally !== null ? dismissedLocally : Boolean(org.setupProgress?.dismissed);

  const handleDismiss = async () => {
    setDismissedLocally(true);
    try {
      await organisationsApi.update(org.id, {
        setupProgress: {
          ...org.setupProgress,
          dismissed: true,
          completed: ready ? true : org.setupProgress?.completed,
        },
      });
    } catch (err) {
      setDismissedLocally(false);
      toast(err instanceof ApiError ? err.message : "Failed to dismiss setup card.", "error");
    }
  };

  const handleReopen = async () => {
    setDismissedLocally(false);
    try {
      await organisationsApi.update(org.id, {
        setupProgress: {
          ...org.setupProgress,
          dismissed: false,
        },
      });
    } catch (err) {
      setDismissedLocally(true);
      toast(err instanceof ApiError ? err.message : "Failed to show setup checklist.", "error");
    }
  };

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-4 text-(--status-success)" aria-hidden />
          <span>Organisation setup is complete.</span>
        </span>
        {canManageOrg ? (
          <button
            type="button"
            onClick={handleReopen}
            className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            <Eye className="size-3.5" aria-hidden />
            Show setup checklist
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="setup-card" className="relative rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          {ready ? <CheckCircle2 className="size-5 text-(--status-success)" aria-hidden /> : <ListChecks className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-card" className="font-semibold">
            {ready
              ? "All required setup complete"
              : missing.length
                ? `Setup: ${missing.length} required ${missing.length === 1 ? "list" : "lists"} still empty`
                : "Setup could not be fully checked"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {missing.length ? `Still empty: ${missing.map((step) => step.title).join(", ")}.` : ""}
            {unknown.length ? ` Could not check: ${unknown.map((step) => step.title).join(", ")}.` : ""}
            {ready ? "All required configurations are in place. You can dismiss this prompt or open setup to review optional items." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ready ? (
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="min-h-11 text-muted-foreground hover:text-foreground">
              Dismiss
            </Button>
          ) : null}
          <Link href="/organisation/setup" className={buttonVariants({ variant: ready ? "outline" : "default", className: "min-h-11" })}>
            {ready ? "Review setup" : "Continue setup"}
            <ArrowRight aria-hidden />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="size-8 text-muted-foreground hover:text-foreground sm:hidden"
            aria-label="Dismiss setup card"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}
