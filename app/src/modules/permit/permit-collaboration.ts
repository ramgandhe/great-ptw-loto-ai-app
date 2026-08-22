import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  PERMIT_CREATE_ROLES,
  PERMIT_EXECUTOR_DRAFT_ROLES,
  PERMIT_SUBMIT_ROLES,
} from './permit.constants';
import type { PermitDetail } from './permit.service';
import type { UpdatePermitDto } from './dto/update-permit.dto';

const ISSUER_ONLY_FIELDS = [
  'permitTypeId',
  'title',
  'workScope',
  'plantId',
  'departmentId',
  'locationId',
  'plannedStartAt',
  'plannedEndAt',
] as const satisfies readonly (keyof UpdatePermitDto)[];

const EXECUTOR_FIELDS = [
  'workstationId',
  'machineryId',
  'hazards',
  'ppe',
  'executors',
  'currentStep',
  'formSnapshot',
] as const satisfies readonly (keyof UpdatePermitDto)[];

function hasAnyRole(user: AuthenticatedUser, roles: readonly string[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function assertPermitCreateAllowed(user: AuthenticatedUser): void {
  if (!hasAnyRole(user, PERMIT_CREATE_ROLES)) {
    throw new ForbiddenException('Only job issuers can create permits');
  }
}

export function assertPermitSubmitAllowed(user: AuthenticatedUser): void {
  if (!hasAnyRole(user, PERMIT_SUBMIT_ROLES)) {
    throw new ForbiddenException('Only job issuers can submit permits for approval');
  }
}

export function isAssignedExecutor(detail: PermitDetail, userId: string): boolean {
  return detail.executors.some((executor) => executor.workforceUserId === userId);
}

export function assertDraftUpdateAllowed(
  user: AuthenticatedUser,
  detail: PermitDetail,
  dto: UpdatePermitDto,
): void {
  if (hasAnyRole(user, PERMIT_CREATE_ROLES)) {
    return;
  }

  if (hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES)) {
    if (!isAssignedExecutor(detail, user.id)) {
      throw new ForbiddenException('You are not assigned as an executor on this permit');
    }

    const touchedIssuerFields = ISSUER_ONLY_FIELDS.filter((field) => dto[field] !== undefined);
    if (touchedIssuerFields.length > 0) {
      throw new ForbiddenException('Executors can only update on-site operational details');
    }

    const touchedFields = Object.keys(dto) as (keyof UpdatePermitDto)[];
    const allowed = new Set<string>(EXECUTOR_FIELDS);
    const disallowed = touchedFields.filter((field) => !allowed.has(field));
    if (disallowed.length > 0) {
      throw new ForbiddenException('Executors can only update on-site operational details');
    }

    return;
  }

  throw new ForbiddenException('Insufficient permissions to update this permit');
}

export function canEditWizardStep(
  user: AuthenticatedUser,
  step: number,
  detail: PermitDetail,
): boolean {
  if (hasAnyRole(user, PERMIT_CREATE_ROLES)) {
    return step === 0 || step === 1 || step === 4;
  }

  if (hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES) && isAssignedExecutor(detail, user.id)) {
    return step === 2 || step === 3;
  }

  return false;
}
