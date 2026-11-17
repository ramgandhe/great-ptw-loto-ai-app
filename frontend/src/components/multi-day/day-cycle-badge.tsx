"use client";

import Link from "next/link";
import { StatusChip } from "@/components/ui/status-chip";
import {
  dayCycleColor,
  dayCycleLabel,
  multiDayActionHref,
} from "@/lib/multi-day/day-cycle";

type DayCycleBadgeProps = {
  permitId: string;
  dayCycleState: string;
  /** When true, the badge opens the permit Work tab. */
  linkToAction?: boolean;
  className?: string;
};

export function DayCycleBadge({
  permitId,
  dayCycleState,
  linkToAction = true,
  className,
}: DayCycleBadgeProps) {
  if (!dayCycleState || dayCycleState === "not_multi_day") {
    return null;
  }

  const chip = (
    <StatusChip
      label={dayCycleLabel(dayCycleState)}
      color={dayCycleColor(dayCycleState)}
      className={className}
    />
  );

  if (!linkToAction) {
    return chip;
  }

  return (
    <Link
      href={multiDayActionHref(permitId, dayCycleState)}
      className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={`Open Work: ${dayCycleLabel(dayCycleState)}`}
    >
      {chip}
    </Link>
  );
}
