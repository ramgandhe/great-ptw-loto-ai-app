"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

/** Column template shared by the header band and every row: record, context, status, next step. */
const COLUMNS = "lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_11rem_9rem]";

/** The list shape used by Permits, LOTOTO, SIMOPS and Incidents: tinted header band, hover edge, staggered entry. */
export function RecordList({ headers, children }: { headers: [string, string, string, string]; children: React.ReactNode }) {
  return (
    <div className="overflow-clip rounded-xl border border-border bg-card">
      <div aria-hidden className={`table-head hidden gap-4 border-b border-border px-5 py-2.5 text-xs lg:grid ${COLUMNS}`}>
        <span>{headers[0]}</span>
        <span>{headers[1]}</span>
        <span>{headers[2]}</span>
        <span className="text-right">{headers[3]}</span>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

export function RecordRow({
  index,
  href,
  title,
  reference,
  meta,
  context,
  status,
  action,
  accent,
}: {
  index: number;
  href: string;
  title: string;
  reference?: string | null;
  meta?: React.ReactNode;
  context?: React.ReactNode;
  status: React.ReactNode;
  action?: React.ReactNode;
  /** Colour of the left edge, usually the status or priority colour. */
  accent?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 10) * 0.025, ease: [0.23, 1, 0.32, 1] }}
      className={`row-hover relative grid gap-x-4 gap-y-1.5 py-3.5 pl-6 pr-5 lg:items-center ${COLUMNS}`}
    >
      {accent ? <span aria-hidden className="absolute inset-y-3 left-2 w-1 rounded-full" style={{ backgroundColor: accent }} /> : null}
      <div className="min-w-0">
        {/* The whole row opens the record; the action stays independently clickable. */}
        <Link href={href} className="font-semibold after:absolute after:inset-0 hover:underline">
          {title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {reference ? <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono font-semibold text-foreground">{reference}</span> : null}
          {meta}
        </p>
      </div>
      <div className="min-w-0 text-sm text-muted-foreground">{context}</div>
      <div>{status}</div>
      <div className="relative z-10 lg:text-right">{action}</div>
    </motion.li>
  );
}

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      {children ? <div className="mt-4 flex justify-center">{children}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
