"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  Archive,
  ArrowDown,
  ArrowRight,
  ClipboardList,
  LogIn,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startKeycloakLogin } from "@/lib/auth/keycloak";

const LIFECYCLE_STEPS = [
  {
    number: "01",
    title: "Raise the permit",
    description: "Record scope, work area, crew and planned window.",
    icon: ClipboardList,
  },
  {
    number: "02",
    title: "Clear conflicts",
    description: "Check schedules, locations and hazards through SIMOPS.",
    icon: Activity,
  },
  {
    number: "03",
    title: "Approve",
    description: "HOD and safety reviews before work can start.",
    icon: ShieldCheck,
  },
  {
    number: "04",
    title: "Isolate",
    description: "Verify sequential LOTOTO steps, try-out and evidence.",
    icon: LockKeyhole,
  },
  {
    number: "05",
    title: "Execute",
    description: "Record progress, revalidation, pauses and incidents.",
    icon: Activity,
  },
  {
    number: "06",
    title: "Restore & close",
    description: "Verify restoration, area clearance and final approvals.",
    icon: Archive,
  },
];

const CAPABILITIES = [
  {
    title: "Plan the work",
    description: "Create permits, capture hazards and check SIMOPS conflicts before approval.",
  },
  {
    title: "Control hazardous energy",
    description: "Verify machine-specific LOTOTO isolation and restoration with evidence.",
  },
  {
    title: "Respond and learn",
    description: "Track execution, daily revalidation, near misses, incidents and corrective actions.",
  },
  {
    title: "Run the organisation",
    description: "Manage workforce, master data, role authority, dashboards and reports.",
  },
];

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = searchParams.get("next") ?? "/";

  async function handleLogin(forceLogin = false) {
    setError(null);
    setLoading(true);
    try {
      await startKeycloakLogin(next, { forceLogin });
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Could not start sign in.");
    }
  }

  return (
    <div id="top" className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8"
        >
          <Link href="/login" className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-heading text-sm font-semibold">PTW Platform</span>
              <span className="block font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Safety operations
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => handleLogin(false)}
            disabled={loading}
            aria-busy={loading}
            className={cn(buttonVariants(), "h-10 gap-2 px-4")}
          >
            <LogIn aria-hidden="true" />
            {loading ? "Connecting…" : "Sign in"}
          </button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8 lg:py-20">
          <div className="min-w-0 max-w-2xl">
            <p className="mb-5 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">
              <span aria-hidden="true" className="size-2 rounded-full bg-status-warning" />
              Permit-to-work management
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
              Control hazardous work
              <span className="mt-1 block text-primary">from request to restoration.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Keep approvals, energy isolation, field execution and closeout evidence connected to
              one controlled permit lifecycle.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="#workflow"
                className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-2 px-4")}
              >
                Explore the workflow
                <ArrowDown aria-hidden="true" />
              </Link>
              <span className="text-xs text-muted-foreground">For site teams and approvers</span>
            </div>
            {error ? (
              <p role="alert" className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => handleLogin(true)}
              disabled={loading}
              className="mt-6 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Sign in as a different user
            </button>
          </div>

          <section
            id="workflow"
            aria-labelledby="workflow-title"
            className="min-w-0 scroll-mt-8 rounded-lg border border-border bg-card shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                  One connected process
                </p>
                <h2 id="workflow-title" className="mt-1 font-heading text-xl font-semibold">
                  The permit lifecycle
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="size-4 text-status-success" />
                Traceable by design
              </span>
            </div>
            <ol className="divide-y divide-border px-5 sm:px-7">
              {LIFECYCLE_STEPS.map(({ number, title, description, icon: StepIcon }) => (
                <li key={number} className="flex gap-4 py-4 sm:gap-5 sm:py-5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                    <StepIcon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                    <div>
                      <p className="font-mono text-[10px] font-medium text-muted-foreground">
                        STAGE {number}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold">{title}</h3>
                    </div>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground sm:mt-0 sm:text-right">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border bg-muted/50 px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:px-7">
              <span>Request</span>
              <ArrowRight aria-hidden="true" className="size-3" />
              <span>SIMOPS</span>
              <ArrowRight aria-hidden="true" className="size-3" />
              <span>Approval</span>
              <ArrowRight aria-hidden="true" className="size-3" />
              <span>LOTOTO</span>
              <ArrowRight aria-hidden="true" className="size-3" />
              <span>Execution</span>
              <ArrowRight aria-hidden="true" className="size-3" />
              <span>Restoration</span>
            </div>
          </section>
        </section>

        <section aria-labelledby="capabilities-title" className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
            <div className="mb-7 max-w-2xl">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                Connected safety operations
              </p>
              <h2 id="capabilities-title" className="mt-2 font-heading text-2xl font-semibold">
                Every stage stays connected to the work record.
              </h2>
            </div>
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
              {CAPABILITIES.map((capability) => (
                <article key={capability.title}>
                  <h3 className="text-sm font-semibold">{capability.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {capability.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span>PTW Platform</span>
          <a href="#top" className="rounded-sm underline decoration-border underline-offset-4 hover:text-foreground">
            Back to top
          </a>
        </footer>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginContent />
    </Suspense>
  );
}
