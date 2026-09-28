import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  permitAttachments,
  permitExecutors,
  permitHazards,
  permitPpe,
  permitLototo,
  permitGasTesting,
  permits,
} from '../../database/schema';

export interface PermitSubmissionRecord {
  permit: typeof permits.$inferSelect;
  hazards: (typeof permitHazards.$inferSelect)[];
  ppe: (typeof permitPpe.$inferSelect)[];
  lototo: (typeof permitLototo.$inferSelect)[];
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

    if (!permit.locationId) {
      errors.push('locationId is required');
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
    }

    if (permit.gasTestingRequired) {
      if (!permit.workstationId) {
        errors.push('workstation is required when gas testing is required');
      }
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
