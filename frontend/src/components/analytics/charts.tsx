"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { EmptyChart } from "./chart-card";

const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "var(--shadow-md)",
};

const shortDay = (day: string) =>
  new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Series = { key: string; label: string; color: string };

/** Volume over time. Two series at most so the comparison stays readable. */
export function TrendArea({
  data,
  series,
  height = 220,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  height?: number;
}) {
  const reduce = useReducedMotion();
  const total = data.reduce((sum, row) => sum + series.reduce((s, x) => s + Number(row[x.key] ?? 0), 0), 0);
  if (total === 0) return <EmptyChart message="Nothing recorded in this period." />;
  return (
    <div style={{ height }} role="img" aria-label={series.map((s) => `${s.label}: ${data.reduce((n, r) => n + Number(r[s.key] ?? 0), 0)}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => shortDay(String(d))} />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              animationDuration={300}
              isAnimationActive={!reduce}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type BarRow = { key: string; label: string; count: number; color?: string | null; href?: string };

/** Ranked categories as labelled horizontal bars (sorted by the caller), readable at any width. */
export function RankedBars({ rows, emptyMessage, max }: { rows: BarRow[]; emptyMessage: string; max?: number }) {
  const reduce = useReducedMotion();
  if (rows.length === 0 || rows.every((r) => r.count === 0)) return <EmptyChart message={emptyMessage} />;
  const top = max ?? Math.max(...rows.map((r) => r.count));
  return (
    <ul className="grid gap-2.5">
      {rows.map((row, index) => {
        const pct = top > 0 ? Math.max(2, (row.count / top) * 100) : 0;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{row.label}</span>
              <span className="font-semibold tabular-nums">{row.count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full origin-left rounded-full bg-primary"
                style={{ width: `${pct}%`, backgroundColor: row.color ?? undefined }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.25, delay: 0.03 * index, ease: EASE_OUT }}
              />
            </div>
          </>
        );
        return (
          <li key={row.key}>
            {row.href ? (
              <Link href={row.href} className="block rounded-md focus-visible:outline-2 focus-visible:outline-ring hover:opacity-85">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type Segment = { key: string; label: string; count: number; color: string };

/** One bar split into parts, for composition with few categories; the legend carries exact values. */
export function SegmentedBar({ segments, emptyMessage }: { segments: Segment[]; emptyMessage: string }) {
  const reduce = useReducedMotion();
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <EmptyChart message={emptyMessage} />;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}>
        {segments
          .filter((s) => s.count > 0)
          .map((s, i) => (
            <motion.div
              key={s.key}
              className="h-full origin-left first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.25, delay: 0.03 * i, ease: EASE_OUT }}
            />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4 gap-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Part-to-whole with at most five slices, labelled in the legend with counts and shares. */
export function Donut({ segments, emptyMessage, centreLabel }: { segments: Segment[]; emptyMessage: string; centreLabel: string }) {
  const reduce = useReducedMotion();
  const total = segments.reduce((s, x) => s + x.count, 0);
  if (total === 0) return <EmptyChart message={emptyMessage} />;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0" role="img" aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={segments} dataKey="count" nameKey="label" innerRadius="68%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" animationDuration={300} isAnimationActive={!reduce}>
              {segments.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">{centreLabel}</span>
        </div>
      </div>
      <ul className="grid min-w-40 flex-1 gap-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{s.count}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((s.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A figure with its label; tone draws the eye only when the number needs action. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "warning" | "danger" | "good";
  href?: string;
  children?: React.ReactNode;
}) {
  const toneClass = {
    neutral: "border-border bg-card",
    good: "border-border bg-card",
    warning: "border-(--status-warning)/40 bg-(--status-warning-bg)",
    danger: "border-(--status-danger)/40 bg-(--status-danger-bg)",
  }[tone];
  const valueClass = {
    neutral: "text-foreground",
    good: "text-(--status-success)",
    warning: "text-(--status-warning)",
    danger: "text-(--status-danger)",
  }[tone];
  const body = (
    <>
      <p
        className={cn(
          "font-heading font-bold tabular-nums",
          // Words (e.g. "Under an hour") read better a size down from figures.
          typeof value === "string" && value.length > 6 ? "text-2xl" : "text-3xl",
          valueClass,
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={cn("block rounded-xl border px-4 py-3 transition-colors hover:border-(--border-strong)", toneClass)}>
      {body}
    </Link>
  ) : (
    <div className={cn("rounded-xl border px-4 py-3", toneClass)}>{body}</div>
  );
}
