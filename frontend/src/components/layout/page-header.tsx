"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { NOT_A_BACK_TARGET, pageLabel, usePreviousPage } from "@/lib/nav-history";
import { cn } from "@/lib/utils";

/**
 * The top of every list and insight page. It sticks under the app header, so the title, the
 * way back and the filters stay in view while the content scrolls beneath.
 * Assumes the page's <main> uses the standard px-4 / sm:px-8 gutter.
 */
export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Filters and view controls: they stick with the title. */
  children?: React.ReactNode;
  className?: string;
}) {
  // Publish the header's height so table headings can stick right beneath it.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--page-head-h", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--page-head-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "sticky top-14 z-20 -mx-4 border-b border-transparent bg-background px-4 pb-3 pt-4 backdrop-blur-md sm:-mx-8 sm:px-8",
        "[box-shadow:0_10px_20px_-18px_color-mix(in_oklab,var(--foreground)_40%,transparent)]",
        className,
      )}
    >
      {back ? <BackLink {...back} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            <span
              aria-hidden
              className="h-7 w-1.5 shrink-0 rounded-full bg-linear-to-b from-(--accent-primary) to-[color-mix(in_oklab,var(--accent-primary)_30%,transparent)]"
            />
            {title}
          </h1>
          {description ? <p className="mt-1 max-w-[70ch] pl-[1.125rem] text-sm text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-3 flex flex-col gap-2.5">{children}</div> : null}
    </div>
  );
}

/** The one "back" control: a quiet link above the title, same place and wording on every page. */
/**
 * "← Back to …": returns to the page the user came from inside the app (with its filters),
 * otherwise to the page's parent (`href`). Coloured so it is found at a glance.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const previous = usePreviousPage(pathname);
  const usePrevious = previous !== null && !NOT_A_BACK_TARGET.test(previous.split("?")[0]) && previous.split("?")[0] !== pathname;
  const target = usePrevious ? previous : href;
  const name = usePrevious ? pageLabel(previous) : label;
  return (
    <Link
      href={target}
      className="group mb-1.5 inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2 text-sm font-semibold text-[color-mix(in_oklab,var(--accent-primary)_85%,var(--foreground))] outline-none transition-colors hover:text-(--accent-primary) focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden"
    >
      <span className="grid size-5 place-items-center rounded-full bg-[color-mix(in_oklab,var(--accent-primary)_14%,transparent)] transition-transform duration-150 group-hover:-translate-x-0.5">
        <ArrowLeft className="size-3.5" aria-hidden />
      </span>
      <span>
        <span className="sr-only">Back to </span>
        {name}
      </span>
    </Link>
  );
}

/** Section heading inside a page: a coloured tick and a clear step down from the page title. */
export function SectionTitle({ id, title, description, action }: { id?: string; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight sm:text-lg">
          <span aria-hidden className="size-2 rounded-sm bg-(--accent-primary)" />
          {title}
        </h2>
        {description ? <p className="mt-0.5 pl-4 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
