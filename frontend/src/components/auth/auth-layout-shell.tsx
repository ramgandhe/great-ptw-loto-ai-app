"use client";

import Link from "next/link";
import { ClipboardList, LockKeyhole, TriangleAlert } from "lucide-react";
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
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
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
