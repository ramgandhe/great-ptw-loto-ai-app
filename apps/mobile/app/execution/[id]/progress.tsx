import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { listProgress } from "@/lib/execution/api";
import type { ProgressRecord } from "@/lib/execution/types";

export default function ProgressUpdatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [items, setItems] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    listProgress(permitId)
      .then((records) => setItems(records.slice().reverse()))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load progress"))
      .finally(() => setLoading(false));
  }, [permitId]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No progress updates.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.summary}>{item.summary}</Text>
            <Text style={styles.meta}>{new Date(item.recordedAt).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  summary: { fontSize: 14 },
  meta: { fontSize: 12, color: "#666", marginTop: 4 },
  empty: { color: "#666" },
  error: { color: "#b91c1c", marginBottom: 8 },
});
