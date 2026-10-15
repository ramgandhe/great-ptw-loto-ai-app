"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api";
import { ENERGY_SOURCE_OPTIONS } from "./form-options";

export type EnergySourceOption = { value: string; label: string };

const FALLBACK: EnergySourceOption[] = ENERGY_SOURCE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/** A tenant created with a copied list uses that list. Older tenants keep the fixed list. */
export function useEnergySourceOptions(): EnergySourceOption[] {
  const [options, setOptions] = useState<EnergySourceOption[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetchApi<{ code: string; name: string }[]>("/lototo/energy-sources")
      .then((rows) => {
        if (cancelled || rows.length === 0) return;
        setOptions(rows.map((row) => ({ value: row.code, label: row.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}

export function energySourceChoices(options: EnergySourceOption[], current?: string): EnergySourceOption[] {
  const visible = options.filter((option) => option.value !== "gravitational" || current === "gravitational");
  if (current && !visible.some((option) => option.value === current)) {
    return [...visible, { value: current, label: current }];
  }
  return visible;
}
