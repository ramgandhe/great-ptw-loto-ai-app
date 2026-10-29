import { fetchApi } from "@/lib/api";

export type IsolationBlind = {
  id: string;
  pointId: string | null;
  blindTagNumber: string;
  lineTagNumber: string;
  blindType: string;
  status: string;
};

export type IsolationTest = {
  id: string;
  testReason: string;
  status: string;
  pointsTemporarilyDeisolated: string[];
};

export type IsolationCustody = {
  authorityId: string | null;
  status: string;
  isLongTerm: boolean;
  ltiReason: string | null;
  ltiAuditIntervalDays: number;
  nextAuditDueDate: string | null;
  tests: IsolationTest[];
  walks: Array<{ id: string; walkedAt: string; notes: string | null }>;
};

export function getCustody(certificateId: string) {
  return fetchApi<IsolationCustody>(`/lototo/certificates/${certificateId}/custody`);
}

export function listBlinds(certificateId: string) {
  return fetchApi<IsolationBlind[]>(`/lototo/certificates/${certificateId}/blinds`);
}

export function createBlind(
  certificateId: string,
  payload: { blindTagNumber: string; lineTagNumber: string; pointId?: string; blindType?: string },
) {
  return fetchApi<IsolationBlind>(`/lototo/certificates/${certificateId}/blinds`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function installBlind(blindId: string) {
  return fetchApi<IsolationBlind>(`/lototo/blinds/${blindId}/install`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function removeBlind(blindId: string) {
  return fetchApi<IsolationBlind>(`/lototo/blinds/${blindId}/remove`, {
    method: "POST",
    body: JSON.stringify({ gasketReplaced: true }),
  });
}

export function startTest(certificateId: string, payload: { testReason: string; pointIds: string[] }) {
  return fetchApi<IsolationTest>(`/lototo/certificates/${certificateId}/tests`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function finishTest(certificateId: string, testId: string) {
  return fetchApi<IsolationTest>(`/lototo/certificates/${certificateId}/tests/${testId}/finish`, {
    method: "POST",
    body: JSON.stringify({ zeroEnergyProved: true }),
  });
}

export function acceptHandover(certificateId: string, integrityNotes: string) {
  return fetchApi(`/lototo/certificates/${certificateId}/handover`, {
    method: "POST",
    body: JSON.stringify({ jointInspectionCompleted: true, integrityNotes, activePermitsReviewed: true }),
  });
}

export function markLongTerm(certificateId: string, payload: { isLongTerm: boolean; ltiReason?: string; ltiAuditIntervalDays?: number }) {
  return fetchApi(`/lototo/certificates/${certificateId}/long-term`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordWalk(certificateId: string, notes: string) {
  return fetchApi(`/lototo/certificates/${certificateId}/walks`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}
