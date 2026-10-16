"use client";

import Link from "next/link";
import { ClipboardList, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { BrandMark } from "@/components/marketing/site-header";

const POINTS = [
  { icon: ClipboardList, text: "Permits from request to closure, approved by the right people." },
  { icon: LockKeyhole, text: "Isolations locked, tagged and verified before work starts." },
  { icon: TriangleAlert, text: "Clashing work and incidents surfaced before they hurt anyone." },
];

/**
 * Sign-in and invite pages: the app's own brand, colours and type, so signing in feels like the
 * same product. Wide screens show the brand panel beside the form; phones show the form alone.
 */
export function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <div className="ptw-marketing-shell min-h-dvh bg-background">
        <header className="flex h-16 items-center justify-between border-b border-border px-5 sm:px-8 lg:px-12">
          <Link href="/" aria-label="PermitWiseAI home"><BrandMark /></Link>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Secure workforce access
          </span>
        </header>
        <main className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,0.85fr)_minmax(28rem,1fr)]">
          <section className="flex min-w-0 items-center px-5 py-10 sm:px-10 lg:col-start-2 lg:row-start-1 lg:px-16 xl:px-24">
            <FadeIn className="mx-auto w-full max-w-lg">{children}</FadeIn>
          </section>
          <aside className="relative hidden overflow-hidden bg-sidebar px-10 py-12 text-sidebar-foreground lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-between xl:px-16">
            <div aria-hidden className="pointer-events-none absolute -right-28 -top-24 size-112 rounded-full border border-sidebar-foreground/10" />
            <div aria-hidden className="pointer-events-none absolute -right-10 top-0 size-72 rounded-full border border-sidebar-foreground/10" />
            <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
              PermitWiseAI · Work authorization
            </p>
            <div className="relative max-w-xl">
              <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
                Every job starts with a clear line of responsibility.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-sidebar-foreground/70">
                Plan the work, verify controls, and keep every hand-off visible.
              </p>
              <ol className="mt-10 border-l border-sidebar-foreground/20">
                {["Request the work", "Review hazards and controls", "Authorize people and place", "Close out with a record"].map((step, index) => (
                  <li key={step} className="relative flex min-h-14 items-center gap-4 pl-6">
                    <span className="absolute -left-3.25 grid size-6 place-items-center rounded-full border border-sidebar-foreground/25 bg-sidebar font-mono text-[10px] text-sidebar-primary">
                      0{index + 1}
                    </span>
                    <span className="text-sm text-sidebar-foreground/85">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <p className="relative text-xs text-sidebar-foreground/60">One operational record. From request through close-out.</p>
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="ptw-app grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--accent-primary) 22%, transparent), transparent 60%), radial-gradient(90% 70% at 100% 100%, color-mix(in oklab, var(--accent-primary) 12%, transparent), transparent 60%), var(--card)",
        }}
      >
        <BrandMark className="text-xl" />
        <div className="max-w-md">
          <p className="font-heading text-4xl font-bold leading-tight tracking-tight">
            Safe work, signed off by the people who own it.
          </p>
          <ul className="mt-8 grid gap-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-muted-foreground">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--accent-primary)_14%,transparent)] text-(--accent-primary)">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Permit to work · LOTOTO · SIMOPS · Incidents</p>
      </aside>

      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Link href="/" className="lg:hidden" aria-label="Home">
          <BrandMark />
        </Link>
        <FadeIn className="m-auto flex w-full max-w-sm flex-col py-10">{children}</FadeIn>
      </div>
    </div>
  );
}
