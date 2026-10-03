import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { countPendingClosureItems, initClosureOfflineStorage } from "@/lib/closure/offline";
import { syncClosureQueue } from "@/lib/closure/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

export default function ClosureQueueScreen() {
  const styles = useThemedStyles(createStyles);
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await initClosureOfflineStorage();
      setPermits(await listPermits("active"));
      setPendingCount(await countPendingClosureItems());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load permits");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncClosureQueue();
      setPendingCount(await countPendingClosureItems());
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Verify completed work and close permits</Text>
      {pendingCount > 0 ? (
        <Pressable style={styles.banner} onPress={handleSync} disabled={syncing}>
          <Text style={styles.bannerText}>
            {syncing
              ? "Syncing offline inspections..."
              : `${pendingCount} offline inspection(s) pending`}
          </Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={permits}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={error ? null : <Text style={styles.empty}>No active permits awaiting closure.</Text>}
          ListHeaderComponent={
            <Pressable style={styles.linkRow} onPress={() => router.push("/closure/archive")}>
              <Text style={styles.link}>View archive</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/closure/${item.id}`)}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.reference ?? "No reference yet"} · {item.status.replace(/_/g, " ")}
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
  banner: { backgroundColor: c.warningBg, borderRadius: 8, padding: 10 },
  bannerText: { fontSize: 13, color: c.warning },
  linkRow: { marginBottom: 8 },
  link: { color: c.primary, fontSize: 14 },
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
