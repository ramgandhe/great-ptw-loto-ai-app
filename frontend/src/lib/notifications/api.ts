import { fetchApi } from "@/lib/api";
import type { Notification, NotificationListParams } from "./types";

function buildQuery(params?: NotificationListParams): string {
  if (!params) {
    return "";
  }

  const search = new URLSearchParams();
  if (params.unreadOnly) {
    search.set("unreadOnly", "true");
  }
  if (params.priority) {
    search.set("priority", params.priority);
  }
  if (params.category) {
    search.set("category", params.category);
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function listNotifications(params?: NotificationListParams) {
  return fetchApi<Notification[]>(`/notifications${buildQuery(params)}`);
}

export function getNotification(id: string) {
  return fetchApi<Notification>(`/notifications/${id}`);
}

export function markNotificationRead(id: string) {
  return fetchApi<Notification>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function sendTestNotification() {
  return fetchApi<{ message: string }>("/notifications/test", { method: "POST" });
}
