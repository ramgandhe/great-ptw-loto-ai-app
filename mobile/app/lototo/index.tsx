import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { useTheme } from "@/providers/theme-provider";

export default function LototoPlansScreen() {
  const { tokens } = useTheme();
  const [plans, setPlans] = useState<LototoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLototoPlans()
      .then(setPlans)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load LOTOTO plans");
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
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>LOTOTO plans</Text>
      <Text style={[styles.subtitle, { color: tokens.colors.mutedForeground }]}>
        Configure isolation before field execution.
      </Text>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
        onPress={() => router.push("/lototo/new")}
      >
        <Text style={styles.primaryButtonText}>New plan</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {plans.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground }}>No LOTOTO plans yet.</Text>
      ) : (
        plans.map((plan) => (
          <Pressable
            key={plan.id}
            style={[styles.card, { borderColor: tokens.colors.border, backgroundColor: tokens.colors.card }]}
            onPress={() => router.push(`/lototo/${plan.id}`)}
          >
            <Text style={[styles.cardTitle, { color: tokens.colors.foreground }]}>{plan.title}</Text>
            <Text style={{ color: tokens.colors.mutedForeground }}>{plan.status}</Text>
          </Pressable>
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
