import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  permitAttachments,
  permitExecutors,
  permitHazards,
  permitPpe,
  permitGasTesting,
  permitSafetyOfficers,
  permits,
} from '../../database/schema';
import type { PermitLototoDetail } from './permit.service';

export interface PermitSubmissionRecord {
  permit: typeof permits.$inferSelect;
  hazards: (typeof permitHazards.$inferSelect)[];
  ppe: (typeof permitPpe.$inferSelect)[];
  lototo: PermitLototoDetail[];
  gasTesting: (typeof permitGasTesting.$inferSelect)[];
  executors: (typeof permitExecutors.$inferSelect)[];
  safetyOfficers?: (typeof permitSafetyOfficers.$inferSelect)[];
  attachments: (typeof permitAttachments.$inferSelect)[];
  /** Assets linked to the permit. Falls back to machineryId when omitted. */
  assetIds?: string[];
}

@Injectable()
export class PermitValidationService {
  /** `formErrors`: required answers missing from the permit templates that apply (see permit-forms.ts). */
  validateForSubmit(record: PermitSubmissionRecord, formErrors: string[] = []): void {
    const errors: string[] = [...formErrors];
    const { permit, hazards, ppe, lototo, gasTesting, executors } = record;

    if (!permit.permitTypeId) {
      errors.push('permitTypeId is required');
    }

    if (!permit.title?.trim()) {
      errors.push('title is required');
    }

    if (!permit.siteId) {
      errors.push('site is required');
    }

    if (!permit.workLocationId) {
      errors.push('work location is required');
    }

    if (!permit.plannedStartAt || !permit.plannedEndAt) {
      errors.push('plannedStartAt and plannedEndAt are required');
    } else if (permit.plannedEndAt <= permit.plannedStartAt) {
      errors.push('plannedEndAt must be after plannedStartAt');
    }

    if (executors.length === 0) {
      errors.push('at least one executor is required');
    }

    if (hazards.length === 0) {
      errors.push('at least one hazard is required');
    }

    if (ppe.length === 0) {
      errors.push('at least one PPE item is required');
    }

    if (permit.lototoRequired) {
      if (lototo.length === 0) {
        errors.push('at least one LOTOTO procedure is required when LOTOTO is required');
      }
      for (const instance of lototo) {
        if (instance.crew.length === 0) {
          errors.push('each LOTOTO procedure needs at least one crew member');
        }
        if (instance.verifiers.length === 0) {
          errors.push('each LOTOTO procedure needs at least one verifier');
        }
        if (instance.stepNa.some((row) => !row.reason.trim())) {
          errors.push('N/A isolation steps require a reason');
        }
      }
    }

    const activeGasTests = gasTesting.filter((row) => !row.removedReason?.trim());
    if (gasTesting.some((row) => row.removedReason !== null && row.removedReason !== undefined && !row.removedReason.trim())) {
      errors.push('a removed gas test needs a reason');
    }

    if (permit.gasTestingRequired) {
      if (activeGasTests.length === 0) {
        errors.push('at least one gas testing item is required when gas testing is required');
      }
    }

    if ((record.safetyOfficers ?? []).length > 0) {
      if (!permit.safetyApprovalComment?.trim() || !permit.safetyApprovalSignedName?.trim()) {
        errors.push('Safety Approval comment and typed name are required when a safety officer is assigned');
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Permit validation failed',
        error: 'VALIDATION_ERROR',
        details: errors,
      });
    }
  }
}
