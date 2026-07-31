import type { IsolationExecution } from "@/lib/isolation-execution/types";

export const RESTORATION_VERIFICATION_RESULTS = ["pass", "fail"] as const;
export type RestorationVerificationResult = (typeof RESTORATION_VERIFICATION_RESULTS)[number];

export type EquipmentRestoration = {
  id: string;
  executionId: string;
  isolationPointId: string;
  status: string;
  method: string | null;
  notes: string | null;
  restoredBy: string;
  restoredAt: string;
};

export type LockRemoval = {
  id: string;
  executionId: string;
  appliedLockId: string;
  reason: string | null;
  removedBy: string;
  removedAt: string;
};

export type TagRemoval = {
  id: string;
  executionId: string;
  appliedTagId: string;
  reason: string | null;
  removedBy: string;
  removedAt: string;
};

export type RestorationDetail = {
  execution: IsolationExecution;
  restorations: EquipmentRestoration[];
  lockRemovals: LockRemoval[];
  tagRemovals: TagRemoval[];
};

export type LototoHistoryEntry = {
  id: string;
  tenantId: string;
  planId: string | null;
  executionId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
};

export type RestoreEquipmentPayload = {
  isolationPointId: string;
  method?: string;
  notes?: string;
};

export type RestorationVerificationPayload = {
  isolationPointId: string;
  restorationId?: string;
  result: RestorationVerificationResult;
  method?: string;
  comment?: string;
};
