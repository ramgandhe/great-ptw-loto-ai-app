"use client";

import { motion } from "motion/react";
import { staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A titled panel for one question. `insight` states the answer in words so the chart is
 * supporting evidence, and screen-reader users get the same information.
 */
export function ChartCard({
  title,
  insight,
  children,
  className,
  action,
}: {
  title: string;
  insight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.section variants={staggerItem} className={cn("flex flex-col rounded-xl border border-border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {insight ? <p className="mt-0.5 text-sm text-muted-foreground">{insight}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </motion.section>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
