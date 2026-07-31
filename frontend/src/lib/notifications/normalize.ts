import type { Notification, NotificationApiResponse } from "./types";

export function normalizeNotification(response: NotificationApiResponse): Notification {
  return {
    id: response.id,
    title: response.title,
    body: response.body,
    priority: response.priority,
    category: response.category,
    eventType: response.eventType,
    entityType: response.entityType,
    entityId: response.entityId,
    sourceModule: response.sourceModule,
    readAt: response.recipient.readAt,
    deliveryStatus: response.recipient.deliveryStatus,
    deliveredAt: response.recipient.deliveredAt,
    createdAt: response.createdAt,
  };
}
