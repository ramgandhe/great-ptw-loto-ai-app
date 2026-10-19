"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordVisit } from "@/lib/nav-history";
import { AppHeader } from "@/components/layout/app-header";
import { CommandPalette } from "@/components/layout/command-palette";
import { AppNavigation } from "@/components/app-navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toast";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { WorkQueueProvider } from "@/lib/work-queue-context";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/Cmd+K anywhere, or "/" when not typing, opens search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
      } else if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <WorkQueueProvider>
      <div className="ptw-app flex min-h-dvh bg-background text-foreground">
        <AppNavigation
          open={navOpen}
          collapsed={navCollapsed}
          onClose={() => setNavOpen(false)}
          onToggleCollapsed={() => setNavCollapsed((value) => !value)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
          <div className="flex flex-1 flex-col">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </div>
        <ConfirmDialogHost />
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Toaster />
      <Suspense fallback={null}>
        <VisitRecorder />
      </Suspense>
    </WorkQueueProvider>
  );
}

/** Feeds the back-link trail: every page and filter change inside the app. */
function VisitRecorder() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    recordVisit(query ? `${pathname}?${query}` : pathname);
  }, [pathname, query]);
  return null;
}
