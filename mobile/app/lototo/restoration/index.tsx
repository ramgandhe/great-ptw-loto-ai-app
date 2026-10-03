import { useEffect, useState } from "react";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { getIsolationExecutionForPlan } from "@/lib/isolation-execution/api";
import { listLototoPlans } from "@/lib/lototo/api";
import { useTheme } from "@/providers/theme-provider";
import { ActivityIndicator } from "react-native";
import { AppText, Banner, Button, Card, EmptyState, PageHeader, SafetyStatusChip, Screen } from "@/components/ui";
import { ISOLATION_STATUS, toneOf } from "@/lib/safety-status";

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
        setError(err instanceof ApiError ? err.message : "The restoration list could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <PageHeader title="Restore" description="Verified isolations ready to remove locks and return the equipment to service." back={{ label: "LOTOTO", href: "/lototo" }} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : candidates.length === 0 ? (
        <EmptyState title="Nothing to restore" body="Isolations appear here once they are verified." />
      ) : (
        candidates.map((item) => (
          <Card key={item.executionId} accent={tokens.status[toneOf(ISOLATION_STATUS, item.status).key]} onPress={() => router.push(`/lototo/restoration/${item.executionId}`)} accessibilityLabel={item.planTitle}>
            <AppText variant="subheading">{item.planTitle}</AppText>
            <SafetyStatusChip map={ISOLATION_STATUS} status={item.status} />
            {item.status === "verified" ? (
              <Button label="Restore" color={tokens.action.decide} size="sm" onPress={() => router.push(`/lototo/restoration/${item.executionId}`)} style={{ alignSelf: "flex-end" }} />
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
