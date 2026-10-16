"use client";

import { cn } from "@/lib/utils";

/**
 * One way to pick among options everywhere: periods, tabs, views. The highlight slides to the
 * chosen option so the change is visible, not just the text weight.
 */
export function SegmentedToggle<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex min-w-0 items-center gap-4 overflow-x-auto border-b border-border", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "press relative -mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-primary font-semibold text-foreground" : "border-transparent font-medium text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <span>{o.label}</span>
            {o.count !== undefined ? (
              <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type MultiOption = { value: string; label: string; count?: number; color?: string };

/**
 * Filters you can combine. Each chip toggles on its own; chosen chips glow in their own colour.
 * An empty selection means "everything".
 */
export function MultiToggle({
  options,
  selected,
  onChange,
  label,
  className,
}: {
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  label: string;
  className?: string;
}) {
  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            style={o.color ? ({ "--glow": o.color } as React.CSSProperties) : undefined}
            className={cn(
              "press flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "border-primary/25 bg-primary/10 font-semibold text-primary" : "border-transparent bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.color ? <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: o.color }} /> : null}
            {o.label}
            {o.count !== undefined ? <span className="tabular-nums opacity-70">{o.count}</span> : null}
          </button>
        );
      })}
      {selected.length > 0 ? (
        <button type="button" onClick={() => onChange([])} className="px-2 py-1 text-sm font-medium text-primary hover:underline">
          Clear
        </button>
      ) : null}
    </div>
  );
}
