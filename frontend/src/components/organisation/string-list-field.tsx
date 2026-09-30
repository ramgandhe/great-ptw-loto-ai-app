"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_CLASS } from "@/components/layout/admin-page-header";

export function StringListField({
  label,
  values,
  disabled,
  onChange,
  addLabel,
}: {
  label: string;
  values: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  const rows = values.length ? values : [""];
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{label}</p>
      {rows.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input
            className={FIELD_CLASS}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          {disabled ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}
      {disabled ? null : (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, ""])}>
          <Plus className="size-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}
