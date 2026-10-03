import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { PermitCard } from "@/components/permit/permit-card";
import { Banner, Button, EmptyState, PageHeader, Screen } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { listPendingApprovals } from "@/lib/approval/api";
import type { PendingApprovalItem } from "@/lib/approval/types";
import { useOrgNames } from "@/lib/permit/names";
import { useTheme } from "@/providers/theme-provider";

export default function PendingApprovalsScreen() {
  const { tokens } = useTheme();
  const names = useOrgNames();
  const [items, setItems] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listPendingApprovals());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approvals could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <PageHeader title="Approvals" description="Permits waiting for your decision at your stage." back={{ label: "Home", href: "/" }} />

      {error ? <Banner tone="danger" title="Could not load approvals" action={<Button label="Retry" variant="ghost" size="sm" onPress={() => void load()} />}>{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : items.length === 0 ? (
        <EmptyState done title="Nothing waiting for you" body="Permits sent to your approval stage appear here." />
      ) : (
        items.map((item) => (
          <PermitCard
            key={item.assignment.id}
            permit={item.permit}
            names={names}
            accent={tokens.action.decide}
            onPress={() => router.push(`/approvals/${item.permit.id}`)}
            action={{ label: `Review · ${item.step.name}`, color: tokens.action.decide, solid: true, onPress: () => router.push(`/approvals/${item.permit.id}`) }}
          />
        ))
      )}
    </Screen>
  );
}
