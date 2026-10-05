import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { AppText, Banner, Button, Card, ChipRow, EmptyState, PageHeader, RefChip, SafetyStatusChip, Screen } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { LOTOTO_PLAN_STATUS, toneOf } from "@/lib/safety-status";
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
        setError(err instanceof ApiError ? err.message : "The plans could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <PageHeader title="Isolate" description="Plans ready to lock out, and isolations under way." back={{ label: "LOTOTO", href: "/lototo" }} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : plans.length === 0 ? (
        <EmptyState title="Nothing to isolate" body="A plan becomes ready once its isolation sequence is saved." />
      ) : (
        plans.map((plan) => (
          <Card key={plan.id} accent={tokens.status[toneOf(LOTOTO_PLAN_STATUS, plan.status).key]} onPress={() => router.push(`/lototo/execute/${plan.id}`)} accessibilityLabel={plan.title}>
            <AppText variant="subheading">{plan.title}</AppText>
            <ChipRow>
              <SafetyStatusChip map={LOTOTO_PLAN_STATUS} status={plan.status} />
              <RefChip reference={plan.reference} />
            </ChipRow>
            <Button
              label={plan.status === "ready" ? "Start isolation" : "Continue"}
              variant={plan.status === "ready" ? "primary" : "tint"}
              color={tokens.action.do}
              size="sm"
              onPress={() => router.push(`/lototo/execute/${plan.id}`)}
              style={{ alignSelf: "flex-end" }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
