import { enqueueSyncItem } from "@/lib/storage";

export function queueProgress(permitId: string, summary: string) {
  return enqueueSyncItem("execution-progress", {
    method: "POST",
    path: `/permits/${permitId}/progress`,
    body: { summary },
  });
}

export function queueEvidence(
  permitId: string,
  file: { uri: string; name: string; mimeType: string },
  comment?: string,
) {
  return enqueueSyncItem("execution-evidence", {
    method: "MULTIPART_POST",
    path: `/permits/${permitId}/evidence`,
    file,
    comment,
  });
}
