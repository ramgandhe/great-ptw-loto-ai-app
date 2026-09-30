import { ConflictException, ForbiddenException } from '@nestjs/common';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  PERMIT_CREATE_ROLES,
  PERMIT_EXECUTOR_DRAFT_ROLES,
  PERMIT_SUBMIT_ROLES,
} from './permit.constants';
import type { PermitDetail } from './permit.service';
import type { UpdatePermitDto } from './dto/update-permit.dto';

export const ISSUER_ONLY_FIELDS = [
  'permitTypeId',
  'title',
  'workScope',
  'plantId',
  'departmentId',
  'locationId',
  'plannedStartAt',
  'plannedEndAt',
  'viewers',
] as const satisfies readonly (keyof UpdatePermitDto)[];

export const EXECUTOR_FIELDS = [
  'workstationId',
  'machineryId',
  'hazards',
  'ppe',
  'lototoRequired',
  'lototo',
  'gasTestingRequired',
  'gasTesting',
  'executors',
  'safetyOfficers',
  'currentStep',
  'formSnapshot',
  'formResponses',
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

const LOTOTO_ATTACH_FIELDS = ['lototoRequired', 'lototo'] as const;

function isPrivilegedPermitEditor(user: AuthenticatedUser): boolean {
  return isTenantPrivileged(user.roles) || user.roles.includes('platform-admin');
}

function stripLototoAttach(dto: UpdatePermitDto): UpdatePermitDto {
  const next = { ...dto };
  for (const field of LOTOTO_ATTACH_FIELDS) {
    delete next[field];
  }
  return next;
}

export function sanitizeCreatePermitDto<T extends { lototoRequired?: boolean; lototo?: unknown }>(
  user: AuthenticatedUser,
  dto: T,
): T {
  if (isPrivilegedPermitEditor(user)) {
    return dto;
  }
  return { ...dto, lototoRequired: false, lototo: undefined };
}

export function sanitizeDraftUpdateDto(
  user: AuthenticatedUser,
  dto: UpdatePermitDto,
): UpdatePermitDto {
  if (isPrivilegedPermitEditor(user)) {
    return dto;
  }

  if (hasAnyRole(user, PERMIT_CREATE_ROLES) && !hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES)) {
    return stripLototoAttach(dto);
  }

  if (hasAnyRole(user, PERMIT_CREATE_ROLES)) {
    return dto;
  }

  if (!hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES)) {
    return dto;
  }

  const allowed = new Set<string>(EXECUTOR_FIELDS);
  const sanitized: UpdatePermitDto = {};
  for (const [key, value] of Object.entries(dto)) {
    if (allowed.has(key) && value !== undefined) {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }
  return sanitized;
}

export function assertDraftUpdateAllowed(
  user: AuthenticatedUser,
  detail: PermitDetail,
  dto: UpdatePermitDto,
): void {
  if (isPrivilegedPermitEditor(user)) {
    return;
  }

  if (hasAnyRole(user, PERMIT_CREATE_ROLES) && !hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES)) {
    return;
  }

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

export function assertPeopleReassignAllowed(
  user: AuthenticatedUser,
  detail: PermitDetail,
  changingExecutors: boolean,
): void {
  if (detail.permit.status !== 'approved') {
    throw new ConflictException('People can only be reassigned after approval and before work starts');
  }

  if (isPrivilegedPermitEditor(user) || user.roles.includes('hod')) {
    return;
  }

  if (hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES) && isAssignedExecutor(detail, user.id)) {
    if (changingExecutors) {
      throw new ForbiddenException('Only the HOD can reassign job executors');
    }
    return;
  }

  throw new ForbiddenException('You cannot reassign people on this permit');
}

export function canEditWizardStep(
  user: AuthenticatedUser,
  step: number,
  detail: PermitDetail,
): boolean {
  if (hasAnyRole(user, PERMIT_CREATE_ROLES)) {
    if (isTenantPrivileged(user.roles)) {
      return true;
    }
    return step === 0 || step === 1 || step === 4 || step === 5;
  }

  if (hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES) && isAssignedExecutor(detail, user.id)) {
    return step === 2 || step === 3 || step === 4;
  }

  return false;
}
