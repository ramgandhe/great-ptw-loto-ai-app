import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { countPendingExecutionItems, initExecutionOfflineStorage } from "@/lib/execution/offline";
import { syncExecutionQueue } from "@/lib/execution/api";
import { listPermits } from "@/lib/permit/api";
import type { PermitRecord } from "@/lib/permit/types";

const EXECUTION_STATUSES = ["approved", "active", "suspended"] as const;

export default function ActivePermitsScreen() {
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await initExecutionOfflineStorage();
      const groups = await Promise.all(EXECUTION_STATUSES.map((status) => listPermits(status)));
      setPermits(groups.flat());
      setPendingCount(await countPendingExecutionItems());
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
    setSyncMessage(null);
    try {
      const result = await syncExecutionQueue();
      setSyncMessage(`Synced ${result.synced} item(s)${result.failed ? `, ${result.failed} failed` : ""}`);
      setPendingCount(await countPendingExecutionItems());
    } catch (err) {
      setSyncMessage(err instanceof ApiError ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Activate, execute, and monitor permits</Text>

      {pendingCount > 0 ? (
        <Pressable style={styles.syncBanner} onPress={handleSync} disabled={syncing}>
          <Text style={styles.syncText}>
            {syncing
              ? "Syncing offline updates..."
              : `${pendingCount} offline update(s) pending — tap to sync`}
          </Text>
        </Pressable>
      ) : null}

      {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={permits}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No permits in execution phase.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/execution/${item.id}`)}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.reference ?? item.id.slice(0, 8)} · {item.status.replace(/_/g, " ")}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  subtitle: { fontSize: 14, color: "#666" },
  syncBanner: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 10,
  },
  syncText: { fontSize: 13, color: "#92400e" },
  syncMessage: { fontSize: 12, color: "#059669" },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardMeta: { fontSize: 12, color: "#666", marginTop: 4 },
  empty: { color: "#666", marginTop: 16 },
  error: { color: "#b91c1c" },
});
