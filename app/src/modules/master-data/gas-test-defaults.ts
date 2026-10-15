export interface GasLimitSource {
  kind: 'work_location' | 'asset';
  id: string;
  name: string;
}

export interface GasLimitInput {
  parameter: string;
  unit: string;
  minimum: number;
  maximum: number;
  source: GasLimitSource;
  catalogueId?: string;
}

export interface MergedGasLimit {
  parameter: string;
  unit: string;
  minimum: number;
  maximum: number;
  minimumSource: GasLimitSource;
  maximumSource: GasLimitSource;
  catalogueId?: string;
}

/** Strictest bound wins. A higher minimum or a lower maximum replaces that side. */
export function mergeGasLimits(rows: readonly GasLimitInput[]): MergedGasLimit[] {
  const byParameter = new Map<string, MergedGasLimit>();
  for (const row of rows) {
    const key = row.parameter.trim().toLowerCase();
    const existing = byParameter.get(key);
    const tighter = existing != null && (row.minimum > existing.minimum || row.maximum < existing.maximum);
    const catalogueId = !existing
      ? row.catalogueId
      : tighter
        ? row.catalogueId ?? existing.catalogueId
        : existing.catalogueId;
    const merged: MergedGasLimit = {
      parameter: existing?.parameter ?? row.parameter.trim(),
      unit: existing?.unit || row.unit,
      minimum: existing ? Math.max(existing.minimum, row.minimum) : row.minimum,
      maximum: existing ? Math.min(existing.maximum, row.maximum) : row.maximum,
      minimumSource: existing && row.minimum <= existing.minimum ? existing.minimumSource : row.source,
      maximumSource: existing && row.maximum >= existing.maximum ? existing.maximumSource : row.source,
      ...(catalogueId ? { catalogueId } : {}),
    };
    byParameter.set(key, merged);
  }
  return [...byParameter.values()];
}

/** A permit may tighten a configured range. Widening either side is refused. */
export function limitIsLooser(
  requested: { minimum: number; maximum: number },
  baseline: { minimum: number; maximum: number },
): boolean {
  return requested.minimum < baseline.minimum || requested.maximum > baseline.maximum;
}

/** A child location may tighten an inherited limit. It cannot store a wider one. */
export function widerThanAny(
  requested: { minimum: number; maximum: number },
  baselines: ReadonlyArray<{ minimum: number; maximum: number }>,
): boolean {
  return baselines.some((baseline) => limitIsLooser(requested, baseline));
}
