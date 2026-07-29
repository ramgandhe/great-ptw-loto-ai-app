import { fetchApi } from "@/lib/api";
import type {
  ApprovalHistoryEntry,
  ApprovalReview,
  PendingApprovalItem,
} from "./types";

export function listPendingApprovals() {
  return fetchApi<PendingApprovalItem[]>("/approvals");
}

export function getApprovalReview(permitId: string) {
  return fetchApi<ApprovalReview>(`/approvals/${permitId}`);
}

export function approvePermit(permitId: string, comment?: string) {
  return fetchApi<ApprovalReview>(`/approvals/${permitId}/approve`, {
    method: "POST",
    body: JSON.stringify({ comment: comment?.trim() || undefined }),
  });
}

export function rejectPermit(permitId: string, comment: string) {
  return fetchApi<ApprovalReview>(`/approvals/${permitId}/reject`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function deferPermit(permitId: string, comment: string) {
  return fetchApi<ApprovalReview>(`/approvals/${permitId}/defer`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function getApprovalHistory(permitId: string) {
  return fetchApi<ApprovalHistoryEntry[]>(`/approvals/${permitId}/history`);
}
