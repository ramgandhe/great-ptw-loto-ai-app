import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Banner, Button, Card, EmptyState, PageHeader, Screen, Tabs } from "@/components/ui";
import { ExternalLink } from "@/components/ui/icons";
import { formatRelative } from "@/lib/format";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/lib/notifications/api";
import { queueOfflineMarkNotificationRead } from "@/lib/notifications/offline";
import type { Notification } from "@/lib/notifications/types";
import { getNotificationEntityRoute } from "@/lib/notifications/routes";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function NotificationsScreen() {
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    listNotifications(filter === "unread" ? { unreadOnly: true } : undefined)
      .then(setNotifications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Messages could not be loaded."))
      .finally(() => setLoading(false));
  }, [filter]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.readAt === null).length,
    [notifications],
  );

  async function handleMarkRead(notification: Notification) {
    if (notification.readAt) {
      return;
    }

    setMarkingId(notification.id);
    try {
      if (!isOnline) {
        await queueOfflineMarkNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
        return;
      }

      const updated = await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The message could not be marked as read.");
    } finally {
      setMarkingId(null);
    }
  }

  const c = tokens.colors;
  return (
    <Screen>
      <PageHeader title="Messages" description={`${unreadCount} unread${isOnline ? "" : " · offline"}`} back={{ label: "Home", href: "/" }}>
        <Tabs
          options={[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread", count: filter === "unread" ? notifications.length : undefined },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: tokens.space[6] }} />
      ) : notifications.length === 0 ? (
        <EmptyState done title={filter === "unread" ? "Nothing unread" : "No messages yet"} body="Approvals, hand-offs and changes to your permits are announced here." />
      ) : (
        notifications.map((notification) => {
          const unread = notification.readAt === null;
          const route = getNotificationEntityRoute(notification);
          return (
            <Card key={notification.id} accent={unread ? c.primary : undefined} onPress={() => router.push(`/notifications/${notification.id}`)} accessibilityLabel={`${unread ? "Unread: " : ""}${notification.title}`}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.space[2] }}>
                {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: c.primary }} /> : null}
                <AppText variant="subheading" weight={unread ? "bold" : "medium"} style={{ flex: 1 }}>{notification.title}</AppText>
              </View>
              <AppText variant="body" tone="secondary" numberOfLines={2}>{notification.body}</AppText>
              <AppText variant="caption" style={{ textTransform: "capitalize" }}>{`${notification.category.replace(/_/g, " ")} · ${formatRelative(notification.createdAt)}`}</AppText>
              {route || unread ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2], marginTop: tokens.space[1] }}>
                  {/* Opening the record is the main move; it also marks the message read. */}
                  {route ? (
                    <Button
                      label="Open record"
                      size="sm"
                      variant="tint"
                      icon={ExternalLink}
                      onPress={() => {
                        if (unread) void handleMarkRead(notification);
                        router.push(route as never);
                      }}
                    />
                  ) : null}
                  {unread ? <Button label={markingId === notification.id ? "Marking…" : "Mark read"} size="sm" variant="ghost" onPress={() => void handleMarkRead(notification)} /> : null}
                </View>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
