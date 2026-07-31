import { fetchApi } from "@/lib/api";
import { normalizeNotification } from "./normalize";
import type { Notification, NotificationApiResponse, NotificationListParams } from "./types";

function buildQuery(params?: NotificationListParams): string {
  if (!params?.unreadOnly) {
    return "";
  }

  return "?unreadOnly=true";
}

export async function listNotifications(params?: NotificationListParams): Promise<Notification[]> {
  const rows = await fetchApi<NotificationApiResponse[]>(`/notifications${buildQuery(params)}`);
  return rows.map(normalizeNotification);
}

export async function getNotification(id: string): Promise<Notification> {
  const row = await fetchApi<NotificationApiResponse>(`/notifications/${id}`);
  return normalizeNotification(row);
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const row = await fetchApi<NotificationApiResponse>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
  return normalizeNotification(row);
}

export function sendTestNotification() {
  return fetchApi<unknown>("/notifications/test", { method: "POST" });
}
