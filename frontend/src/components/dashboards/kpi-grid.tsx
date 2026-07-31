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
    return <p className="text-sm text-muted-foreground">Loading KPIs…</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No KPI data available.</p>;
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
            <p className="mt-2 text-3xl font-semibold text-foreground">{readCount(item.value)}</p>
          </>
        );

        if (meta.href) {
          return (
            <Link
              key={item.key}
              href={meta.href}
              className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              {content}
            </Link>
          );
        }

        return (
          <div key={item.key} className="rounded-lg border border-border bg-card p-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
