"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ListChecks } from "lucide-react";
import { configurationGaps, measureSteps, type SetupStepKey } from "@/lib/organisation/setup";
import { buttonVariants } from "@/components/ui/button";

/** Organisation hub entry to setup: which required lists are still empty, and which could not be checked. */
export function SetupProgressCard() {
  const [measures, setMeasures] = useState<Partial<Record<SetupStepKey, number>> | null>(null);

  useEffect(() => {
    void measureSteps().then(setMeasures);
  }, []);

  if (!measures) return null;
  const { missing, unknown } = configurationGaps(measures);
  const ready = missing.length === 0 && unknown.length === 0;

  return (
    <section aria-labelledby="setup-card" className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          <ListChecks className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-card" className="font-semibold">
            {ready ? "Required configuration in place" : missing.length ? `Setup: ${missing.length} required ${missing.length === 1 ? "list" : "lists"} still empty` : "Setup could not be fully checked"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {missing.length ? `Still empty: ${missing.map((step) => step.title).join(", ")}.` : ""}
            {unknown.length ? ` Could not check: ${unknown.map((step) => step.title).join(", ")}.` : ""}
            {ready ? "Review or change anything in setup." : ""}
          </p>
        </div>
        <Link href="/organisation/setup" className={buttonVariants({ variant: ready ? "outline" : "default", className: "min-h-11" })}>
          {ready ? "Open setup" : "Continue setup"}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
