import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  History,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PermitHero } from "@/components/marketing/permit-hero";
import { SITE } from "@/lib/marketing/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: `${SITE.product}: permit-to-work and lockout/tagout software`,
  description:
    "Digital permit-to-work, LOTOTO, SIMOPS and incident management for industrial sites. Work cannot start until approvals, gas tests and isolations are verified.",
};

type Status = "draft" | "pending" | "approved" | "active" | "closed";

const PILL: Record<Status, string> = {
  draft: "bg-(--permit-draft-bg) text-(--permit-draft)",
  pending: "bg-(--permit-pending-bg) text-(--permit-pending)",
  approved: "bg-(--permit-approved-bg) text-(--permit-approved)",
  active: "bg-(--permit-active-bg) text-(--permit-active)",
  closed: "bg-(--permit-closed-bg) text-(--permit-closed)",
};

const FLOW: { title: string; who: string; body: string; status: Status; state: string }[] = [
  {
    title: "Raise the permit",
    who: "Job issuer and executor",
    body: "Choose the permit type, location, time window, crew and machinery. The HOD is notified as soon as a draft exists, not when it lands on their desk.",
    status: "draft",
    state: "Draft",
  },
  {
    title: "Clear conflicts",
    who: "Automatic",
    body: "SIMOPS compares location, schedule and hazards against every live and pending permit. A clash goes back to the HOD instead of out to the site.",
    status: "pending",
    state: "Pending approval",
  },
  {
    title: "Approve",
    who: "HOD, then safety officer",
    body: "The HOD reviews risk and priority, the safety officer reviews site conditions and gas readings. Either can send it back or reject it, and the reason is kept.",
    status: "pending",
    state: "Pending approval",
  },
  {
    title: "Isolate",
    who: "Executor, verified by safety",
    body: "A machine-specific LOTOTO plan walks through each energy source in order: lock, tag, try out, photograph. Work stays blocked until every point is verified.",
    status: "approved",
    state: "Approved",
  },
  {
    title: "Do the work",
    who: "Executor and crew",
    body: "Time-stamped progress with photos. Pause, near-miss and accident reports sit on the same screen, and an accident stops the permit automatically. Multi-day jobs are revalidated every morning.",
    status: "active",
    state: "Active",
  },
  {
    title: "Restore and close",
    who: "Executor, issuer, HOD",
    body: "Isolations come off in sequence with evidence, the area is declared clear, and the issuer and HOD sign the permit off. The whole history stays attached.",
    status: "closed",
    state: "Closed",
  },
];

const FEATURE_GROUPS: { title: string; icon: LucideIcon; items: [string, string][] }[] = [
  {
    title: "Plan the work",
    icon: ClipboardList,
    items: [
      ["Permit types", "Hot work, confined space, work at height and your own types, each with its own fields and colour."],
      ["SIMOPS", "Automatic detection of overlapping work by location, schedule and hazard."],
      ["Gas testing", "Readings recorded against the permit before approval and on revalidation."],
      ["Multi-day permits", "Daily progress, daily safety revalidation, extensions and validity checks."],
    ],
  },
  {
    title: "Control hazardous energy",
    icon: LockKeyhole,
    items: [
      ["LOTOTO plans", "Isolation procedures per workstation and machine, covering every energy source."],
      ["Sequential lockout", "Lock, tag and try-out steps enforced in order, each signed by a named person."],
      ["Evidence capture", "Photos and logs stored with the step they prove."],
      ["Restoration", "De-isolation verified step by step before equipment returns to service."],
    ],
  },
  {
    title: "Respond and learn",
    icon: TriangleAlert,
    items: [
      ["Incidents and near misses", "Reported from the job, linked to the permit, people and machine involved."],
      ["Investigations", "Root cause, corrective actions and reminders when actions go overdue."],
      ["Notifications", "In-app and email alerts for approvals, rejections, conflicts and expiring permits."],
      ["Dashboards and reports", "Views for HODs, safety and management, with PDF, Excel and CSV exports."],
    ],
  },
  {
    title: "Run the organisation",
    icon: Building2,
    items: [
      ["Master data", "Departments, locations, workstations and machinery in one catalogue."],
      ["Workforce", "Employees, contractors and agencies, with the roles they are allowed to hold."],
      ["Role authority", "Issuer, executor, supervisor, safety officer, HOD and administrator, enforced on every action."],
      ["Subscriptions", "Modules and usage managed per organisation."],
    ],
  },
];

const COMPARISON: [string, string, string][] = [
  ["Approvals", "Chasing signatures around the plant", "Routed to the right HOD and safety officer, with reasons on record"],
  ["Overlapping work", "Discovered on the shop floor", "Flagged by SIMOPS before anyone approves"],
  ["Isolation proof", "A tick in a register", "Each lock, try-out and restoration signed and photographed"],
  ["Multi-day jobs", "Yesterday's permit reused without re-checks", "Revalidated every day before work resumes"],
  ["Audits", "Days of digging through files", "Complete history per permit, person and machine"],
  ["Visibility", "Phone calls to find out what is live", "Live dashboards for every level of the site"],
];

const SECURITY: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "Single sign-on",
    body: "OpenID Connect sign-in, with a forced password change the first time an invited user logs in.",
    icon: KeyRound,
  },
  {
    title: "Enforced authority",
    body: "Roles are checked on the server for every action, so a screen can never approve what its user may not.",
    icon: Users,
  },
  {
    title: "Tenant isolation",
    body: "Every record is scoped to its organisation. One customer's permits are never visible to another.",
    icon: ShieldCheck,
  },
  {
    title: "Audit trail",
    body: "Who created, approved, rejected, locked or closed what, and when, kept with the permit.",
    icon: History,
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              From permit request to the last lock off, one record for every hazardous job.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              {SITE.product} replaces the permit book, the isolation register and the incident file
              with one workflow. Work cannot start until approvals, gas tests and lockout are
              verified, and every step is signed by a named person.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={cn(buttonVariants(), "h-11 px-5 text-base")}>
                Request access
              </Link>
              <Link href="#flow" className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5 text-base")}>
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Onboarding is by invitation. We set up your organisation and first site with you.
            </p>
          </div>
          <PermitHero />
        </div>
      </section>

      <section id="flow" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:py-28">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              One flow, from request to restoration
            </h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">
              Each stage has an owner and a gate. The permit only moves forward when the gate is
              satisfied, and the status your whole site sees changes with it.
            </p>
          </div>

          <ol className="relative">
            {FLOW.map((step, i) => (
              <li key={step.title} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-10 last:pb-0">
                {i < FLOW.length - 1 ? (
                  <span aria-hidden className="absolute left-5 top-11 bottom-1 w-px -translate-x-1/2 bg-border" />
                ) : null}
                <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background font-heading text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
                    <h3 className="font-heading text-xl font-semibold">{step.title}</h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", PILL[step.status])}>
                      {step.state}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{step.who}</p>
                  <p className="mt-2 max-w-prose leading-7">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 className="max-w-2xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Everything the permit touches, in the same system
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            People, machines, isolations, readings and incidents stay linked to the permit they
            belong to, so nothing has to be reconciled after the fact.
          </p>

          <div className="mt-14 grid gap-x-14 gap-y-14 md:grid-cols-2">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.title} className="border-t-2 border-foreground pt-5">
                <h3 className="flex items-center gap-2.5 font-heading text-lg font-semibold">
                  <group.icon className="size-5 text-primary" aria-hidden />
                  {group.title}
                </h3>
                <dl className="mt-5 space-y-4">
                  {group.items.map(([name, text]) => (
                    <div key={name} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
                      <dt className="text-sm font-semibold">{name}</dt>
                      <dd className="text-sm leading-6 text-muted-foreground">{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 className="max-w-2xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            What changes when the permit book goes digital
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Safety comes first by design. The system will not let work begin until the mandatory
            steps are done, and it remembers who did each one.
          </p>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">Paper-based permits compared with {SITE.product}</caption>
              <thead>
                <tr className="border-b border-border text-sm">
                  <th scope="col" className="w-40 py-3 pr-6 font-medium text-muted-foreground" />
                  <th scope="col" className="py-3 pr-6 font-medium text-muted-foreground">
                    Paper and spreadsheets
                  </th>
                  <th scope="col" className="py-3 font-semibold">
                    With {SITE.product}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([topic, before, after]) => (
                  <tr key={topic} className="border-b border-border last:border-0">
                    <th scope="row" className="py-4 pr-6 align-top text-sm font-semibold">
                      {topic}
                    </th>
                    <td className="py-4 pr-6 align-top text-muted-foreground line-through decoration-muted-foreground/40">
                      {before}
                    </td>
                    <td className="py-4 align-top font-medium">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="security" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:py-28">
          <div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Access and evidence you can defend in an audit
            </h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">
              A permit is only worth the signatures on it. These are the controls behind every one.
            </p>
          </div>
          <ul className="grid gap-8 sm:grid-cols-2">
            {SECURITY.map((item) => (
              <li key={item.title}>
                <item.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight">Bring your first site online</h2>
            <p className="mt-3 leading-7 opacity-80">
              Tell us about your plant. We will configure your organisation and invite your first
              administrator.
            </p>
          </div>
          <Link href="/register" className={cn(buttonVariants(), "h-11 px-6 text-base")}>
            Request access
          </Link>
        </div>
      </section>
    </>
  );
}
