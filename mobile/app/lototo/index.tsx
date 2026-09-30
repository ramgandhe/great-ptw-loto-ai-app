import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listLototoProcedures } from "@/lib/lototo/api";
import type { LototoProcedureListItem } from "@/lib/lototo/types";
import { useTheme } from "@/providers/theme-provider";

export default function LototoProceduresScreen() {
  const { tokens } = useTheme();
  const [rows, setRows] = useState<LototoProcedureListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLototoProcedures()
      .then(setRows)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load LOTOTO procedures");
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
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>LOTOTO procedures</Text>
      <Text style={[styles.subtitle, { color: tokens.colors.mutedForeground }]}>
        Isolation, try-out and restoration are recorded on the permit.
      </Text>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
        onPress={() => router.push("/execution")}
      >
        <Text style={styles.primaryButtonText}>Open execution</Text>
      </Pressable>
      <Pressable style={[styles.card, { borderColor: tokens.colors.border }]} onPress={() => router.push("/closure")}>
        <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Restoration / close</Text>
        <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>After work is complete</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {rows.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground }}>No procedures yet. Create them in the web library.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={[styles.card, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.card }]}>
            <Text style={[styles.cardTitle, { color: tokens.colors.foreground }]}>{row.title}</Text>
            <Text style={{ color: tokens.colors.mutedForeground }}>
              {row.code} · {row.status}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "600" },
  subtitle: { fontSize: 14 },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "500" },
  error: { color: "#b91c1c" },
});
