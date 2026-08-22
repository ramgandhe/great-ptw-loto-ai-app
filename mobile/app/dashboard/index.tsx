import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { getDashboard } from "@/lib/dashboards/api";
import { kpiCount, kpiLabel } from "@/lib/dashboards/labels";
import type { DashboardKind, DashboardPayload } from "@/lib/dashboards/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

const KINDS: { value: DashboardKind; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "hod", label: "Supervisor" },
  { value: "safety", label: "Safety" },
  { value: "management", label: "Management" },
];

export default function DashboardScreen() {
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [kind, setKind] = useState<DashboardKind>("personal");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getDashboard(kind)
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, [kind]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Dashboard</Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
        {isOnline ? "online" : "offline (cached if available)"}
      </Text>

      <View style={styles.filterRow}>
        {KINDS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.filterButton,
              {
                borderColor: tokens.colors.border,
                backgroundColor: kind === option.value ? tokens.colors.primary : "transparent",
              },
            ]}
            onPress={() => setKind(option.value)}
          >
            <Text
              style={{
                color: kind === option.value ? "#fff" : tokens.colors.foreground,
                fontSize: 11,
                fontWeight: "500",
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {dashboard ? (
        <>
          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Summary</Text>
            <Text style={styles.meta}>
              Active permits: {dashboard.summary.activePermits ?? 0} · Pending approvals:{" "}
              {dashboard.summary.pendingApprovals ?? 0}
            </Text>
            <Text style={styles.meta}>
              Open incidents: {dashboard.summary.openIncidents ?? 0}
            </Text>
          </View>

          {dashboard.kpis.items.map((item) => (
            <View key={item.key} style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>{kpiLabel(item)}</Text>
              <Text style={{ color: tokens.colors.foreground, fontSize: 24, fontWeight: "600", marginTop: 4 }}>
                {kpiCount(item)}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      <Pressable
        style={[styles.linkButton, { borderColor: tokens.colors.border }]}
        onPress={() => router.push("/notifications")}
      >
        <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>Notifications</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  filterButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  meta: { color: "#64748b", fontSize: 12, marginTop: 4 },
  linkButton: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: "center", marginTop: 12 },
  error: { color: "#b91c1c", marginTop: 8 },
});
