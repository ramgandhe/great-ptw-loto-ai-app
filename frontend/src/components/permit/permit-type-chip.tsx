import type { LucideIcon } from "lucide-react";
import { ArrowUpFromLine, Container, Flame, Shovel, Snowflake, TriangleAlert, Truck, Wrench, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Permit types fall into hazard families. The chip keeps the colour the organisation chose for
 * the type, and the icon says the family, so similar kinds of work are recognisable at a glance.
 */
export const TYPE_FAMILIES: { key: string; label: string; match: RegExp; icon: LucideIcon }[] = [
  { key: "hot", label: "Ignition and energy", match: /hot|weld|burn/i, icon: Flame },
  { key: "electrical", label: "Ignition and energy", match: /electr|energ/i, icon: Zap },
  { key: "hazardous", label: "Ignition and energy", match: /hazard|atex|gas/i, icon: TriangleAlert },
  { key: "confined", label: "Access and atmosphere", match: /confin|vessel|tank entry/i, icon: Container },
  { key: "height", label: "Access and atmosphere", match: /height|scaffold|roof/i, icon: ArrowUpFromLine },
  { key: "excavation", label: "Access and atmosphere", match: /excavat|dig|trench/i, icon: Shovel },
  { key: "lifting", label: "Routine and mechanical", match: /shift|lift|crane|machine/i, icon: Truck },
  { key: "cold", label: "Routine and mechanical", match: /cold/i, icon: Snowflake },
];

export function typeFamily(name: string | undefined) {
  return TYPE_FAMILIES.find((f) => name && f.match.test(name)) ?? { key: "general", label: "Routine and mechanical", icon: Wrench };
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
