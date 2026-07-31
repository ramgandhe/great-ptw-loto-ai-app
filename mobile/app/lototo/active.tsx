import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { useTheme } from "@/providers/theme-provider";

const ACTIVE_STATUSES = new Set<LototoPlan["status"]>(["ready", "in_execution"]);

export default function ActiveLototoScreen() {
  const { tokens } = useTheme();
  const [plans, setPlans] = useState<LototoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLototoPlans()
      .then((items) => setPlans(items.filter((plan) => ACTIVE_STATUSES.has(plan.status))))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load active plans");
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
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Active LOTOTO</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>
        Plans ready for isolation execution or in progress.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {plans.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 12 }}>
          No active plans. Configure and save a sequence first.
        </Text>
      ) : (
        plans.map((plan) => (
          <Pressable
            key={plan.id}
            style={[styles.card, { borderColor: tokens.colors.border }]}
            onPress={() => router.push(`/lototo/execute/${plan.id}`)}
          >
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{plan.title}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
              {plan.status.replace(/_/g, " ")}
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
  error: { color: "#b91c1c" },
});
