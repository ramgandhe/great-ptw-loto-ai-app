import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { AppText, Banner, Button, Card, ChipRow, EmptyState, PageHeader, RefChip, SafetyStatusChip, Screen, SectionTitle } from "@/components/ui";
import { Lock, Plus, Unlock } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { listLototoPlans } from "@/lib/lototo/api";
import type { LototoPlan } from "@/lib/lototo/types";
import { LOTOTO_PLAN_STATUS, toneOf } from "@/lib/safety-status";
import { useTheme } from "@/providers/theme-provider";
import { tint } from "@/theme/tokens";

export default function LototoPlansScreen() {
  const { tokens } = useTheme();
  const [plans, setPlans] = useState<LototoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLototoPlans()
      .then(setPlans)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The LOTOTO plans could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  const shortcuts = [
    { title: "Isolate", body: "Lock out a ready plan, point by point", href: "/lototo/active", Icon: Lock, color: tokens.action.do },
    { title: "Restore", body: "Remove locks and return equipment", href: "/lototo/restoration", Icon: Unlock, color: tokens.action.decide },
  ] as const;

  return (
    <Screen>
      <PageHeader
        title="LOTOTO"
        description="Isolation plans: set up the sequence, lock out in the field, then restore."
        back={{ label: "Home", href: "/" }}
        actions={<Button label="New plan" icon={Plus} onPress={() => router.push("/lototo/new")} />}
      />

      <View style={{ flexDirection: "row", gap: tokens.space[3] }}>
        {shortcuts.map(({ title, body, href, Icon, color }) => (
          <Card key={href} onPress={() => router.push(href)} accessibilityLabel={title} style={{ flex: 1 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(color, 0.14) }}>
              <Icon size={18} color={color} />
            </View>
            <AppText variant="subheading">{title}</AppText>
            <AppText variant="caption">{body}</AppText>
          </Card>
        ))}
      </View>

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Plans" count={loading ? undefined : plans.length} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {loading ? (
          <ActivityIndicator color={tokens.colors.primary} />
        ) : error ? null : plans.length === 0 ? (
          <EmptyState title="No plans yet" body="A plan lists the isolation points of a machine, in order." action={<Button label="New plan" variant="outline" onPress={() => router.push("/lototo/new")} />} />
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} accent={tokens.status[toneOf(LOTOTO_PLAN_STATUS, plan.status).key]} onPress={() => router.push(`/lototo/${plan.id}`)} accessibilityLabel={plan.title}>
              <AppText variant="subheading">{plan.title}</AppText>
              <ChipRow>
                <SafetyStatusChip map={LOTOTO_PLAN_STATUS} status={plan.status} />
                <RefChip reference={plan.reference} />
              </ChipRow>
              {plan.description ? <AppText variant="caption" numberOfLines={2}>{plan.description}</AppText> : null}
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
