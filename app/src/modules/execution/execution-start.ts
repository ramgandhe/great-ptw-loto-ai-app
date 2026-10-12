import { BadRequestException } from '@nestjs/common';

export type ExecutionStartGasReading = {
  gasTestingCatalogueId: string;
  value: number;
};

export type ExecutionStartState = {
  toolboxTalk: boolean;
  hazardControls: string[];
  ppeIds: string[];
  lototoVerified: boolean;
  gasReadings: ExecutionStartGasReading[];
};

export const emptyExecutionStart = (): ExecutionStartState => ({
  toolboxTalk: false,
  hazardControls: [],
  ppeIds: [],
  lototoVerified: false,
  gasReadings: [],
});

export function hazardControlKey(hazardCategoryId: string, control?: string): string {
  return control ? `hazard:${hazardCategoryId}:${control}` : `hazard:${hazardCategoryId}`;
}

export function catalogueLinesForPermit(
  catalogue: string[] | null | undefined,
  omitted: string[] | null | undefined,
): string[] {
  const skip = new Set((omitted ?? []).map((line) => line.trim()).filter(Boolean));
  return (catalogue ?? []).map((line) => line.trim()).filter((line) => line && !skip.has(line));
}

export function requiredHazardControlKeys(
  hazards: Array<{
    hazardCategoryId: string;
    extraControls?: string[] | null;
    omittedControls?: string[] | null;
  }>,
  catalogues: Map<string, { controls?: string[] | null }>,
): string[] {
  const keys: string[] = [];
  for (const hazard of hazards) {
    const cat = catalogues.get(hazard.hazardCategoryId);
    const controls = [
      ...catalogueLinesForPermit(cat?.controls, hazard.omittedControls),
      ...(hazard.extraControls ?? []),
    ]
      .map((line) => line.trim())
      .filter(Boolean);
    if (controls.length === 0) {
      keys.push(hazardControlKey(hazard.hazardCategoryId));
    } else {
      for (const control of controls) {
        keys.push(hazardControlKey(hazard.hazardCategoryId, control));
      }
    }
  }
  return keys;
}

export function assertExecutionStartReady(input: {
  start: ExecutionStartState | null | undefined;
  lototoRequired: boolean;
  gasTestingRequired: boolean;
  lototoIsolated: boolean;
  requiredHazardKeys: string[];
  requiredPpeIds: string[];
  gasItems: Array<{
    gasTestingCatalogueId: string;
    parameter: string;
    minimum: number;
    maximum: number;
    unit: string;
  }>;
}): void {
  const start = input.start ?? emptyExecutionStart();
  if (!start.toolboxTalk) {
    throw new BadRequestException('Toolbox talk must be completed before work can start');
  }

  const ticked = new Set(start.hazardControls);
  if (input.requiredHazardKeys.some((key) => !ticked.has(key))) {
    throw new BadRequestException('Tick every location safety control before work can start');
  }

  const ppe = new Set(start.ppeIds);
  if (input.requiredPpeIds.some((id) => !ppe.has(id))) {
    throw new BadRequestException('Tick every required PPE item before work can start');
  }

  if (input.lototoRequired && !input.lototoIsolated) {
    throw new BadRequestException('Verify LOTOTO isolation before work can start');
  }

  if (input.gasTestingRequired) {
    const readings = new Map(start.gasReadings.map((row) => [row.gasTestingCatalogueId, row.value]));
    for (const item of input.gasItems) {
      const value = readings.get(item.gasTestingCatalogueId);
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new BadRequestException(`Record a ${item.parameter} reading before work can start`);
      }
      if (value < item.minimum || value > item.maximum) {
        throw new BadRequestException(
          `${item.parameter} reading ${value} ${item.unit} is outside ${item.minimum}–${item.maximum} ${item.unit}`,
        );
      }
    }
  }
}
