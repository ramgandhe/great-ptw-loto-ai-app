import { getAccessToken } from "@/lib/auth/token-storage";
import { ApiError, fetchApi, getApiBaseUrl } from "@/lib/api/client";

export type IsolationPointProof = {
  id: string;
  pointId: string;
  proof: string;
  result: string;
  readings: Record<string, unknown>;
  verifiedAt: string;
};

export type IsolationCertificatePoint = {
  id: string;
  sortOrder: number;
  removeOrder: number | null;
  pointCode: string;
  energyType: string;
  energyOtherText: string | null;
  magnitude: string | null;
  locationText: string | null;
  method: string | null;
  normalPosition: string | null;
  isolatedPosition: string | null;
  action: string | null;
  restoreAction: string | null;
  device: string | null;
  proof: string;
  positionConfirmed: string | null;
  lockNumber: string | null;
  tagNumber: string | null;
  appliedAt: string | null;
  restoredAt: string | null;
  proofs: IsolationPointProof[];
  infoPhoto?: { id: string; fileName: string; url: string } | null;
};

export type IsolationCertificate = {
  id: string;
  certificateNumber: string;
  title: string;
  status: string;
  asset: { name: string; tag?: string | null } | null;
  workLocation: { name: string; pathText?: string | null } | null;
  points: IsolationCertificatePoint[];
  sequenceSteps?: Array<{
    id: string;
    phase: string;
    sequenceOrder: number;
    title: string;
    action: string | null;
    infoText: string | null;
    infoPhoto?: { id: string; fileName: string; url: string } | null;
  }>;
  options?: {
    requireEvidencePhoto: boolean;
    requireDistinctProver: boolean;
    requireSecondApprovalBeforeIsolate: boolean;
  };
};

export type PersonalLocks = {
  personCount: number;
  attachedPermitCount?: number;
  myPermits: Array<{ id: string; reference: string | null; title: string }>;
  lockbox: {
    id: string;
    boxNumber: string;
    masterLockSerial: string;
    custodyStatus: string;
  } | null;
  locks: Array<{
    id: string;
    workforceUserId: string;
    workerName: string;
    personalLockNumber: string;
    removedAt: string | null;
  }>;
};

export function pointPassed(point: IsolationCertificatePoint) {
  return point.proofs.some((proof) => proof.result === "pass");
}

export function getIsolationCertificate(id: string) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${id}`);
}

export function transitionIsolationCertificate(id: string, status: string, extra?: { secondApproverId?: string }) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${id}/transition`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...extra }),
  });
}

export function applyCertificatePoint(
  certificateId: string,
  pointId: string,
  payload: { positionConfirmed: string; lockNumber?: string; tagNumber: string },
) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${certificateId}/points/${pointId}/apply`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordCertificateProof(
  certificateId: string,
  pointId: string,
  payload: {
    result: "pass" | "fail";
    readings: Record<string, unknown>;
    instrumentMakeModel?: string;
    instrumentSerialNo?: string;
    calibrationExpiryDate?: string;
    comment?: string;
  },
) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${certificateId}/points/${pointId}/proofs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function restoreCertificatePoint(certificateId: string, pointId: string) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${certificateId}/points/${pointId}/restore`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getPersonalLocks(certificateId: string) {
  return fetchApi<PersonalLocks>(`/lototo/certificates/${certificateId}/personal-locks`);
}

export function applyPersonalLock(
  lockboxId: string,
  payload: { personalLockNumber: string; workerName: string; permitId?: string },
) {
  return fetchApi(`/lototo/lockboxes/${lockboxId}/crew-locks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removePersonalLock(lockboxId: string, lockId: string) {
  return fetchApi(`/lototo/lockboxes/${lockboxId}/crew-locks/${lockId}`, {
    method: "DELETE",
  });
}

export async function uploadCertificateEvidence(
  certificateId: string,
  pointId: string,
  kind: "apply" | "proof" | "restore",
  file: { uri: string; name: string; type: string },
) {
  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);
  const token = await getAccessToken();
  const response = await fetch(
    `${getApiBaseUrl()}/lototo/certificates/${certificateId}/points/${pointId}/evidence?kind=${kind}`,
    {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  const body = await response.json();
  if (!response.ok || body.success === false) {
    throw new ApiError(body.error?.message ?? "Evidence upload failed", body.error?.code, response.status);
  }
  return body.data as { id: string; kind: string; fileName: string; url: string };
}
