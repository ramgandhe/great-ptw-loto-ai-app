import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listArchivedPermits } from "@/lib/closure/api";
import type { ArchivedPermitSummary } from "@/lib/closure/types";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

export default function ClosureArchiveScreen() {
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ArchivedPermitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadArchive = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listArchivedPermits(search));
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  async function handleSearch() {
    await loadArchive(query.trim() || undefined);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Search archived permits..."
      />
      <Pressable style={styles.button} onPress={handleSearch} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Searching..." : "Search"}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.permit.id}
          ListEmptyComponent={
            hasLoaded ? <Text style={styles.empty}>No archived permits found.</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/closure/archive/${item.permit.id}`)}
            >
              <Text style={styles.cardTitle}>{item.permit.title}</Text>
              <Text style={styles.cardMeta}>
                Closed {new Date(item.closedAt).toLocaleString()}
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
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 10,
  },
  button: {
    backgroundColor: c.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  buttonText: { color: c.primaryForeground, fontWeight: "500" },
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
