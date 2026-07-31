"use client";

import type { DashboardKind } from "@/lib/dashboards/types";
import { DASHBOARD_KIND_LABELS } from "@/lib/dashboards/labels";
import { Button } from "@/components/ui/button";

const KINDS: DashboardKind[] = ["personal", "supervisor", "safety", "management"];

interface DashboardKindSelectorProps {
  value: DashboardKind;
  onChange: (kind: DashboardKind) => void;
}

export function DashboardKindSelector({ value, onChange }: DashboardKindSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Dashboard view">
      {KINDS.map((kind) => (
        <Button
          key={kind}
          type="button"
          size="sm"
          variant={value === kind ? "default" : "outline"}
          onClick={() => onChange(kind)}
        >
          {DASHBOARD_KIND_LABELS[kind]}
        </Button>
      ))}
    </div>
  );
}
