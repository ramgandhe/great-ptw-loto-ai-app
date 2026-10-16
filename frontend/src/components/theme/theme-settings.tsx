"use client";

import { Check, Moon, Sun } from "lucide-react";
import {
  DENSITIES,
  STYLES,
  THEMES,
  type ThemeName,
  useTheme,
} from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const THEME_LABELS: Record<ThemeName, string> = {
  hazard: "Hazard",
  "control-room": "Control Room",
  setu: "Setu",
  "ledger-slate": "Ledger Slate",
};

const THEME_HINTS: Record<ThemeName, string> = {
  hazard: "Clear, high-contrast operations",
  "control-room": "Cool blue command surfaces",
  setu: "Balanced teal workspace",
  "ledger-slate": "Quiet, information-dense",
};

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "press group flex min-h-10 min-w-28 items-center gap-2 rounded-full border px-3.5 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary/30 bg-primary/8 font-semibold text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-current")}>
                {selected ? <Check className="size-2.5" aria-hidden /> : null}
              </span>
              {option.icon ? <span className="text-muted-foreground">{option.icon}</span> : null}
              <span className="min-w-0">
                <span className="block">{option.label}</span>
                {option.hint ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{option.hint}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type ThemeSettingsProps = {
  variant?: "toolbar" | "form";
  className?: string;
};

export function ThemeSettings({ variant = "toolbar", className }: ThemeSettingsProps) {
  const { theme, density, visualStyle, mode, setTheme, setDensity, setVisualStyle, setMode } =
    useTheme();

  if (variant === "form") {
    return (
      <div className={cn("grid gap-7", className)}>
        <ChoiceGroup
          label="Color theme"
          value={theme}
          onChange={setTheme}
          className="border-b border-border pb-6"
          options={THEMES.map((name) => ({
            value: name,
            label: THEME_LABELS[name],
            hint: THEME_HINTS[name],
          }))}
        />
        <div className="grid gap-7 sm:grid-cols-2">
          <ChoiceGroup
            label="Information density"
            value={density}
            onChange={setDensity}
            options={[
              { value: "normal", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
          <ChoiceGroup
            label="Visual style"
            value={visualStyle}
            onChange={setVisualStyle}
            options={[
              { value: "standard", label: "Standard" },
              { value: "strict", label: "Strict" },
            ]}
          />
          <ChoiceGroup
            label="Color mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "light", label: "Light", icon: <Sun className="size-4" aria-hidden /> },
              { value: "dark", label: "Dark", icon: <Moon className="size-4" aria-hidden /> },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("ml-auto flex flex-wrap items-center gap-4", className)}>
      <ChoiceGroup
        label="Theme"
        value={theme}
        onChange={setTheme}
        options={THEMES.map((name) => ({ value: name, label: THEME_LABELS[name] }))}
      />
      <ChoiceGroup
        label="Density"
        value={density}
        onChange={setDensity}
        options={DENSITIES.map((name) => ({ value: name, label: name === "normal" ? "Normal" : "Compact" }))}
      />
      <ChoiceGroup
        label="Visual style"
        value={visualStyle}
        onChange={setVisualStyle}
        options={STYLES.map((name) => ({ value: name, label: name === "standard" ? "Standard" : "Strict" }))}
      />
      <ChoiceGroup
        label="Color mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: "light", label: "Light", icon: <Sun className="size-4" aria-hidden /> },
          { value: "dark", label: "Dark", icon: <Moon className="size-4" aria-hidden /> },
        ]}
      />
    </div>
  );
}
