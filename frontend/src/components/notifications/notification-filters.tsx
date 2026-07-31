"use client";

import type { NotificationCategory, NotificationPriority } from "@/lib/notifications/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReadFilter = "all" | "unread" | "read";

export interface NotificationFiltersState {
  readFilter: ReadFilter;
  priority: NotificationPriority | "all";
  category: NotificationCategory | "all";
}

interface NotificationFiltersProps {
  value: NotificationFiltersState;
  onChange: (value: NotificationFiltersState) => void;
}

const READ_OPTIONS: { value: ReadFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const PRIORITY_OPTIONS: { value: NotificationFiltersState["priority"]; label: string }[] = [
  { value: "all", label: "Any priority" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS: { value: NotificationFiltersState["category"]; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "task", label: "Tasks" },
  { value: "reminder", label: "Reminders" },
  { value: "escalation", label: "Escalations" },
  { value: "system", label: "System" },
];

export function NotificationFilters({ value, onChange }: NotificationFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Read status filter">
        {READ_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value.readFilter === option.value ? "default" : "outline"}
            onClick={() => onChange({ ...value, readFilter: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Priority
          <select
            className={cn(
              "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground",
            )}
            value={value.priority}
            onChange={(event) =>
              onChange({
                ...value,
                priority: event.target.value as NotificationFiltersState["priority"],
              })
            }
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Category
          <select
            className={cn(
              "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground",
            )}
            value={value.category}
            onChange={(event) =>
              onChange({
                ...value,
                category: event.target.value as NotificationFiltersState["category"],
              })
            }
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
