import { fetchApi } from "@/lib/api/client";
import type {
  AppliedLock,
  AppliedTag,
  ApplyLockPayload,
  ApplyTagPayload,
  IsolationExecution,
  IsolationExecutionDetail,
  IsolationVerification,
  RecordVerificationPayload,
} from "./types";

export function startIsolationExecution(planId: string) {
  return fetchApi<IsolationExecution>(`/lototo-plans/${planId}/isolation-execution`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getIsolationExecutionForPlan(planId: string) {
  return fetchApi<IsolationExecutionDetail>(`/lototo-plans/${planId}/isolation-execution`);
}

export function markIsolationComplete(executionId: string) {
  return fetchApi<IsolationExecution>(`/isolation-executions/${executionId}/isolate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function markIsolationVerified(executionId: string) {
  return fetchApi<IsolationExecution>(`/isolation-executions/${executionId}/verify`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function applyLock(executionId: string, payload: ApplyLockPayload) {
  return fetchApi<AppliedLock>(`/isolation-executions/${executionId}/locks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function applyTag(executionId: string, payload: ApplyTagPayload) {
  return fetchApi<AppliedTag>(`/isolation-executions/${executionId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function recordVerification(executionId: string, payload: RecordVerificationPayload) {
  return fetchApi<IsolationVerification>(
    `/isolation-executions/${executionId}/verifications`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
