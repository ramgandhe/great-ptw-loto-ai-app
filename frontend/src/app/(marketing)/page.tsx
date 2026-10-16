import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  ClipboardList,
  Clock3,
  Factory,
  FileCheck2,
  Flame,
  FlaskConical,
  HardHat,
  History,
  KeyRound,
  LockKeyhole,
  Pickaxe,
  Plane,
  Radio,
  Server,
  Ship,
  ShieldCheck,
  TrainFront,
  TriangleAlert,
  Users,
  Zap,
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

const FLOW: {
  title: string;
  who: string;
  body: string;
  status: Status;
  state: string;
}[] = [
  {
    title: "Raise the permit",
    who: "Permit receiver and operator",
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

const FEATURE_GROUPS: {
  title: string;
  icon: LucideIcon;
  items: [string, string][];
}[] = [
  {
    title: "Plan the work",
    icon: ClipboardList,
    items: [
      [
        "Permit types",
        "Hot work, confined space, work at height and your own types, each with its own fields and colour.",
      ],
      [
        "SIMOPS",
        "Automatic detection of overlapping work by location, schedule and hazard.",
      ],
      [
        "Gas testing",
        "Readings recorded against the permit before approval and on revalidation.",
      ],
      [
        "Multi-day permits",
        "Daily progress, daily safety revalidation, extensions and validity checks.",
      ],
    ],
  },
  {
    title: "Control hazardous energy",
    icon: LockKeyhole,
    items: [
      [
        "LOTOTO plans",
        "Isolation procedures per workstation and machine, covering every energy source.",
      ],
      [
        "Sequential lockout",
        "Lock, tag and try-out steps enforced in order, each signed by a named person.",
      ],
      ["Evidence capture", "Photos and logs stored with the step they prove."],
      [
        "Restoration",
        "De-isolation verified step by step before equipment returns to service.",
      ],
    ],
  },
  {
    title: "Respond and learn",
    icon: TriangleAlert,
    items: [
      [
        "Incidents and near misses",
        "Reported from the job, linked to the permit, people and machine involved.",
      ],
      [
        "Investigations",
        "Root cause, corrective actions and reminders when actions go overdue.",
      ],
      [
        "Notifications",
        "In-app and email alerts for approvals, rejections, conflicts and expiring permits.",
      ],
      [
        "Dashboards and reports",
        "Views for HODs, safety and management, with PDF, Excel and CSV exports.",
      ],
    ],
  },
  {
    title: "Run the organisation",
    icon: Building2,
    items: [
      [
        "Master data",
        "Departments, locations, workstations and machinery in one catalogue.",
      ],
      [
        "Workforce",
        "Employees, contractors and agencies, with the roles they are allowed to hold.",
      ],
      [
        "Role authority",
        "Issuer, executor, supervisor, safety officer, HOD and administrator, enforced on every action.",
      ],
      ["Subscriptions", "Modules and usage managed per organisation."],
    ],
  },
];

const COMPARISON: [string, string, string][] = [
  [
    "Approvals",
    "Chasing signatures around the plant",
    "Routed to the right Approver and safety officer, with reasons on record",
  ],
  [
    "Overlapping work",
    "Discovered on the shop floor",
    "Flagged by SIMOPS before anyone approves",
  ],
  [
    "Isolation proof",
    "A tick in a register",
    "Each lock, try-out and restoration signed and photographed",
  ],
  [
    "Multi-day jobs",
    "Yesterday's permit reused without re-checks",
    "Revalidated every day before work resumes",
  ],
  [
    "Audits",
    "Days of digging through files",
    "Complete history per permit, person and machine",
  ],
  [
    "Visibility",
    "Phone calls to find out what is live",
    "Live dashboards for every level of the site",
  ],
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

const INDUSTRIES: { name: string; icon: LucideIcon }[] = [
  { name: "Construction & Infrastructure", icon: HardHat },
  { name: "Manufacturing & Industrial Plants", icon: Factory },
  { name: "Shipyards & Marine", icon: Ship },
  { name: "Oil, Gas & Chemical", icon: Flame },
  { name: "Pharmaceuticals & Life Sciences", icon: FlaskConical },
  { name: "Data Centers & Logistics", icon: Server },
  { name: "Facilities Management", icon: Building2 },
  { name: "Energy & Utilities", icon: Zap },
  { name: "Mining & Metals", icon: Pickaxe },
  { name: "Aviation & Airports", icon: Plane },
  { name: "Rail & Transport Infrastructure", icon: TrainFront },
];

const INDUSTRY_SCENES = [
  {
    src: "/industries/field-work.svg",
    alt: "Original illustration of a worker in protective equipment at a controlled construction site",
    title: "Work at the point of risk",
    description:
      "Clearance, controls and field evidence stay connected to the job.",
  },
  {
    src: "/industries/plant-isolation.svg",
    alt: "Original illustration of industrial equipment with a verified lockout point",
    title: "Control hazardous energy",
    description:
      "Isolation steps and verification remain visible before work begins.",
  },
  {
    src: "/industries/operations-room.svg",
    alt: "Original illustration of an operations team reviewing live permit status",
    title: "Keep the whole site aligned",
    description:
      "Teams share one current view of permits, hand-offs and exceptions.",
  },
];

export default function LandingPage() {
  return (
    <div className="ptw-home">
      <section className="home-hero relative isolate overflow-hidden text-white">
        <div
          aria-hidden
          className="home-hero-grid pointer-events-none absolute inset-0 opacity-60"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.85fr)] lg:py-24">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-secondary)">
              <Radio className="size-3.5" aria-hidden />
              Operational control for hazardous work
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-[1.04] tracking-tight text-balance sm:text-5xl lg:text-[3.75rem]">
              Know what is live.
              <span className="mt-1 block text-(--accent-secondary)">
                Know what must happen next.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Plan, authorize, isolate, execute and close every hazardous job in
              one traceable permit workflow. Work starts only when the required
              people and controls are ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className={cn(
                  buttonVariants(),
                  "h-11 rounded-lg px-5 text-sm font-semibold",
                )}
              >
                Request access
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="#flow"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                See the workflow
                <ArrowDownRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-3 border-t border-white/15 pt-5">
              {[
                { icon: FileCheck2, label: "Permit lifecycle" },
                { icon: LockKeyhole, label: "Energy control" },
                { icon: Clock3, label: "Live work status" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col gap-2 pr-3 text-xs text-white/75 sm:flex-row sm:items-center sm:gap-2"
                >
                  <Icon
                    className="size-4 text-(--accent-secondary)"
                    aria-hidden
                  />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl lg:mr-0">
            <div
              aria-hidden
              className="absolute -inset-5 rounded-[2rem] border border-white/10"
            />
            <div className="relative rounded-[1.5rem] border border-white/15 bg-card p-2 text-card-foreground shadow-2xl shadow-black/25">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Permit lifecycle
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">
                    Controls before work
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  Illustrative sample
                </span>
              </div>
              <div className="p-2 sm:p-3">
                <PermitHero />
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xl sm:flex">
              <span className="grid size-9 place-items-center rounded-lg bg-muted text-primary">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block text-xs font-semibold">
                  Every hand-off recorded
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Named owner · time · evidence
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:grid-cols-3 sm:px-8">
          {[
            ["01", "Plan", "Scope, site, crew and work window"],
            ["02", "Control", "Approval, SIMOPS, gas tests and LOTOTO"],
            ["03", "Prove", "Execution evidence and accountable close-out"],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="flex items-start gap-3 border-l-2 border-primary pl-4"
            >
              <span className="font-mono text-xs font-semibold text-primary">
                {number}
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="industries"
        aria-labelledby="industries-heading"
        className="scroll-mt-20 border-t border-border"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Designed for demanding work
              </p>
              <h2
                id="industries-heading"
                className="mt-3 max-w-3xl font-heading text-3xl font-bold tracking-tight sm:text-4xl"
              >
                One safety workflow. Many kinds of site.
              </h2>
            </div>
            <p className="max-w-xl leading-7 text-muted-foreground lg:justify-self-end">
              From live plants to infrastructure projects, coordinate hazardous
              work with clear ownership, verified controls and evidence that
              stays with the permit.
            </p>
          </div>

          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {INDUSTRY_SCENES.map((scene) => (
              <article
                key={scene.title}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <Image
                  src={scene.src}
                  alt={scene.alt}
                  width={800}
                  height={500}
                  unoptimized
                  className="aspect-[16/9] w-full border-b border-border bg-muted object-cover"
                />
                <div className="p-4 sm:p-5">
                  <h3 className="font-heading text-base font-semibold">
                    {scene.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {scene.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {INDUSTRIES.map(({ name, icon: Icon }) => (
              <li
                key={name}
                className="flex min-h-14 items-center gap-3 rounded-lg border border-border/80 bg-background px-3.5 py-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-medium leading-5">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="flow"
        className="home-section-band scroll-mt-20 border-t border-border bg-card"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              One flow, from request to restoration
            </h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">
              Each stage has an owner and a gate. The permit only moves forward
              when the gate is satisfied, and the status your whole site sees
              changes with it.
            </p>
          </div>

          <ol className="relative">
            {FLOW.map((step, i) => (
              <li
                key={step.title}
                className="group relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-10 last:pb-0"
              >
                {i < FLOW.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute left-5 top-11 bottom-1 w-px -translate-x-1/2 bg-border"
                  />
                ) : null}
                <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background font-heading text-sm font-bold transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  {i + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
                    <h3 className="font-heading text-xl font-semibold">
                      {step.title}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        PILL[step.status],
                      )}
                    >
                      {step.state}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    {step.who}
                  </p>
                  <p className="mt-2 max-w-prose leading-7">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="scroll-mt-20 border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <h2 className="max-w-2xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Everything the permit touches, in the same system
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            People, machines, isolations, readings and incidents stay linked to
            the permit they belong to, so nothing has to be reconciled after the
            fact.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {FEATURE_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-border bg-card p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-6"
              >
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <group.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-heading text-lg font-semibold">
                    {group.title}
                  </h3>
                </div>
                <dl className="mt-4 space-y-4">
                  {group.items.map(([name, text]) => (
                    <div
                      key={name}
                      className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4"
                    >
                      <dt className="text-sm font-semibold">{name}</dt>
                      <dd className="text-sm leading-6 text-muted-foreground">
                        {text}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <h2 className="max-w-2xl font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            What changes when the permit book goes digital
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
            Safety comes first by design. The system will not let work begin
            until the mandatory steps are done, and it remembers who did each
            one.
          </p>

          <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-background px-4 sm:px-6">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <caption className="sr-only">
                Paper-based permits compared with {SITE.product}
              </caption>
              <thead>
                <tr className="border-b border-border text-sm">
                  <th
                    scope="col"
                    className="w-40 py-3 pr-6 font-medium text-muted-foreground"
                  />
                  <th
                    scope="col"
                    className="py-3 pr-6 font-medium text-muted-foreground"
                  >
                    Paper and spreadsheets
                  </th>
                  <th scope="col" className="py-3 font-semibold">
                    With {SITE.product}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([topic, before, after]) => (
                  <tr
                    key={topic}
                    className="border-b border-border last:border-0"
                  >
                    <th
                      scope="row"
                      className="py-4 pr-6 align-top text-sm font-semibold"
                    >
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
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
          <div>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Access and evidence you can defend in an audit
            </h2>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">
              A permit is only worth the signatures on it. These are the
              controls behind every one.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-border bg-card p-5"
              >
                <item.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="font-heading text-3xl font-bold tracking-tight">
              Bring your first site online
            </h2>
            <p className="mt-3 leading-7 text-sidebar-foreground/70">
              Tell us about your plant. We will configure your organisation and
              invite your first administrator.
            </p>
          </div>
          <Link
            href="/register"
            className={cn(
              buttonVariants(),
              "h-11 bg-sidebar-primary px-6 text-base text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
            )}
          >
            Request access
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
