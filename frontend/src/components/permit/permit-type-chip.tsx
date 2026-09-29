import type { LucideIcon } from "lucide-react";
import { ArrowUpFromLine, Container, Flame, Shovel, Snowflake, TriangleAlert, Truck, Wrench, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Permit types fall into hazard families. The chip keeps the colour the organisation chose for
 * the type, and the icon says the family, so similar kinds of work are recognisable at a glance.
 */
export const TYPE_FAMILIES: { key: string; label: string; match: RegExp; icon: LucideIcon; color: string }[] = [
  { key: "hot", label: "Ignition and energy", match: /hot|weld|burn/i, icon: Flame, color: "#DC2626" },
  { key: "electrical", label: "Ignition and energy", match: /electr|energ/i, icon: Zap, color: "#D97706" },
  { key: "hazardous", label: "Ignition and energy", match: /hazard|atex|gas/i, icon: TriangleAlert, color: "#EA580C" },
  { key: "confined", label: "Access and atmosphere", match: /confin|vessel|tank entry/i, icon: Container, color: "#7C3AED" },
  { key: "height", label: "Access and atmosphere", match: /height|scaffold|roof/i, icon: ArrowUpFromLine, color: "#0891B2" },
  { key: "excavation", label: "Access and atmosphere", match: /excavat|dig|trench/i, icon: Shovel, color: "#92400E" },
  { key: "lifting", label: "Routine and mechanical", match: /shift|lift|crane|machine/i, icon: Truck, color: "#4D7C0F" },
  { key: "cold", label: "Routine and mechanical", match: /cold/i, icon: Snowflake, color: "#2563EB" },
];

export function typeFamily(name: string | undefined) {
  return TYPE_FAMILIES.find((f) => name && f.match.test(name)) ?? { key: "general", label: "Routine and mechanical", icon: Wrench, color: "#475569" };
}

export function PermitTypeChip({ name, color, className }: { name?: string; color?: string | null; className?: string }) {
  const family = typeFamily(name);
  const Icon = family.icon;
  return (
    <span
      title={family.label}
      className={cn("chip inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold", className)}
      style={{ "--chip": color || "var(--muted-foreground)" } as React.CSSProperties}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{name ?? "Permit"}</span>
    </span>
  );
}
