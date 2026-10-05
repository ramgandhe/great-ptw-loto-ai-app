import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { AppText, Banner, Card, ChipRow, EmptyState, PageHeader, PermitStatusChip, RefChip, Screen, SearchField } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { listArchivedPermits } from "@/lib/closure/api";
import type { ArchivedPermitSummary } from "@/lib/closure/types";
import { formatDateTime } from "@/lib/format";
import { useTheme } from "@/providers/theme-provider";

export default function ClosureArchiveScreen() {
  const { tokens } = useTheme();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ArchivedPermitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadArchive = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listArchivedPermits(search));
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The archive could not be searched.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  return (
    <Screen>
      <PageHeader title="Archive" description="Closed permits, kept as they were. Search, then press enter." back={{ label: "Closure", href: "/closure" }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Reference or title" onSubmit={() => void loadArchive(query.trim() || undefined)} />
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : hasLoaded && items.length === 0 ? (
        <EmptyState title={query.trim() ? "No closed permits match" : "No closed permits yet"} body={query.trim() ? "Try another reference or title." : "Permits appear here once they are closed."} />
      ) : (
        items.map((item) => (
          <Card key={item.permit.id} accent={tokens.status.closed} onPress={() => router.push(`/closure/archive/${item.permit.id}`)} accessibilityLabel={item.permit.title}>
            <AppText variant="subheading">{item.permit.title}</AppText>
            <ChipRow>
              <PermitStatusChip status={item.permit.status} />
              <RefChip reference={item.permit.reference} />
            </ChipRow>
            <AppText variant="caption">{`Closed ${formatDateTime(item.closedAt)}`}</AppText>
          </Card>
        ))
      )}
    </Screen>
  );
}
