import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { AppText, Card, ChipRow, EmptyState, PageHeader, PermitStatusChip, Screen, ScreenState, TimelineItem } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry } from "@/lib/approval/types";
import { formatDateTime } from "@/lib/format";
import { useTheme } from "@/providers/theme-provider";

const sentence = (text: string) => text.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export default function ApprovalHistoryScreen() {
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([getApprovalReview(id), getApprovalHistory(id)])
      .then(([review, entries]) => {
        setTitle(review.permit.title);
        setHistory(entries);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The approval history could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const back = { label: "Review", href: `/approvals/${id}` };
  if (loading || error) {
    return <ScreenState error={error} back={back} />;
  }

  return (
    <Screen>
      <PageHeader title="Approval history" description={title} back={back} />
      {history.length === 0 ? (
        <EmptyState title="No decisions yet" body="Each approval, deferral and rejection is recorded here." />
      ) : (
        <Card>
          {history.map((item, index) => (
            <TimelineItem
              key={item.id}
              title={sentence(item.action)}
              time={formatDateTime(item.createdAt)}
              color={item.toStatus ? tokens.status[item.toStatus] : undefined}
              last={index === history.length - 1}
            >
              {item.toStatus ? (
                <ChipRow>
                  <PermitStatusChip status={item.toStatus} />
                </ChipRow>
              ) : null}
              {item.comment ? <AppText variant="body" tone="secondary" style={{ fontStyle: "italic" }}>{`“${item.comment}”`}</AppText> : null}
            </TimelineItem>
          ))}
        </Card>
      )}
    </Screen>
  );
}
