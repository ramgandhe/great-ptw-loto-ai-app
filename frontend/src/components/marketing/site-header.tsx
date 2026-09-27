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
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg font-bold", className)}>
      {/* Padlock shackle over a permit sheet: the product in one glyph. */}
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="3" y="9" width="18" height="13" rx="3" className="fill-primary" />
        <path
          d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="stroke-foreground"
        />
        <path d="M8 15h8M8 18.5h5" strokeWidth="1.8" strokeLinecap="round" className="stroke-primary-foreground" />
      </svg>
      {SITE.product}
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
