export type ExecutionStartState = {
  toolboxTalk: boolean;
  hazardControls: string[];
  ppeIds: string[];
  lototoVerified: boolean;
  gasReadings: Array<{ gasTestingCatalogueId: string; value: number }>;
};

export function emptyExecutionStart(): ExecutionStartState {
  return {
    toolboxTalk: false,
    hazardControls: [],
    ppeIds: [],
    lototoVerified: false,
    gasReadings: [],
  };
}

export function parseExecutionStart(raw: unknown): ExecutionStartState {
  if (!raw || typeof raw !== "object") {
    return emptyExecutionStart();
  }
  const row = raw as Record<string, unknown>;
  const readings = Array.isArray(row.gasReadings) ? row.gasReadings : [];
  return {
    toolboxTalk: Boolean(row.toolboxTalk),
    hazardControls: Array.isArray(row.hazardControls) ? row.hazardControls.filter((id): id is string => typeof id === "string") : [],
    ppeIds: Array.isArray(row.ppeIds) ? row.ppeIds.filter((id): id is string => typeof id === "string") : [],
    lototoVerified: Boolean(row.lototoVerified),
    gasReadings: readings
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const reading = item as { gasTestingCatalogueId?: unknown; value?: unknown };
        if (typeof reading.gasTestingCatalogueId !== "string") return null;
        const value = Number(reading.value);
        if (Number.isNaN(value)) return null;
        return { gasTestingCatalogueId: reading.gasTestingCatalogueId, value };
      })
      .filter((item): item is { gasTestingCatalogueId: string; value: number } => Boolean(item)),
  };
}

export function hazardControlKey(hazardCategoryId: string, control?: string): string {
  return control ? `hazard:${hazardCategoryId}:${control}` : `hazard:${hazardCategoryId}`;
}
