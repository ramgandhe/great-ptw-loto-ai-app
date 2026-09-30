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
  attachments: (typeof permitAttachments.$inferSelect)[];
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

    if (!permit.departmentId) {
      errors.push('departmentId is required');
    }

    if (!permit.locationId) {
      errors.push('locationId is required');
    }

    if (!permit.workstationId) {
      errors.push('workstation is required');
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
      if (!permit.machineryId) {
        errors.push('machinery is required when LOTOTO is required');
      }
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

    if (permit.gasTestingRequired) {
      if (gasTesting.length === 0) {
        errors.push('at least one gas testing item is required when gas testing is required');
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
