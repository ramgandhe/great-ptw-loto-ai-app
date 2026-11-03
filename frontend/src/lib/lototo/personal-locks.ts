import { fetchApi } from "@/lib/api";

export type PersonalLock = {
  id: string;
  workforceUserId: string;
  workerName: string;
  personalLockNumber: string;
  permitId: string | null;
  removedAt: string | null;
};

export type PersonalLockBox = {
  id: string;
  boxNumber: string;
  masterLockSerial: string;
  locationDescription: string | null;
  custodyStatus: string;
};

export type PersonalLocks = {
  personCount: number;
  attachedPermitCount?: number;
  myPermits: Array<{ id: string; reference: string | null; title: string }>;
  lockbox: PersonalLockBox | null;
  locks: PersonalLock[];
};

export function getPersonalLocks(certificateId: string) {
  return fetchApi<PersonalLocks>(`/lototo/certificates/${certificateId}/personal-locks`);
}

export function openLockbox(
  certificateId: string,
  payload: { boxNumber: string; masterLockSerial: string; locationDescription?: string },
) {
  return fetchApi<PersonalLockBox>(`/lototo/certificates/${certificateId}/lockboxes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sealLockbox(lockboxId: string) {
  return fetchApi<PersonalLockBox>(`/lototo/lockboxes/${lockboxId}/seal`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function releaseLockbox(lockboxId: string) {
  return fetchApi<PersonalLockBox>(`/lototo/lockboxes/${lockboxId}/release`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function applyPersonalLock(
  lockboxId: string,
  payload: { personalLockNumber: string; workerName: string; permitId?: string },
) {
  return fetchApi<PersonalLock>(`/lototo/lockboxes/${lockboxId}/crew-locks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removePersonalLock(lockboxId: string, lockId: string) {
  return fetchApi<PersonalLock>(`/lototo/lockboxes/${lockboxId}/crew-locks/${lockId}`, {
    method: "DELETE",
  });
}

export function removeAbsentPersonalLock(
  lockboxId: string,
  lockId: string,
  payload: {
    contactAttempts: string;
    clearOfPlantConfirmed: boolean;
    authoriserOneId: string;
    authoriserTwoId: string;
    reason: string;
  },
) {
  return fetchApi(`/lototo/lockboxes/${lockboxId}/crew-locks/${lockId}/absent-removal`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
