import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Card, EmptyState, PageHeader, Screen, ScreenState, TimelineItem } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { listProgress } from "@/lib/execution/api";
import type { ProgressRecord } from "@/lib/execution/types";
import { formatDateTime } from "@/lib/format";

export default function ProgressUpdatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [items, setItems] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permitId) {
      return;
    }
    listProgress(permitId)
      .then((records) => setItems(records.slice().reverse()))
      .catch((err) => setError(err instanceof ApiError ? err.message : "The progress updates could not be loaded."))
      .finally(() => setLoading(false));
  }, [permitId]);

  const back = { label: "Permit work", href: `/execution/${permitId}` };
  if (loading || error) {
    return <ScreenState error={error} back={back} />;
  }

  return (
    <Screen>
      <PageHeader title="Progress timeline" description="Newest first." back={back} />
      {items.length === 0 ? (
        <EmptyState title="No progress recorded yet" body="Each update saved while the work is in progress appears here." />
      ) : (
        <Card>
          {items.map((item, index) => (
            <TimelineItem key={item.id} title={item.summary} time={formatDateTime(item.recordedAt)} last={index === items.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
