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
};

export type IsolationCertificateListRow = {
  certificate: {
    id: string;
    certificateNumber: string;
    title: string;
    status: string;
    procedureId: string | null;
  };
  assetName: string | null;
  assetTag: string | null;
  locationName: string | null;
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

export function listIsolationCertificates() {
  return fetchApi<IsolationCertificateListRow[]>("/lototo/certificates");
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

export function transitionIsolationCertificate(id: string, status: string) {
  return fetchApi<IsolationCertificate>(`/lototo/certificates/${id}/transition`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function applyCertificatePoint(
  certificateId: string,
  pointId: string,
  payload: { positionConfirmed: string; lockNumber: string; tagNumber: string },
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
