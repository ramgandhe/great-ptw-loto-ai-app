import { Injectable } from '@nestjs/common';
import type {
  SimopsConflictSeverity,
  SimopsConflictType,
} from '../../database/schema/simops';

/** Default hazard-interaction matrix (FR-SIM-014) until master-data config exists. */
const PERMIT_TYPE_INTERACTIONS: Record<string, SimopsConflictSeverity> = {
  'HOT-WORK|CONFINED-SPACE': 'high',
  'CONFINED-SPACE|HOT-WORK': 'high',
  'HOT-WORK|ELECTRICAL': 'high',
  'ELECTRICAL|HOT-WORK': 'high',
  'HOT-WORK|WORKING-AT-HEIGHT': 'medium',
  'WORKING-AT-HEIGHT|HOT-WORK': 'medium',
  'EXCAVATION|ELECTRICAL': 'high',
  'ELECTRICAL|EXCAVATION': 'high',
  'LIFTING|WORKING-AT-HEIGHT': 'medium',
  'WORKING-AT-HEIGHT|LIFTING': 'medium',
};

const SEVERITY_RANK: Record<SimopsConflictSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

@Injectable()
export class RiskCalculationService {
  rank(severity: SimopsConflictSeverity): number {
    return SEVERITY_RANK[severity];
  }

  maxSeverity(...severities: SimopsConflictSeverity[]): SimopsConflictSeverity {
    return severities.reduce((best, current) =>
      this.rank(current) > this.rank(best) ? current : best,
    );
  }

  permitTypeInteractionSeverity(
    codeA: string | null | undefined,
    codeB: string | null | undefined,
  ): SimopsConflictSeverity | null {
    if (!codeA || !codeB || codeA === codeB) {
      return null;
    }
    return PERMIT_TYPE_INTERACTIONS[`${codeA}|${codeB}`] ?? null;
  }

  primaryType(types: SimopsConflictType[]): SimopsConflictType {
    const priority: SimopsConflictType[] = [
      'energy_source',
      'equipment',
      'location',
      'permit_type',
      'schedule',
      'adjacency',
    ];
    for (const candidate of priority) {
      if (types.includes(candidate)) {
        return candidate;
      }
    }
    return types[0] ?? 'schedule';
  }
}
