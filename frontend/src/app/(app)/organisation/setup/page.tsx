"use client";

import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, CircleDashed, RefreshCw } from "lucide-react";
import { organisationsApi } from "@/lib/organisation/api";
import type { Organisation, OrgRecord } from "@/lib/organisation/types";
import {
  SETUP_AREAS,
  SETUP_STEPS,
  areaOf,
  configurationGaps,
  measureSteps,
  stepStatus,
  type SetupAreaKey,
  type SetupStep,
  type SetupStepKey,
  type StepStatus,
} from "@/lib/organisation/setup";
import { AdminEmbedContext } from "@/components/layout/admin-page-header";
import { EntityParentContext, type OrganisationEntityResource } from "@/components/organisation/entity-crud-page";
import { Button } from "@/components/ui/button";
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

/** Each list reuses the standalone page for the same records, so data and behaviour stay identical. */
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

type Measures = Partial<Record<SetupStepKey, number>>;

const STATUS_LABEL: Record<StepStatus, string> = {
  complete: "Done",
  partial: "Partly done",
  skipped: "Skipped",
  todo: "Nothing yet",
};

function StatusBadge({ step, measures }: { step: SetupStep; measures: Measures }) {
  const value = measures[step.key];
  if (value === undefined) return <span className="text-xs text-muted-foreground">Could not check</span>;
  const status = stepStatus(step, value, []);
  const detail = step.key === "profile" ? `${Math.round(value * 3)} of 3 details` : value > 0 ? `${value} set up` : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "complete" ? "bg-(--status-success-bg) text-(--status-success)" : "bg-muted text-muted-foreground",
      )}
    >
      {status === "complete" ? <Check className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
      {STATUS_LABEL[status]}
      {detail ? <span className="font-normal">· {detail}</span> : null}
      {step.optional ? <span className="font-normal">· Optional</span> : null}
    </span>
  );
}

function SetupPage() {
  const params = useSearchParams();
  // Old links used ?step=<key>; they open that list's area, scrolled to it.
  const legacyStep = SETUP_STEPS.find((s) => s.key === params.get("step"))?.key;
  const areaKey = (SETUP_AREAS.find((a) => a.key === params.get("area"))?.key ?? (legacyStep ? areaOf(legacyStep) : null)) as SetupAreaKey | null;
  const [org, setOrg] = useState<Organisation | null>(null);
  const [measures, setMeasures] = useState<Measures>({});
  const [loaded, setLoaded] = useState(false);

  const measure = useCallback(async (keys?: SetupStepKey[]) => {
    const fresh = await measureSteps(keys);
    setMeasures((prev) => {
      const next = { ...prev, ...fresh };
      // A failed re-check makes the step unknown again rather than keeping an old count.
      for (const key of keys ?? SETUP_STEPS.map((s) => s.key)) if (!(key in fresh)) delete next[key];
      return next;
    });
    setLoaded(true);
  }, []);

  useEffect(() => {
    organisationsApi
      .list()
      .then(([first]) => setOrg(first ?? null))
      .catch(() => setOrg(null));
    void measureSteps().then((fresh) => {
      setMeasures(fresh);
      setLoaded(true);
    });
  }, []);

  // Remember the area last opened (setupProgress keeps its existing keys; skipped steps are left as stored).
  useEffect(() => {
    if (!areaKey || !org) return;
    const lastStep = legacyStep ?? SETUP_AREAS.find((a) => a.key === areaKey)!.steps[0];
    if (org.setupProgress?.lastStep === lastStep) return;
    void organisationsApi.update(org.id, { setupProgress: { skipped: org.setupProgress?.skipped ?? [], lastStep } }).catch(() => undefined);
  }, [areaKey, legacyStep, org]);

  // The lists above the target load after the first scroll and push it down; scroll again as they settle.
  useEffect(() => {
    const target = legacyStep ?? (window.location.hash.startsWith("#step-") ? window.location.hash.slice(6) : null);
    if (!target) return;
    const timers = [0, 400, 1200].map((ms) =>
      window.setTimeout(() => document.getElementById(`step-${target}`)?.scrollIntoView({ block: "start" }), ms),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [legacyStep, areaKey]);

  return areaKey ? (
    <AreaView areaKey={areaKey} measures={measures} onChanged={(keys) => void measure(keys)} />
  ) : (
    <Overview measures={measures} loaded={loaded} onRetry={(keys) => void measure(keys)} />
  );
}

function Overview({ measures, loaded, onRetry }: { measures: Measures; loaded: boolean; onRetry: (keys: SetupStepKey[]) => void }) {
  const { missing, unknown } = configurationGaps(measures);
  const nextArea = SETUP_AREAS.find((area) => missing.some((step) => area.steps.includes(step.key)));
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-8 sm:gap-6 sm:px-8">
      <PageHeader
        back={{ href: "/organisation", label: "Organisation" }}
        title="Organisation setup"
        description="Five areas, each opened as one page. Start where the checklist points; everything can be changed later."
      />

      <section aria-labelledby="config-checklist" className="rounded-xl border border-border bg-card px-5 py-4">
        <h2 id="config-checklist" className="font-semibold">
          Configuration checklist
        </h2>
        {!loaded ? (
          <p className="mt-1 text-sm text-muted-foreground">Checking what is set up…</p>
        ) : (
          <div className="mt-2 grid gap-3 text-sm">
            {missing.length ? (
              <div>
                <p className="font-medium">Required before permits can be raised and approved:</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {missing.map((step) => (
                    <li key={step.key}>
                      <Link
                        href={`/organisation/setup?area=${areaOf(step.key)}#step-${step.key}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 hover:bg-muted"
                      >
                        <AlertTriangle className="size-3.5 text-(--status-warning)" aria-hidden />
                        {step.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {unknown.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <p>
                  <span className="font-medium">Could not check:</span> {unknown.map((step) => step.title).join(", ")}.
                </p>
                <Button variant="outline" className="min-h-11" onClick={() => onRetry(unknown.map((step) => step.key))}>
                  <RefreshCw aria-hidden />
                  Retry
                </Button>
              </div>
            ) : null}
            {!missing.length && !unknown.length ? (
              <p className="text-(--status-success)">
                The required configuration is in place. Each permit is still checked at submission and approval.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {SETUP_AREAS.map((area) => {
          const steps = SETUP_STEPS.filter((step) => area.steps.includes(step.key));
          const gaps = missing.filter((step) => area.steps.includes(step.key)).length;
          const done = steps.filter((step) => measures[step.key] !== undefined && stepStatus(step, measures[step.key], []) === "complete").length;
          return (
            <li key={area.key}>
              <Link
                href={`/organisation/setup?area=${area.key}`}
                className={cn(
                  "flex h-full flex-col gap-1 rounded-xl border bg-card px-5 py-4 transition-colors hover:border-(--border-strong)",
                  nextArea?.key === area.key ? "border-foreground/60" : "border-border",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{area.title}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </span>
                <span className="text-sm text-muted-foreground">{area.summary}</span>
                {loaded ? (
                  <span className="mt-1 text-sm">
                    {nextArea?.key === area.key ? <strong>Start here. </strong> : null}
                    {done} of {steps.length} {steps.length === 1 ? "list" : "lists"} set up
                    {gaps ? <span className="text-(--status-warning)"> · {gaps} required</span> : null}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

/** The resources whose new records fill in the next level's parent on this page. */
const PARENT_OF: Partial<Record<OrganisationEntityResource, { child: OrganisationEntityResource; field: string }>> = {
  plants: { child: "departments", field: "plantId" },
  departments: { child: "locations", field: "departmentId" },
  locations: { child: "workstations", field: "locationId" },
  workstations: { child: "machinery", field: "workstationId" },
};

function AreaView({ areaKey, measures, onChanged }: { areaKey: SetupAreaKey; measures: Measures; onChanged: (keys: SetupStepKey[]) => void }) {
  const area = SETUP_AREAS.find((a) => a.key === areaKey)!;
  const steps = SETUP_STEPS.filter((step) => area.steps.includes(step.key));
  // A plant just added here becomes the plant of the next department, and so on down to machinery.
  const [defaults, setDefaults] = useState<Partial<Record<OrganisationEntityResource, Record<string, string>>>>({});
  const [version, setVersion] = useState(0);
  const parentContext = {
    defaults,
    version,
    onSaved: (resource: OrganisationEntityResource, record: OrgRecord) => {
      const link = PARENT_OF[resource];
      if (link) setDefaults((prev) => ({ ...prev, [link.child]: { [link.field]: record.id } }));
      setVersion((v) => v + 1);
      onChanged(area.steps);
    },
  };

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-8 sm:gap-6 sm:px-8">
      <PageHeader back={{ href: "/organisation/setup", label: "Setup" }} title={area.title} description={area.summary}>
        {steps.length > 1 ? (
          <nav aria-label={`${area.title} lists`}>
            <ol className="flex gap-2 overflow-x-auto">
              {steps.map((step) => (
                <li key={step.key}>
                  <a
                    href={`#step-${step.key}`}
                    className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-xs font-medium hover:bg-muted"
                  >
                    {step.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </PageHeader>

      <AdminEmbedContext.Provider value={true}>
        <EntityParentContext.Provider value={parentContext}>
          {steps.map((step) => {
            const StepPage = STEP_PAGES[step.key];
            const missingNeeds = (step.needs ?? []).filter(
              (key) => measures[key] !== undefined && stepStatus(SETUP_STEPS.find((s) => s.key === key)!, measures[key], []) !== "complete",
            );
            return (
              <section
                key={step.key}
                id={`step-${step.key}`}
                aria-labelledby={`step-${step.key}-title`}
                style={{ scrollMarginTop: "calc(var(--page-head-h, 0px) + 4.5rem)" }}
                className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card/40 p-4 sm:p-5"
              >
                <header className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id={`step-${step.key}-title`} className="font-heading text-lg font-bold tracking-tight">
                      {step.title}
                    </h2>
                    <StatusBadge step={step} measures={measures} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.summary} {step.why}
                  </p>
                </header>
                {missingNeeds.length ? (
                  <p role="note" className="flex items-center gap-2 rounded-lg bg-(--status-warning-bg) px-3 py-2 text-sm">
                    <AlertTriangle className="size-4 shrink-0 text-(--status-warning)" aria-hidden />
                    Picks from {missingNeeds.map((key) => SETUP_STEPS.find((s) => s.key === key)!.title.toLowerCase()).join(" and ")}, which{" "}
                    {missingNeeds.length > 1 ? "have" : "has"} nothing yet.
                  </p>
                ) : null}
                <StepPage />
              </section>
            );
          })}
        </EntityParentContext.Provider>
      </AdminEmbedContext.Provider>
    </main>
  );
}

export default function OrganisationSetupPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-muted-foreground">Loading setup…</main>}>
      <SetupPage />
    </Suspense>
  );
}
