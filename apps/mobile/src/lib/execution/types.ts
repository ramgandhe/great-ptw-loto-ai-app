import type { PermitRecord } from "@/lib/permit/types";

export type ExecutionDetail = {
  permit: PermitRecord;
  execution: {
    id: string;
    activatedAt: string;
    suspensionReason: string | null;
  } | null;
  progress: Array<{
    id: string;
    summary: string;
    recordedAt: string;
  }>;
  evidence: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    comment: string | null;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    reason: string | null;
    changedAt: string;
  }>;
};
