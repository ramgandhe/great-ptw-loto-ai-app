import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Card, EmptyState, PageHeader, Screen, ScreenState, TimelineItem } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { getPlanHistory } from "@/lib/restoration/api";
import type { LototoHistoryEntry } from "@/lib/restoration/types";

/** "lototo.lock.applied" → "Lock applied". */
const describe = (action: string) => {
  const parts = action.split(".");
  const words = (parts.length > 1 ? parts.slice(1) : parts).join(" ").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export default function LototoHistoryScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [entries, setEntries] = useState<LototoHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      return;
    }
    getPlanHistory(planId)
      .then(setEntries)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The history could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, [planId]);

  const back = { label: "LOTOTO", href: "/lototo" };
  if (loading || error) {
    return <ScreenState error={error} back={back} />;
  }

  return (
    <Screen>
      <PageHeader title="LOTOTO history" description="Every lock, tag, verification and restoration on this plan." back={back} />
      {entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" body="Steps appear here as the plan is isolated and restored." />
      ) : (
        <Card>
          {entries.map((entry, index) => (
            <TimelineItem key={entry.id} title={describe(entry.action)} time={formatDateTime(entry.occurredAt)} last={index === entries.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
