import { enqueueSyncItem } from "@/lib/offline/queue";
import type { CreateIncidentPayload } from "./types";

export async function queueOfflineIncidentReport(payload: CreateIncidentPayload): Promise<void> {
  await enqueueSyncItem({
    entityType: "incident_report",
    method: "POST",
    path: "/incidents",
    payload,
  });
}

export async function queueOfflineIncidentSubmit(incidentId: string): Promise<void> {
  await enqueueSyncItem({
    entityType: "incident_submit",
    method: "POST",
    path: `/incidents/${incidentId}/submit`,
    payload: {},
  });
}
