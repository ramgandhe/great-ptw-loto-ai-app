"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, CircleDashed, Lightbulb, SkipForward } from "lucide-react";
import { organisationsApi } from "@/lib/organisation/api";
import type { Organisation } from "@/lib/organisation/types";
import {
  SETUP_STEPS,
  completionPercent,
  measureSteps,
  stepStatus,
  type SetupStep,
  type SetupStepKey,
  type StepStatus,
} from "@/lib/organisation/setup";
import { AdminEmbedContext } from "@/components/layout/admin-page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import OrganisationProfilePage from "../profile/page";
import PlantsPage from "../plants/page";
import DepartmentsPage from "../departments/page";
import LocationsPage from "../locations/page";
import WorkstationsPage from "../workstations/page";
import MachineryPage from "../machinery/page";
import HazardsPage from "../hazards/page";
import PpePage from "../ppe/page";
import PermitTypesPage from "../permit-types/page";
import ChecklistsPage from "../checklists/page";
import GasTestingConfigPage from "../gas-testing/page";
import TemplatesPage from "../templates/page";
import WorkflowsPage from "../workflows/page";
import NotificationsPage from "../notifications/page";
import UserRolesPage from "../../workforce/roles/page";
import EmployeesPage from "../../workforce/employees/page";
import AgenciesPage from "../../workforce/agencies/page";
import ContractorsPage from "../../workforce/contractors/page";
import CertificationsPage from "../../workforce/certifications/page";

/** Each step reuses the standalone page for the same records, so data and behaviour stay identical. */
const STEP_PAGES: Record<SetupStepKey, React.ComponentType> = {
  profile: OrganisationProfilePage,
  plants: PlantsPage,
  departments: DepartmentsPage,
  locations: LocationsPage,
  workstations: WorkstationsPage,
  machinery: MachineryPage,
  hazards: HazardsPage,
  ppe: PpePage,
  "permit-types": PermitTypesPage,
  checklists: ChecklistsPage,
  "gas-testing": GasTestingConfigPage,
  templates: TemplatesPage,
  workflows: WorkflowsPage,
  users: UserRolesPage,
  employees: EmployeesPage,
  agencies: AgenciesPage,
  contractors: ContractorsPage,
  competencies: CertificationsPage,
  notifications: NotificationsPage,
};

const REVIEW = "review";
type Measures = Partial<Record<SetupStepKey, number>>;

function StatusIcon({ status, className }: { status: StepStatus; className?: string }) {
  const base = cn("flex size-5 shrink-0 items-center justify-center rounded-full", className);
  if (status === "complete") {
    return (
      <span className={cn(base, "bg-(--status-success) text-white")}>
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className={cn(base, "bg-(--status-warning-bg) text-(--status-warning)")}>
        <SkipForward className="size-3" aria-hidden />
      </span>
    );
  }
  if (status === "partial") return <CircleDashed className={cn("size-5 shrink-0 text-(--status-warning)", className)} aria-hidden />;
  return <span className={cn(base, "border-2 border-border")} aria-hidden />;
}

const STATUS_LABEL: Record<StepStatus, string> = {
  complete: "Done",
  partial: "Partly done",
  skipped: "Skipped",
  todo: "Not started",
};

const SEGMENT_CLASS: Record<StepStatus, string> = {
  complete: "bg-(--status-success)",
  partial: "bg-[repeating-linear-gradient(135deg,var(--status-warning)_0_3px,transparent_3px_6px)] bg-(--status-warning-bg)",
  skipped: "bg-(--status-warning)",
  todo: "bg-(--border-strong)",
};

const BADGE_CLASS: Record<StepStatus, string> = {
  complete: "bg-(--status-success-bg) text-(--status-success)",
  partial: "bg-(--status-warning-bg) text-(--status-warning)",
  skipped: "bg-(--status-warning-bg) text-(--status-warning)",
  todo: "bg-muted text-muted-foreground",
};

function measureLabel(step: SetupStep, value: number | undefined): string | null {
  if (value === undefined) return null;
  if (step.key === "profile") return `${Math.round(value * 3)} of 3 details`;
  return value > 0 ? `${value} set up` : null;
}

function SetupWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [org, setOrg] = useState<Organisation | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [measures, setMeasures] = useState<Measures>({});
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const requested = params.get("step");
  const reviewing = requested === REVIEW;
  const index = Math.max(0, SETUP_STEPS.findIndex((s) => s.key === requested));
  const step = SETUP_STEPS[index];
  const StepPage = STEP_PAGES[step.key];

  const measure = useCallback(async (keys?: SetupStepKey[]) => {
    const fresh = await measureSteps(keys);
    setMeasures((prev) => ({ ...prev, ...fresh }));
  }, []);

  useEffect(() => {
    organisationsApi
      .list()
      .then(([first]) => {
        setOrg(first ?? null);
        setSkipped(first?.setupProgress?.skipped ?? []);
        // Resume where the admin left off when the wizard is opened without a step.
        if (!new URLSearchParams(window.location.search).get("step")) {
          router.replace(`/organisation/setup?step=${first?.setupProgress?.lastStep ?? "profile"}`, { scroll: false });
        }
      })
      .catch(() => setOrg(null));
    void measureSteps().then((fresh) => {
      setMeasures(fresh);
      setLoaded(true);
    });
  }, [router]);

  const statuses = useMemo(
    () => Object.fromEntries(SETUP_STEPS.map((s) => [s.key, stepStatus(s, measures[s.key], skipped)])) as Record<SetupStepKey, StepStatus>,
    [measures, skipped],
  );
  const counts = useMemo(() => {
    const values = Object.values(statuses);
    return {
      complete: values.filter((s) => s === "complete").length,
      skipped: values.filter((s) => s === "skipped").length,
      remaining: values.filter((s) => s === "todo" || s === "partial").length,
    };
  }, [statuses]);
  const percent = completionPercent(measures);
  const essentialsLeft = SETUP_STEPS.filter((s) => !s.optional && statuses[s.key] !== "complete");

  async function persist(nextSkipped: string[], lastStep: string) {
    // The profile step may have just created the organisation.
    const target = org ?? (await organisationsApi.list().catch(() => []))[0] ?? null;
    if (!target) return;
    setOrg(target);
    setSaveState("saving");
    try {
      await organisationsApi.update(target.id, { setupProgress: { skipped: nextSkipped, lastStep } });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function goTo(key: string, nextSkipped = skipped) {
    // Re-count the step being left: records may have been added or removed on it.
    if (!reviewing) void measure([step.key]);
    router.push(`/organisation/setup?step=${key}`, { scroll: false });
    window.scrollTo({ top: 0 });
    void persist(nextSkipped, key === REVIEW ? step.key : key);
  }

  function skipStep() {
    const nextSkipped = [...new Set([...skipped, step.key])];
    setSkipped(nextSkipped);
    goTo(SETUP_STEPS[index + 1]?.key ?? REVIEW, nextSkipped);
  }

  async function saveAndExit() {
    await persist(skipped, reviewing ? SETUP_STEPS[0].key : step.key);
    router.push("/organisation");
  }

  const next = SETUP_STEPS[index + 1];
  const missing = loaded ? (step.needs ?? []).filter((key) => statuses[key] !== "complete") : [];
  const currentStatus = statuses[step.key];

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link href="/organisation" className="-ml-1 inline-flex items-center gap-0.5 rounded text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            Organisation
          </Link>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Organisation setup</h1>
          <p className="mt-1 hidden max-w-2xl text-muted-foreground sm:block">
            Everything your site needs before the first permit, in the order it builds up. Skip anything and come back later.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground" role="status">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Progress saved" : saveState === "error" ? "Progress not saved" : ""}
          </span>
          <Button variant="outline" onClick={() => void saveAndExit()}>
            Save and exit
          </Button>
        </div>
      </div>

      <section aria-label="Setup progress" className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold tabular-nums">{loaded ? `${percent}%` : "…"}</span>
            <span className="text-sm text-muted-foreground">of setup information in place</span>
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Steps by status">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-(--status-success)" aria-hidden />
              <strong className="tabular-nums">{counts.complete}</strong> done
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-(--status-warning)" aria-hidden />
              <strong className="tabular-nums">{counts.skipped}</strong> skipped
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-(--border-strong)" aria-hidden />
              <strong className="tabular-nums">{counts.remaining}</strong> to go
            </li>
          </ul>
        </div>
        {/* One segment per step, coloured by status: progress at a glance, and a way to jump to any step. */}
        <ol className="mt-3 flex gap-1" aria-label="Steps">
          {SETUP_STEPS.map((s, i) => {
            const current = !reviewing && s.key === step.key;
            return (
              <li key={s.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => goTo(s.key)}
                  title={`${i + 1}. ${s.title}: ${STATUS_LABEL[statuses[s.key]]}`}
                  aria-label={`Step ${i + 1}, ${s.title}: ${STATUS_LABEL[statuses[s.key]]}`}
                  aria-current={current ? "step" : undefined}
                  className="group block w-full py-1.5 outline-none"
                >
                  <span
                    className={cn(
                      "block h-2 rounded-full transition-opacity group-hover:opacity-80 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
                      SEGMENT_CLASS[statuses[s.key]],
                      current && "outline-2 outline-offset-2 outline-foreground/70",
                      !loaded && "opacity-40",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ol>
        {loaded && essentialsLeft.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            Essential steps left:
            {essentialsLeft.map((s) => (
              <button key={s.key} type="button" onClick={() => goTo(s.key)} className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                {s.title}
              </button>
            ))}
          </p>
        ) : loaded ? (
          <p className="mt-2 text-sm text-(--status-success)">All essential steps are done. Permits can be raised and approved.</p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Setup steps" className="hidden lg:block">
          <ol className="sticky top-4 flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-y-auto pr-1">
            {[...new Set(SETUP_STEPS.map((s) => s.group))].map((group) => (
              <li key={group}>
                <p className="mb-0.5 px-2 text-xs font-medium text-muted-foreground">{group}</p>
                <ol className="flex flex-col">
                  {SETUP_STEPS.filter((s) => s.group === group).map((s) => {
                    const current = !reviewing && s.key === step.key;
                    return (
                      <li key={s.key}>
                        <button
                          type="button"
                          aria-current={current ? "step" : undefined}
                          onClick={() => goTo(s.key)}
                          className={cn(
                            "relative flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted",
                            current && "bg-muted font-medium before:absolute before:inset-y-1 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary",
                          )}
                        >
                          <StatusIcon status={statuses[s.key]} className="size-4" />
                          <span className={cn("min-w-0 flex-1 truncate", statuses[s.key] === "complete" && !current && "text-muted-foreground")}>{s.title}</span>
                          {s.optional ? <span className="shrink-0 text-[11px] text-muted-foreground">Optional</span> : null}
                          <span className="sr-only">, {STATUS_LABEL[statuses[s.key]]}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-current={reviewing ? "step" : undefined}
                onClick={() => goTo(REVIEW)}
                className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted", reviewing && "bg-muted")}
              >
                <Check className="size-4 text-muted-foreground" aria-hidden />
                Review and finish
              </button>
            </li>
          </ol>
        </nav>

        <label className="grid gap-1.5 text-sm lg:hidden">
          <span className="font-medium">Go to step</span>
          <select
            value={reviewing ? REVIEW : step.key}
            onChange={(e) => goTo(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3"
          >
            {SETUP_STEPS.map((s, i) => (
              <option key={s.key} value={s.key}>
                {i + 1}. {s.title} ({STATUS_LABEL[statuses[s.key]]})
              </option>
            ))}
            <option value={REVIEW}>Review and finish</option>
          </select>
        </label>

        {reviewing ? (
          <Review statuses={statuses} measures={measures} percent={percent} onOpen={goTo} />
        ) : (
          <div key={step.key} className="reveal-in flex min-w-0 flex-col gap-5">
            <header>
              <p className="text-sm text-muted-foreground">
                Step {index + 1} of {SETUP_STEPS.length} · {step.group}
                {step.optional ? " · Optional" : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{step.title}</h2>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE_CLASS[currentStatus])}>
                  <StatusIcon status={currentStatus} className="size-3.5" />
                  {STATUS_LABEL[currentStatus]}
                  {measureLabel(step, measures[step.key]) ? <span className="font-normal">· {measureLabel(step, measures[step.key])}</span> : null}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{step.summary}</p>
            </header>

            <details open className="group rounded-xl border border-border border-l-4 border-l-(--status-warning) bg-card text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-medium">
                <Lightbulb className="size-4 text-(--status-warning)" aria-hidden />
                Why this matters
                <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-3">
                <p className="text-muted-foreground">{step.why}</p>
                <ul className="mt-2 grid gap-1 pl-5 [list-style:disc] text-muted-foreground marker:text-(--status-warning)">
                  {step.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </details>

            {missing.length > 0 ? (
              <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border border-(--status-warning)/40 bg-(--status-warning-bg) px-4 py-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-(--status-warning)" aria-hidden />
                <span className="flex-1">
                  This step picks from {missing.map((key) => SETUP_STEPS.find((s) => s.key === key)!.title.toLowerCase()).join(" and ")}, which{" "}
                  {missing.length > 1 ? "have" : "has"} nothing yet.
                </span>
                {missing.map((key) => (
                  <Button key={key} size="sm" variant="outline" onClick={() => goTo(key)}>
                    Set up {SETUP_STEPS.find((s) => s.key === key)!.title.toLowerCase()} first
                  </Button>
                ))}
              </div>
            ) : null}

            <AdminEmbedContext.Provider value={true}>
              <StepPage />
            </AdminEmbedContext.Provider>

            <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
              <Button variant="ghost" disabled={index === 0} onClick={() => goTo(SETUP_STEPS[index - 1].key)} aria-label="Previous step">
                <ArrowLeft aria-hidden />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="flex min-w-0 items-center gap-2">
                {currentStatus !== "complete" ? (
                  <Button variant="ghost" onClick={skipStep}>
                    <SkipForward aria-hidden />
                    Skip<span className="hidden sm:inline"> for now</span>
                  </Button>
                ) : null}
                <Button onClick={() => goTo(next?.key ?? REVIEW)} className="min-w-0">
                  <span className="truncate">
                    {next ? (
                      <>
                        Next<span className="hidden sm:inline">: {next.title}</span>
                      </>
                    ) : (
                      "Review and finish"
                    )}
                  </span>
                  <ArrowRight aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Review({
  statuses,
  measures,
  percent,
  onOpen,
}: {
  statuses: Record<SetupStepKey, StepStatus>;
  measures: Measures;
  percent: number;
  onOpen: (key: string) => void;
}) {
  const sections: { title: string; description: string; filter: (s: StepStatus) => boolean }[] = [
    { title: "Skipped", description: "You chose to come back to these.", filter: (s) => s === "skipped" },
    { title: "Not finished", description: "Nothing, or only part, recorded yet.", filter: (s) => s === "todo" || s === "partial" },
    { title: "Done", description: "Recorded and ready to use on permits.", filter: (s) => s === "complete" },
  ];
  const essentialsLeft = SETUP_STEPS.filter((s) => !s.optional && statuses[s.key] !== "complete");
  return (
    <div className="reveal-in flex min-w-0 flex-col gap-6">
      <header>
        <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
          {percent === 100 ? "Your organisation is fully set up" : `Your organisation is ${percent}% set up`}
        </h2>
        <p className="mt-1 text-muted-foreground">
          {essentialsLeft.length === 0
            ? "All essential steps are done, so people can raise, approve and carry out permits. Optional steps can be added any time."
            : `Finish the essential steps (${essentialsLeft.map((s) => s.title).join(", ")}) so permits can be raised and approved.`}
        </p>
      </header>
      {sections.map((section) => {
        const steps = SETUP_STEPS.filter((s) => section.filter(statuses[s.key]));
        if (steps.length === 0) return null;
        return (
          <section key={section.title}>
            <h3 className="font-semibold">
              {section.title} <span className="font-normal text-muted-foreground">({steps.length})</span>
            </h3>
            <p className="mb-2 text-sm text-muted-foreground">{section.description}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {steps.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(s.key)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-(--border-strong)"
                  >
                    <StatusIcon status={statuses[s.key]} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {s.title}
                        {s.optional ? <span className="font-normal text-muted-foreground"> · Optional</span> : null}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {measureLabel(s, measures[s.key]) ?? s.summary}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <div>
        <Link href="/organisation" className={buttonVariants()}>
          Done for now
        </Link>
      </div>
    </div>
  );
}

export default function OrganisationSetupPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading setup…</main>}>
      <SetupWizard />
    </Suspense>
  );
}
