import { fetchApi } from "@/lib/api/client";
import type {
  AddIsolationPointPayload,
  AssignPersonnelPayload,
  ConfigureSequencePayload,
  CreateLototoPlanPayload,
  IsolationPoint,
  LototoAssignment,
  LototoPlan,
} from "./types";

export function listLototoPlans(filters?: { permitId?: string; machineryId?: string }) {
  const params = new URLSearchParams();
  if (filters?.permitId) params.set("permitId", filters.permitId);
  if (filters?.machineryId) params.set("machineryId", filters.machineryId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return fetchApi<LototoPlan[]>(`/lototo/plans${query}`);
}

export function createLototoPlan(payload: CreateLototoPlanPayload) {
  return fetchApi<LototoPlan>("/lototo/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function assignLototoPersonnel(planId: string, payload: AssignPersonnelPayload) {
  return fetchApi<LototoAssignment>(`/lototo/plans/${planId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addIsolationPoint(planId: string, payload: AddIsolationPointPayload) {
  return fetchApi<IsolationPoint>(`/lototo/plans/${planId}/isolation-points`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function configureIsolationSequence(planId: string, payload: ConfigureSequencePayload) {
  return fetchApi<{ configured: number }>(`/lototo/plans/${planId}/sequence`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
