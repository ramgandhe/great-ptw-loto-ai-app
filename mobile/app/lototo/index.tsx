import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { AppText, Banner, Card, ChipRow, EmptyState, PageHeader, RefChip, Screen, SectionTitle } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { listIsolationCertificates, type IsolationCertificateListRow } from "@/lib/lototo/api";
import { useTheme } from "@/providers/theme-provider";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  approved: "Ready",
  isolation_in_progress: "Isolating",
  isolated_verified: "Isolated",
  sanction_for_test: "Isolated",
  restoration_in_progress: "Restoring",
  restored_verified: "Restored",
  closed: "Closed",
};

export default function LototoScreen() {
  const { tokens } = useTheme();
  const [rows, setRows] = useState<IsolationCertificateListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIsolationCertificates()
      .then(setRows)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Isolations could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <PageHeader
        title="LOTOTO"
        description="Each certificate is one isolation. It can stand on its own, and a permit can use it later."
        back={{ label: "Home", href: "/" }}
      />
      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Isolations" count={loading ? undefined : rows.length} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {loading ? (
          <ActivityIndicator color={tokens.colors.primary} />
        ) : error ? null : rows.length === 0 ? (
          <EmptyState title="No isolations yet" body="Start an isolation from a published procedure." />
        ) : (
          rows.map((row) => (
            <Card
              key={row.certificate.id}
              accessibilityLabel={row.certificate.title}
              onPress={() => router.push(`/lototo/${row.certificate.id}`)}
            >
              <AppText variant="subheading">{row.certificate.title}</AppText>
              <ChipRow>
                <RefChip reference={row.certificate.certificateNumber} />
                <AppText variant="caption">{STATUS_LABELS[row.certificate.status] ?? row.certificate.status}</AppText>
              </ChipRow>
              <AppText variant="caption">{row.assetName || row.locationName || "Location"}</AppText>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
