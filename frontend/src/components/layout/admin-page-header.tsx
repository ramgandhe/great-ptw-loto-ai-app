"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

const HUBS: Record<string, string> = { organisation: "Organisation", workforce: "Workforce" };

/** Shared input styling for admin forms. */
export const FIELD_CLASS =
  "h-10 rounded-lg border border-border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Admin page title row: link back to its hub, title and description, primary action on the right. */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}) {
  const hub = usePathname().split("/")[1] ?? "";
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {HUBS[hub] ? (
          <Link
            href={`/${hub}`}
            className="mb-1 -ml-1 inline-flex items-center gap-0.5 rounded text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {HUBS[hub]}
          </Link>
        ) : null}
        <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
