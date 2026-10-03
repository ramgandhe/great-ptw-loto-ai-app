import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { AppText, Banner, Card, ChipRow, EmptyState, PageHeader, SafetyStatusChip, Screen, SeverityChip } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { CONFLICT_STATUS } from "@/lib/safety-status";
import { listSimopsConflicts } from "@/lib/simops/api";
import type { SimopsConflict } from "@/lib/simops/types";
import { useTheme } from "@/providers/theme-provider";

export default function SimopsConflictsScreen() {
  const { tokens } = useTheme();
  const [conflicts, setConflicts] = useState<SimopsConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSimopsConflicts()
      .then((items) => setConflicts(items.filter((item) => item.status !== "approved" && item.status !== "rejected")))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The clashes could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <PageHeader title="Work clashes" description="Permits whose work overlaps in place and time (SIMOPS). Each needs a decision before the work goes ahead." back={{ label: "Home", href: "/" }} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : conflicts.length === 0 ? (
        <EmptyState done title="No open clashes" body="Overlapping permits are checked on the web; any found appear here." />
      ) : (
        conflicts.map((conflict) => (
          <Card
            key={conflict.id}
            accent={conflict.severity === "high" ? tokens.colors.danger : conflict.severity === "medium" ? tokens.colors.warning : undefined}
            onPress={() => router.push(`/simops/${conflict.id}`)}
            accessibilityLabel={conflict.summary}
          >
            <AppText variant="subheading">{conflict.summary}</AppText>
            <ChipRow>
              <SafetyStatusChip map={CONFLICT_STATUS} status={conflict.status} />
              <SeverityChip severity={conflict.severity} />
            </ChipRow>
            <AppText variant="caption" style={{ textTransform: "capitalize" }}>{`${conflict.conflictType.replace(/_/g, " ")} · found ${formatRelative(conflict.detectedAt)}`}</AppText>
          </Card>
        ))
      )}
    </Screen>
  );
}
