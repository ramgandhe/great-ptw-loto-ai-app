import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { getIsolationExecutionForPlan } from "@/lib/isolation-execution/api";
import { listLototoPlans } from "@/lib/lototo/api";
import { useTheme } from "@/providers/theme-provider";

type Candidate = {
  planTitle: string;
  planId: string;
  executionId: string;
  status: string;
};

export default function RestorationListScreen() {
  const { tokens } = useTheme();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLototoPlans()
      .then(async (plans) => {
        const items: Candidate[] = [];
        for (const plan of plans.filter((p) => p.status === "in_execution")) {
          try {
            const detail = await getIsolationExecutionForPlan(plan.id);
            if (detail.execution.status === "verified" || detail.execution.status === "restored") {
              items.push({
                planTitle: plan.title,
                planId: plan.id,
                executionId: detail.execution.id,
                status: detail.execution.status,
              });
            }
          } catch {
            // skip
          }
        }
        setCandidates(items);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load restoration queue");
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
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Restoration</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>
        Verified isolations ready for equipment restoration.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {candidates.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 12 }}>
          No verified isolations awaiting restoration.
        </Text>
      ) : (
        candidates.map((item) => (
          <Pressable
            key={item.executionId}
            style={[styles.card, { borderColor: tokens.colors.border }]}
            onPress={() => router.push(`/lototo/restoration/${item.executionId}`)}
          >
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{item.planTitle}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
              {item.status.replace(/_/g, " ")}
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
