"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
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
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex rounded-full border border-border bg-card p-1 shadow-xs", className)}>
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
              "press relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0.15 }}
                className="absolute inset-0 rounded-full bg-foreground shadow-[0_4px_14px_-4px_color-mix(in_oklab,var(--foreground)_60%,transparent)]"
              />
            ) : null}
            <span className="relative">{o.label}</span>
            {o.count !== undefined ? <span className="relative tabular-nums opacity-70">{o.count}</span> : null}
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
              "press flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on ? "is-selected border-transparent font-semibold" : "border-border bg-card text-muted-foreground hover:border-(--border-strong) hover:text-foreground",
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
