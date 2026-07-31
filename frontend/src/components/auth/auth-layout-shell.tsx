"use client";

import { FadeIn } from "@/components/motion/fade-in";
import { Icon, ShieldCheck } from "@/components/icons";

export function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <FadeIn className="flex w-full max-w-md flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <Icon icon={ShieldCheck} size="lg" className="text-primary" aria-label="PTW Platform" />
          <p className="text-sm font-medium text-foreground">Permit-to-Work Platform</p>
          <p className="text-xs text-muted-foreground">Enterprise safety operations</p>
        </header>
        <main className="rounded-xl border border-border bg-card p-8 shadow-sm">{children}</main>
      </FadeIn>
    </div>
  );
}
