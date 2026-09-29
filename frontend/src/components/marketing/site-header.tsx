"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth/token-storage";
import { SITE } from "@/lib/marketing/site";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#flow", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#why", label: "Why switch" },
  { href: "/#security", label: "Security" },
];

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight", className)}>
      {/* A signed-off permit (sheet with a tick) and a spark for the AI that checks it. */}
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" className="fill-primary" />
        <path d="M7 5.5h6.5l3.5 3.5v9.5H7z" strokeWidth="1.6" strokeLinejoin="round" className="fill-primary stroke-primary-foreground" />
        <path d="m9.3 13.4 1.9 1.9 3.6-3.9" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground" />
        <path d="M18.6 2.6l.55 1.25 1.25.55-1.25.55-.55 1.25-.55-1.25-1.25-.55 1.25-.55z" className="fill-primary-foreground" />
      </svg>
      <span>
        PermitWise<span className="text-primary">AI</span>
      </span>
    </span>
  );
}

const subscribeNoop = () => () => {};

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const signedIn = useSyncExternalStore(subscribeNoop, isAuthenticated, () => false);

  const account = signedIn ? (
    <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
      Open dashboard
    </Link>
  ) : (
    <>
      <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
        Sign in
      </Link>
      <Link href="/register" className={buttonVariants({ size: "lg" })}>
        Request access
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${SITE.product} home`}>
          <BrandMark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">{account}</div>

        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "md:hidden")}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-border bg-background px-4 pb-5 md:hidden">
          <nav aria-label="Primary" className="flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-3 text-base"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">{account}</div>
        </div>
      ) : null}
    </header>
  );
}
