import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { isTenantPrivileged } from '../../common/constants/tenant-roles';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  PERMIT_CREATE_ROLES,
  PERMIT_EXECUTOR_DRAFT_ROLES,
  PERMIT_SUBMIT_ROLES,
} from './permit.constants';
import type { PermitDetail } from './permit.service';
import type { UpdatePermitDto } from './dto/update-permit.dto';
import { isAssignedSafetyOfficer } from './permit-access';

export const ISSUER_ONLY_FIELDS = [
  'permitTypeId',
  'title',
  'workScope',
  'emergencyPhone',
  'plantId',
  'departmentId',
  'locationId',
  'plannedStartAt',
  'plannedEndAt',
  'viewers',
  'receiverSiteVisited',
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
  'executorSiteVisited',
] as const satisfies readonly (keyof UpdatePermitDto)[];

export const SAFETY_APPROVAL_FIELDS = [
  'safetyApprovalComment',
  'safetyApprovalSignedName',
  'safetyOfficerSiteVisited',
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

/** Same person cannot be receiver and operator, or operator and approver, on one permit. */
export function assertPermitSegregationOfDuties(params: {
  receiverIds: Array<string | null | undefined>;
  executorIds: Array<string | null | undefined>;
  approverIds?: Array<string | null | undefined>;
}): void {
  const receivers = new Set(params.receiverIds.filter((id): id is string => Boolean(id)));
  const executors = new Set(params.executorIds.filter((id): id is string => Boolean(id)));
  const approvers = new Set((params.approverIds ?? []).filter((id): id is string => Boolean(id)));

  for (const id of executors) {
    if (receivers.has(id)) {
      throw new BadRequestException(
        'The permit receiver cannot also be a permit operator on the same permit',
      );
    }
    if (approvers.has(id)) {
      throw new BadRequestException(
        'A permit operator cannot also approve the same permit',
      );
    }
  }
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

function pickFields(dto: UpdatePermitDto, allowed: ReadonlySet<string>): UpdatePermitDto {
  const sanitized: UpdatePermitDto = {};
  for (const [key, value] of Object.entries(dto)) {
    if (allowed.has(key) && value !== undefined) {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }
  return sanitized;
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

  if (hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES)) {
    const allowed = new Set<string>([...EXECUTOR_FIELDS, ...SAFETY_APPROVAL_FIELDS]);
    return pickFields(dto, allowed);
  }

  if (user.roles.includes('safety-officer')) {
    return pickFields(dto, new Set<string>(SAFETY_APPROVAL_FIELDS));
  }

  if (user.roles.includes('permit-approver')) {
    return pickFields(dto, new Set<string>(['safetyOfficers']));
  }

  return dto;
}

export function assertDraftUpdateAllowed(
  user: AuthenticatedUser,
  detail: PermitDetail,
  dto: UpdatePermitDto,
): void {
  if (isPrivilegedPermitEditor(user)) {
    return;
  }

  const signing = SAFETY_APPROVAL_FIELDS.some((field) => dto[field] !== undefined);
  if (signing && !isAssignedSafetyOfficer(detail, user.id)) {
    throw new ForbiddenException('Only an assigned safety officer can complete Safety Approval');
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
    const allowed = new Set<string>([...EXECUTOR_FIELDS, ...SAFETY_APPROVAL_FIELDS]);
    const disallowed = touchedFields.filter((field) => !allowed.has(field));
    if (disallowed.length > 0) {
      throw new ForbiddenException('Executors can only update on-site operational details');
    }

    return;
  }

  if (user.roles.includes('safety-officer') && isAssignedSafetyOfficer(detail, user.id)) {
    const touchedFields = Object.keys(dto) as (keyof UpdatePermitDto)[];
    const allowed = new Set<string>(SAFETY_APPROVAL_FIELDS);
    if (touchedFields.some((field) => !allowed.has(field))) {
      throw new ForbiddenException('Safety officers can only complete Safety Approval on this permit');
    }
    return;
  }

  if (user.roles.includes('permit-approver')) {
    const touchedFields = Object.keys(dto) as (keyof UpdatePermitDto)[];
    if (touchedFields.length === 0 || touchedFields.every((field) => field === 'safetyOfficers')) {
      return;
    }
    throw new ForbiddenException('A permit approver can assign safety officers on this permit');
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

  if (isPrivilegedPermitEditor(user) || user.roles.includes('permit-approver')) {
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
    return step === 0 || step === 1 || step === 4 || step === 6;
  }

  if (hasAnyRole(user, PERMIT_EXECUTOR_DRAFT_ROLES) && isAssignedExecutor(detail, user.id)) {
    return step === 2 || step === 3 || step === 4;
  }

  if (user.roles.includes('safety-officer') && isAssignedSafetyOfficer(detail, user.id)) {
    return step === 5;
  }

  return false;
}
