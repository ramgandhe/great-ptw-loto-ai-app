import Link from "next/link";
import type { KpiItem } from "@/lib/dashboards/types";
import { KPI_LABELS } from "@/lib/dashboards/labels";

interface KpiGridProps {
  items: KpiItem[];
  isLoading?: boolean;
}

function readCount(value: Record<string, unknown>): number | string {
  if (typeof value.count === "number") {
    return value.count;
  }
  return "—";
}

export function KpiGrid({ items, isLoading }: KpiGridProps) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading KPIs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((placeholderIndex) => (
          <div key={placeholderIndex} className="space-y-3 rounded-md border border-border bg-card p-4">
            <div className="h-3 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-9 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No KPI data available.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const meta = KPI_LABELS[item.key] ?? { label: item.key.replace(/_/g, " ") };
        const content = (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {meta.label}
            </p>
            <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-foreground">
              {readCount(item.value)}
            </p>
          </>
        );

        if (meta.href) {
          return (
            <Link
              key={item.key}
              href={meta.href}
              className="rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={item.key} className="rounded-md border border-border bg-card p-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
