import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { listEvidence } from "@/lib/execution/api";
import type { EvidenceRecord } from "@/lib/execution/types";

export default function EvidenceGalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [items, setItems] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    listEvidence(permitId)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load evidence"))
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
        ListEmptyComponent={<Text style={styles.empty}>No evidence uploaded.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.fileName}>{item.fileName}</Text>
            <Text style={styles.meta}>
              {item.contentType} · {Math.round(item.fileSize / 1024)} KB
            </Text>
            {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
            <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
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
  fileName: { fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 12, color: "#666", marginTop: 4 },
  comment: { fontSize: 13, color: "#444", marginTop: 6 },
  empty: { color: "#666" },
  error: { color: "#b91c1c", marginBottom: 8 },
});
