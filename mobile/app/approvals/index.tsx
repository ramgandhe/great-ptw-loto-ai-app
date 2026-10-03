import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listPendingApprovals } from "@/lib/approval/api";
import type { PendingApprovalItem } from "@/lib/approval/types";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

export default function PendingApprovalsScreen() {
  const styles = useThemedStyles(createStyles);
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listPendingApprovals()
      .then(setItems)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load approvals");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Permits assigned to you for approval</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.assignment.id}
          ListEmptyComponent={error ? null : <Text style={styles.empty}>No pending approvals.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/approvals/${item.permit.id}`)}
            >
              <Text style={styles.cardTitle}>{item.permit.title}</Text>
              <Text style={styles.cardMeta}>
                {item.permit.reference ?? "No reference yet"} · {item.step.name}
              </Text>
              <Text style={styles.cardMeta}>
                {item.permit.status.replace(/_/g, " ")}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  subtitle: { fontSize: 14, color: c.mutedForeground },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: c.foreground },
  cardMeta: { fontSize: 12, color: c.mutedForeground, marginTop: 4 },
  empty: { color: c.mutedForeground, marginTop: 16 },
  error: { color: c.danger },
});
