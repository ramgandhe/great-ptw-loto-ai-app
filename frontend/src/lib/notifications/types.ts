export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type NotificationCategory = "task" | "reminder" | "escalation" | "system";

export type NotificationDeliveryStatus = "pending" | "delivered" | "failed";

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt: string | null;
  deliveryStatus?: NotificationDeliveryStatus;
  createdAt: string;
  deliveredAt?: string | null;
}

export interface NotificationListParams {
  unreadOnly?: boolean;
  priority?: NotificationPriority;
  category?: NotificationCategory;
}
