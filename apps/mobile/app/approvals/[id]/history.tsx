import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry } from "@/lib/approval/types";

export default function ApprovalHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getApprovalReview(id), getApprovalHistory(id)])
      .then(([review, entries]) => {
        setTitle(review.permit.title);
        setHistory(entries);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load history");
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{title}</Text>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.backLink}>Back to review</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No approval history yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.action}>{item.action.replace(/_/g, " ")}</Text>
              {item.fromStatus || item.toStatus ? (
                <Text style={styles.meta}>
                  {item.fromStatus?.replace(/_/g, " ") ?? "—"} →{" "}
                  {item.toStatus?.replace(/_/g, " ") ?? "—"}
                </Text>
              ) : null}
              {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
              <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  subtitle: { fontSize: 14, color: "#666" },
  backLink: { color: "#2563eb", fontWeight: "500", marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 4,
  },
  action: { fontSize: 15, fontWeight: "600", textTransform: "capitalize" },
  meta: { fontSize: 12, color: "#666" },
  comment: { fontSize: 13, marginTop: 4 },
  empty: { color: "#666", marginTop: 16 },
  error: { color: "#b91c1c" },
});
