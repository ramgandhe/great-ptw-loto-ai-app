import { hazardFitsPermitType } from "@/lib/master-data/hazard-fit";

export type HazardOrigin = "location" | "asset" | "above" | "below";

type HazardRef = { id: string; permitTypeCodes?: string[] | null; ppeIds?: string[] | null };
type LocationRef = { id: string; parentId: string | null; hazardIds?: string[] | null };
type AssetRef = { id: string; hazardIds?: string[] | null };

const ORIGIN_RANK: Record<HazardOrigin, number> = { location: 4, asset: 3, above: 2, below: 2 };

export function placeHazardPlan(input: {
  hazards: HazardRef[];
  locations: LocationRef[];
  assets: AssetRef[];
  workLocationId: string;
  assetIds: string[];
  permitTypeCode?: string | null;
}): { listedIds: Set<string>; defaultOn: Set<string>; origin: Map<string, HazardOrigin> } {
  const known = new Set(input.hazards.map((hazard) => hazard.id));
  const listedIds = new Set<string>();
  const defaultOn = new Set<string>();
  const origin = new Map<string, HazardOrigin>();

  function note(id: string, kind: HazardOrigin, enable: boolean) {
    if (!known.has(id)) return;
    listedIds.add(id);
    if (enable) defaultOn.add(id);
    const current = origin.get(id);
    if (!current || ORIGIN_RANK[kind] > ORIGIN_RANK[current]) origin.set(id, kind);
  }

  for (const hazard of input.hazards) {
    if (hazardFitsPermitType(hazard.permitTypeCodes, input.permitTypeCode)) listedIds.add(hazard.id);
  }

  const byId = new Map(input.locations.map((row) => [row.id, row]));
  const selected = input.workLocationId ? byId.get(input.workLocationId) : undefined;
  if (selected) {
    let parentId = selected.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      for (const id of parent.hazardIds ?? []) note(id, "above", false);
      parentId = parent.parentId;
    }
    const children = new Map<string, string[]>();
    for (const row of input.locations) {
      if (!row.parentId) continue;
      const list = children.get(row.parentId) ?? [];
      list.push(row.id);
      children.set(row.parentId, list);
    }
    const stack = [...(children.get(selected.id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      const row = byId.get(id);
      if (!row) continue;
      for (const hazardId of row.hazardIds ?? []) note(hazardId, "below", false);
      stack.push(...(children.get(id) ?? []));
    }
    for (const id of selected.hazardIds ?? []) note(id, "location", true);
  }

  const selectedAssets = new Set(input.assetIds);
  for (const asset of input.assets) {
    if (!selectedAssets.has(asset.id)) continue;
    for (const id of asset.hazardIds ?? []) note(id, "asset", true);
  }

  return { listedIds, defaultOn, origin };
}

export function originLabel(origin: HazardOrigin | undefined): string | undefined {
  if (origin === "location") return "From this work location";
  if (origin === "asset") return "From a selected asset";
  if (origin === "above") return "From a location above this one";
  if (origin === "below") return "From a location below this one";
  return undefined;
}

export function linkedPpeIds(hazardIds: Iterable<string>, hazards: HazardRef[]): Set<string> {
  const byId = new Map(hazards.map((hazard) => [hazard.id, hazard]));
  const ids = new Set<string>();
  for (const hazardId of hazardIds) {
    for (const ppeId of byId.get(hazardId)?.ppeIds ?? []) ids.add(ppeId);
  }
  return ids;
}

export function ppeForHazards(input: {
  hazardIds: Iterable<string>;
  hazards: HazardRef[];
  manualOff: Iterable<string>;
  manualOn: Iterable<string>;
  previous: { ppeCatalogueId: string; quantity: number }[];
}): { ppeCatalogueId: string; quantity: number }[] {
  const selected = linkedPpeIds(input.hazardIds, input.hazards);
  for (const id of input.manualOn) selected.add(id);
  for (const id of input.manualOff) selected.delete(id);
  const quantities = new Map(input.previous.map((row) => [row.ppeCatalogueId, row.quantity]));
  return [...selected].map((ppeCatalogueId) => ({
    ppeCatalogueId,
    quantity: quantities.get(ppeCatalogueId) ?? 1,
  }));
}
