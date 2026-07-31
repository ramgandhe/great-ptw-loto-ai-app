import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getPlanHistory } from "@/lib/restoration/api";
import type { LototoHistoryEntry } from "@/lib/restoration/types";
import { useTheme } from "@/providers/theme-provider";

export default function LototoHistoryScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { tokens } = useTheme();
  const [entries, setEntries] = useState<LototoHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      return;
    }
    getPlanHistory(planId)
      .then(setEntries)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load history");
      })
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>LOTOTO history</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {entries.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground }}>No history recorded.</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>
              {entry.action.replace(/\./g, " · ")}
            </Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
              {new Date(entry.occurredAt).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12 },
  error: { color: "#b91c1c" },
});
