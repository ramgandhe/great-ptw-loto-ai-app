import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getNotification, markNotificationRead } from "@/lib/notifications/api";
import { queueOfflineMarkNotificationRead } from "@/lib/notifications/offline";
import { getNotificationEntityRoute } from "@/lib/notifications/routes";
import type { Notification } from "@/lib/notifications/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load notification"))
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
      setError(err instanceof ApiError ? err.message : "Failed to mark notification as read");
    } finally {
      setIsMarkingRead(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  const entityRoute = notification ? getNotificationEntityRoute(notification) : null;

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: tokens.colors.primary, marginBottom: 12 }}>Back</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {notification ? (
        <View style={[styles.card, { borderColor: tokens.colors.border }]}>
          <Text style={[styles.title, { color: tokens.colors.foreground }]}>{notification.title}</Text>
          {notification.readAt === null ? (
            <Text style={{ color: tokens.colors.primary, fontSize: 11, fontWeight: "700", marginTop: 4 }}>
              UNREAD
            </Text>
          ) : (
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              Read {new Date(notification.readAt).toLocaleString()}
            </Text>
          )}
          <Text style={{ color: tokens.colors.foreground, marginTop: 12, lineHeight: 20 }}>
            {notification.body}
          </Text>
          <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 12 }}>
            {notification.category.replace(/_/g, " ")} · {notification.priority}
          </Text>
          <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
            Received {new Date(notification.createdAt).toLocaleString()}
          </Text>

          {notification.readAt === null ? (
            <Pressable
              style={[styles.button, { backgroundColor: tokens.colors.primary }]}
              onPress={() => void handleMarkRead()}
            >
              <Text style={styles.buttonText}>{isMarkingRead ? "Marking…" : "Mark as read"}</Text>
            </Pressable>
          ) : null}

          {entityRoute ? (
            <Pressable
              style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
              onPress={() => router.push(entityRoute)}
            >
              <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>Open related record</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16 },
  card: { borderWidth: 1, borderRadius: 8, padding: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  button: { borderRadius: 8, padding: 12, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 10,
  },
  error: { color: "#b91c1c", marginBottom: 8 },
});
