export type NotificationPriority = "low" | "medium" | "high" | "critical";

export type NotificationCategory = "workflow" | "reminder" | "escalation" | "system";

export type NotificationDeliveryStatus = "pending" | "delivered" | "failed" | "suppressed";

export interface NotificationRecipient {
  id: string;
  channel: string;
  deliveryStatus: NotificationDeliveryStatus;
  readAt: string | null;
  deliveredAt: string | null;
}

export interface NotificationApiResponse {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  sourceModule: string | null;
  createdAt: string;
  recipient: NotificationRecipient;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  sourceModule: string | null;
  readAt: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  createdAt: string;
  deliveredAt: string | null;
}

export interface NotificationListParams {
  unreadOnly?: boolean;
}
