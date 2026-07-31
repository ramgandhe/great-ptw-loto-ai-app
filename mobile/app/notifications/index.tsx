import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/lib/notifications/api";
import { queueOfflineMarkNotificationRead } from "@/lib/notifications/offline";
import type { Notification } from "@/lib/notifications/types";
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load notifications"))
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
      setError(err instanceof ApiError ? err.message : "Failed to mark notification as read");
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Notifications</Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
        {unreadCount} unread · {isOnline ? "online" : "offline"}
      </Text>

      <View style={styles.filterRow}>
        {(["all", "unread"] as const).map((value) => (
          <Pressable
            key={value}
            style={[
              styles.filterButton,
              {
                borderColor: tokens.colors.border,
                backgroundColor: filter === value ? tokens.colors.primary : "transparent",
              },
            ]}
            onPress={() => setFilter(value)}
          >
            <Text
              style={{
                color: filter === value ? "#fff" : tokens.colors.foreground,
                fontWeight: "500",
                fontSize: 12,
              }}
            >
              {value === "all" ? "All" : "Unread"}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {notifications.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 12 }}>No notifications yet.</Text>
      ) : (
        notifications.map((notification) => (
          <Pressable
            key={notification.id}
            style={[
              styles.card,
              {
                borderColor: tokens.colors.border,
                backgroundColor:
                  notification.readAt === null ? `${tokens.colors.primary}12` : "transparent",
              },
            ]}
            onPress={() => router.push(`/notifications/${notification.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={{ color: tokens.colors.foreground, fontWeight: "600", flex: 1 }}>
                {notification.title}
              </Text>
              {notification.readAt === null ? (
                <Text style={{ color: tokens.colors.primary, fontSize: 10, fontWeight: "700" }}>UNREAD</Text>
              ) : null}
            </View>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
              {notification.body}
            </Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 11, marginTop: 6 }}>
              {notification.category.replace(/_/g, " ")} · {notification.priority} ·{" "}
              {new Date(notification.createdAt).toLocaleString()}
            </Text>
            {notification.readAt === null ? (
              <Pressable
                style={[styles.markReadButton, { borderColor: tokens.colors.border }]}
                onPress={(event) => {
                  event.stopPropagation();
                  void handleMarkRead(notification);
                }}
              >
                <Text style={{ color: tokens.colors.foreground, fontSize: 12 }}>
                  {markingId === notification.id ? "Marking…" : "Mark read"}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  filterButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  markReadButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  error: { color: "#b91c1c", marginTop: 8 },
});
