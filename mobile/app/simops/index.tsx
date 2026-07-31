import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listSimopsConflicts } from "@/lib/simops/api";
import type { SimopsConflict } from "@/lib/simops/types";
import { useTheme } from "@/providers/theme-provider";

function severityLabel(severity: SimopsConflict["severity"]) {
  return `${severity[0].toUpperCase()}${severity.slice(1)} severity`;
}

export default function SimopsConflictsScreen() {
  const { tokens } = useTheme();
  const [conflicts, setConflicts] = useState<SimopsConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSimopsConflicts()
      .then((items) =>
        setConflicts(
          items.filter((item) => item.status !== "approved" && item.status !== "rejected"),
        ),
      )
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load conflicts");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Active conflicts</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>
        SIMOPS conflicts requiring review before work proceeds.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {conflicts.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 12 }}>
          No open conflicts. Run analysis from the web dashboard.
        </Text>
      ) : (
        conflicts.map((conflict) => (
          <Pressable
            key={conflict.id}
            style={[styles.card, { borderColor: tokens.colors.border }]}
            onPress={() => router.push(`/simops/${conflict.id}`)}
          >
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{conflict.summary}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {conflict.conflictType.replace(/_/g, " ")} · {severityLabel(conflict.severity)}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  error: { color: "#b91c1c", marginTop: 8 },
});
