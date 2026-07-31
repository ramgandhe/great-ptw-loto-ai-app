import { enqueueSyncItem } from "@/lib/offline/queue";

export async function queueOfflineMarkNotificationRead(notificationId: string): Promise<void> {
  await enqueueSyncItem({
    entityType: "notification_read",
    method: "PATCH",
    path: `/notifications/${notificationId}/read`,
    payload: {},
  });
}
