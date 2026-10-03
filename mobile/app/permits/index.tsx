import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import {
  initPermitOfflineStorage,
  listLocalPermitDrafts,
  isLocalPermitId,
  localDraftToPermitRecord,
} from "@/lib/permit/offline";
import { isEditablePermitStatus } from "@/lib/permit/status";
import type { PermitRecord } from "@/lib/permit/types";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

type Tab = "drafts" | "submitted";

const SUBMITTED_STATUSES = [
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
] as const;

export default function PermitsScreen() {
  const styles = useThemedStyles(createStyles);
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
          const merged = [
            ...localRecords,
            ...remote.filter((r) => !localRecords.some((l) => l.id === r.id)),
          ];
          setPermits(merged);
          return;
        }

        const groups = await Promise.all(
          SUBMITTED_STATUSES.map((status) => listPermits(status).catch(() => [] as PermitRecord[])),
        );
        setPermits(
          groups
            .flat()
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
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
          ListEmptyComponent={error ? null : <Text style={styles.empty}>No permits found.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push(
                  isEditablePermitStatus(item.status)
                    ? `/permits/${item.id}/edit`
                    : `/permits/${item.id}`,
                )
              }
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {/* A permit made offline is not on the server yet; say so instead of a status it does not have. */}
                {isLocalPermitId(item.id)
                  ? "Pending server confirmation"
                  : `${item.reference ?? "No reference yet"} · ${item.status.replace(/_/g, " ")}`}
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
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "600", color: c.foreground },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.muted,
  },
  tabActive: { backgroundColor: c.primary },
  tabText: { fontSize: 13, color: c.mutedForeground },
  tabTextActive: { color: c.primaryForeground },
  primaryButton: {
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primaryButtonText: { color: c.primaryForeground, fontWeight: "600" },
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
