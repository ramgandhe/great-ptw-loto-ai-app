import { useEffect, useState } from "react";
import { ActionBar, AppText, Banner, Button, Card, InfoList, PageHeader, Screen, ScreenState } from "@/components/ui";
import { Check, ExternalLink } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getNotification, markNotificationRead } from "@/lib/notifications/api";
import { queueOfflineMarkNotificationRead } from "@/lib/notifications/offline";
import { getNotificationEntityRoute } from "@/lib/notifications/routes";
import type { Notification } from "@/lib/notifications/types";
import { useOffline } from "@/providers/offline-provider";

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isOnline } = useOffline();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    getNotification(id)
      .then(setNotification)
      .catch((err) => setError(err instanceof ApiError ? err.message : "The message could not be loaded."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleMarkRead() {
    if (!notification || notification.readAt) {
      return;
    }

    setIsMarkingRead(true);
    try {
      if (!isOnline) {
        await queueOfflineMarkNotificationRead(notification.id);
        setNotification({ ...notification, readAt: new Date().toISOString() });
        return;
      }

      const updated = await markNotificationRead(notification.id);
      setNotification(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The message could not be marked as read.");
    } finally {
      setIsMarkingRead(false);
    }
  }

  const back = { label: "Messages", href: "/notifications" };
  if (loading || !notification) {
    return <ScreenState error={loading ? null : (error ?? "This message was not found.")} back={back} />;
  }

  const entityRoute = getNotificationEntityRoute(notification);
  const unread = notification.readAt === null;

  return (
    <Screen
      footer={
        unread || entityRoute ? (
          <ActionBar>
            {unread ? <Button label={isMarkingRead ? "Marking…" : "Mark as read"} variant="secondary" icon={Check} onPress={() => void handleMarkRead()} /> : null}
            {entityRoute ? <Button label="Open record" icon={ExternalLink} onPress={() => router.push(entityRoute as never)} /> : null}
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={notification.title} back={back} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Card>
        <AppText variant="body">{notification.body}</AppText>
      </Card>
      <Card>
        <InfoList
          rows={[
            ["About", notification.category.replace(/_/g, " ")],
            ["Priority", notification.priority],
            ["Received", formatDateTime(notification.createdAt)],
            ["Read", unread ? "Not yet" : formatDateTime(notification.readAt)],
          ]}
        />
      </Card>
    </Screen>
  );
}
