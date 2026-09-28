"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ListChecks } from "lucide-react";
import { organisationsApi } from "@/lib/organisation/api";
import { SETUP_STEPS, completionPercent, measureSteps, stepStatus, type SetupStepKey } from "@/lib/organisation/setup";
import { buttonVariants } from "@/components/ui/button";

/** Organisation hub entry to the setup wizard: how far setup has got and what is left. */
export function SetupProgressCard() {
  const [measures, setMeasures] = useState<Partial<Record<SetupStepKey, number>> | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    void measureSteps().then(setMeasures);
    organisationsApi
      .list()
      .then(([org]) => setSkipped(org?.setupProgress?.skipped ?? []))
      .catch(() => setSkipped([]));
  }, []);

  if (!measures) return null;
  const percent = completionPercent(measures);
  const statuses = SETUP_STEPS.map((step) => stepStatus(step, measures[step.key], skipped));
  const done = statuses.filter((s) => s === "complete").length;
  const skippedCount = statuses.filter((s) => s === "skipped").length;
  const nextStep = SETUP_STEPS.find((step, i) => !step.optional && statuses[i] !== "complete");

  return (
    <section aria-labelledby="setup-card" className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          <ListChecks className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-card" className="font-semibold">
            {percent === 100 ? "Organisation setup complete" : `Organisation setup: ${percent}% done`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {done} of {SETUP_STEPS.length} steps done
            {skippedCount ? `, ${skippedCount} skipped` : ""}
            {nextStep ? `. Next essential step: ${nextStep.title}.` : ". Review or change anything in the setup wizard."}
          </p>
        </div>
        <Link href="/organisation/setup" className={buttonVariants({ variant: percent === 100 ? "outline" : "default" })}>
          {percent === 0 ? "Start setup" : percent === 100 ? "Open setup" : "Continue setup"}
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Organisation setup completion"
      >
        <div className="h-full origin-left bg-(--status-success)" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </section>
  );
}
