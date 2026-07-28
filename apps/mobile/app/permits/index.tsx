import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import {
  initPermitOfflineStorage,
  listLocalPermitDrafts,
  localDraftToPermitRecord,
} from "@/lib/permit/offline";
import type { PermitRecord } from "@/lib/permit/types";

type Tab = "drafts" | "submitted";

export default function PermitsScreen() {
  const [tab, setTab] = useState<Tab>("drafts");
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void initPermitOfflineStorage();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (tab === "drafts") {
          const [remote, local] = await Promise.all([
            listPermits("draft").catch(() => [] as PermitRecord[]),
            listLocalPermitDrafts(),
          ]);
          const localRecords = local.map(localDraftToPermitRecord);
          const merged = [...localRecords, ...remote.filter((r) => !localRecords.some((l) => l.id === r.id))];
          setPermits(merged);
          return;
        }

        setPermits(await listPermits("pending_approval"));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load permits");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [tab]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Permits</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/permits/new")}>
          <Text style={styles.primaryButtonText}>Create</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(["drafts", "submitted"] as const).map((value) => (
          <Pressable
            key={value}
            style={[styles.tab, tab === value && styles.tabActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
              {value === "drafts" ? "Drafts" : "Submitted"}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={permits}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No permits found.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push(item.status === "draft" ? `/permits/${item.id}/edit` : `/permits/${item.id}`)
              }
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
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "600" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  tabActive: { backgroundColor: "#1f2937" },
  tabText: { fontSize: 13, color: "#374151" },
  tabTextActive: { color: "#fff" },
  primaryButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
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
