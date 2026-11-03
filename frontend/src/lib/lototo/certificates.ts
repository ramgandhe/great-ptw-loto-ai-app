import { fetchApi } from "@/lib/api";
import { CERTIFICATE_WRITE_ROLES } from "@/lib/auth/roles";

export { CERTIFICATE_WRITE_ROLES };

export type IsolationPointProof = {
  id: string;
  pointId: string;
  proof: string;
  result: string;
  instrumentMakeModel: string | null;
  instrumentSerialNo: string | null;
  calibrationExpiryDate: string | null;
  readings: Record<string, unknown>;
  comment: string | null;
  verifiedAt: string;
};

export type IsolationInfoPhoto = {
  id: string;
  fileName: string;
  url: string;
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
  drawingReference: string | null;
  positionConfirmed: string | null;
  lockNumber: string | null;
  tagNumber: string | null;
  appliedAt: string | null;
  restoredAt: string | null;
  proofs: IsolationPointProof[];
  infoPhoto?: IsolationInfoPhoto | null;
  evidence?: Array<{
    id: string;
    kind: string;
    proofId: string | null;
    fileName: string;
    url: string;
    uploadedAt: string;
  }>;
};

export type IsolationCertificateSequenceStep = {
  id: string;
  phase: string;
  sequenceOrder: number;
  title: string;
  action: string | null;
  infoText: string | null;
  verification: string | null;
  note: string | null;
  infoPhoto?: IsolationInfoPhoto | null;
};

export type IsolationCertificate = {
  id: string;
  certificateNumber: string;
  title: string;
  status: string;
  description: string | null;
  asset: { name: string; tag?: string | null } | null;
  workLocation: { name: string; pathText?: string | null } | null;
  points: IsolationCertificatePoint[];
  sequenceSteps?: IsolationCertificateSequenceStep[];
  options?: {
    requireEvidencePhoto: boolean;
    requireDistinctProver: boolean;
    requireSecondApprovalBeforeIsolate: boolean;
  };
};

export type IsolationCertificateListRow = {
  certificate: {
    id: string;
    certificateNumber: string;
    title: string;
    status: string;
    procedureId: string | null;
    isLongTerm?: boolean;
    nextAuditDueDate?: string | null;
  };
  assetName: string | null;
  assetTag: string | null;
  locationName: string | null;
  attachedPermitCount?: number;
  underTest?: boolean;
  walkOverdue?: boolean;
};

export type CreateIsolationCertificatePayload = {
  title: string;
  procedureId: string;
  workLocationId?: string;
  assetId?: string;
};

export function certificateStatusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending_approval":
      return "Waiting for approval";
    case "approved":
      return "Ready";
    case "isolation_in_progress":
      return "Isolating";
    case "isolated_verified":
      return "Isolated";
    case "sanction_for_test":
      return "Isolated · test";
    case "restoration_in_progress":
      return "Restoring";
    case "restored_verified":
      return "Restored";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function pointPassed(point: IsolationCertificatePoint) {
  return point.proofs.some((proof) => proof.result === "pass");
}

export type LototoTenantOptions = {
  requireEvidencePhoto: boolean;
  requireDistinctProver: boolean;
  requireSecondApprovalBeforeIsolate: boolean;
};

export function listIsolationCertificates() {
  return fetchApi<IsolationCertificateListRow[]>("/lototo/certificates");
}

export function getLototoOptions() {
  return fetchApi<LototoTenantOptions>("/lototo/certificates/options");
}

export function saveLototoOptions(payload: Partial<LototoTenantOptions>) {
  return fetchApi<LototoTenantOptions>("/lototo/certificates/options", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getIsolationCertificate(id: string) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${id}`);
}

export function createIsolationCertificate(payload: CreateIsolationCertificatePayload) {
  return fetchApi<{ id: string }>("/lototo/certificates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function transitionIsolationCertificate(
  id: string,
  status: string,
  extra?: { secondApproverId?: string; notes?: string },
) {
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

export function uploadCertificateEvidence(
  certificateId: string,
  pointId: string,
  kind: "apply" | "proof" | "restore",
  file: File,
) {
  const formData = new FormData();
  formData.append("file", file);
  return fetchApi<{ id: string; kind: string; fileName: string; url: string }>(
    `/lototo/certificates/${certificateId}/points/${pointId}/evidence?kind=${kind}`,
    { method: "POST", body: formData },
  );
}
