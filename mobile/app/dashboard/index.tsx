import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AppText, Banner, Card, PageHeader, Screen, Tabs } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { getDashboard } from "@/lib/dashboards/api";
import { kpiCount, kpiLabel } from "@/lib/dashboards/labels";
import type { DashboardKind, DashboardPayload } from "@/lib/dashboards/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

const KINDS: { key: DashboardKind; label: string }[] = [
  { key: "personal", label: "Personal" },
  { key: "hod", label: "Supervisor" },
  { key: "safety", label: "Safety" },
  { key: "management", label: "Management" },
];

/** One figure: a large number and what it counts. */
function Figure({ value, label, color }: { value: number | string; label: string; color?: string }) {
  const { tokens } = useTheme();
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, gap: 2 }}>
      <AppText variant="display" style={{ color: color ?? tokens.colors.foreground }}>{String(value)}</AppText>
      <AppText variant="caption">{label}</AppText>
    </Card>
  );
}

export default function DashboardScreen() {
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [kind, setKind] = useState<DashboardKind>("personal");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDashboard(kind)
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : "The figures could not be loaded."))
      .finally(() => setLoading(false));
  }, [kind]);

  const s = dashboard?.summary;
  return (
    <Screen>
      <PageHeader title="Site figures" description={isOnline ? "Live counts for the view you choose." : "Offline: showing the last figures loaded, if any."} back={{ label: "Home", href: "/" }}>
        <Tabs options={KINDS} value={kind} onChange={setKind} />
      </PageHeader>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : dashboard ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[3] }}>
          <Figure value={s?.activePermits ?? 0} label="Active permits" color={tokens.status.active} />
          <Figure value={s?.pendingApprovals ?? 0} label="Waiting for approval" color={tokens.status.pending_approval} />
          <Figure value={s?.openIncidents ?? 0} label="Open incidents" color={tokens.colors.danger} />
          {dashboard.kpis.items.map((item) => (
            <Figure key={item.key} value={kpiCount(item)} label={kpiLabel(item)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
