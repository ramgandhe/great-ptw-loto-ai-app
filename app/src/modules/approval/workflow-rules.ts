import type { WorkflowStepCondition } from '../../database/schema';

export type RiskLevel = 'low' | 'medium' | 'high';

export type PermitWorkflowContext = {
  riskLevel: RiskLevel | null;
  requiresLototo: boolean;
  requiresEnergyIsolation: boolean;
  attributes?: Record<string, string | boolean | number>;
};

const RISK_RANK: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

export function riskMeetsMinimum(
  permitRisk: RiskLevel | null | undefined,
  minRisk: RiskLevel | null | undefined,
): boolean {
  if (!minRisk) {
    return true;
  }
  if (!permitRisk) {
    return false;
  }
  return RISK_RANK[permitRisk] >= RISK_RANK[minRisk];
}

/** FR-PTW-015 / FR-PTW-018 — include step only when conditions + risk threshold match. */
export function shouldIncludeStep(
  step: {
    condition?: WorkflowStepCondition | null;
    minRiskLevel?: string | null;
  },
  context: PermitWorkflowContext,
): boolean {
  if (!riskMeetsMinimum(context.riskLevel, step.minRiskLevel as RiskLevel | null | undefined)) {
    return false;
  }

  const condition = step.condition;
  if (!condition) {
    return true;
  }

  if (condition.requiresLototo === true && !context.requiresLototo) {
    return false;
  }
  if (condition.requiresEnergyIsolation === true && !context.requiresEnergyIsolation) {
    return false;
  }
  if (condition.minRiskLevel && !riskMeetsMinimum(context.riskLevel, condition.minRiskLevel)) {
    return false;
  }
  if (condition.attributeEquals) {
    for (const [key, expected] of Object.entries(condition.attributeEquals)) {
      if (context.attributes?.[key] !== expected) {
        return false;
      }
    }
  }

  return true;
}

/** FR-PTW-028 — reject takes precedence; partial parallel approve is never final. */
export function parallelStageOutcome(decisions: Array<'approve' | 'reject' | 'defer' | null>): {
  rejected: boolean;
  allApproved: boolean;
  anyApprove: boolean;
  complete: boolean;
  pendingCount: number;
} {
  const pendingCount = decisions.filter((d) => d === null).length;
  const rejected = decisions.some((d) => d === 'reject');
  const allApproved =
    decisions.length > 0 && decisions.every((d) => d === 'approve');
  const anyApprove = decisions.some((d) => d === 'approve');
  const complete = pendingCount === 0 || rejected;

  return { rejected, allApproved, anyApprove, complete, pendingCount };
}
