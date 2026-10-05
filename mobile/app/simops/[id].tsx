import { useCallback, useEffect, useState } from "react";
import { sharedWindow } from "@/lib/simops/overlap";
import { View } from "react-native";
import { AppText, Banner, Button, Card, ChipRow, PageHeader, PermitStatusChip, RefChip, SafetyStatusChip, Screen, ScreenState, SectionTitle, SeverityChip, TextField } from "@/components/ui";
import { Ban, Check, Clock } from "@/components/ui/icons";
import { formatDateTime, formatWindow } from "@/lib/format";
import { CONFLICT_STATUS } from "@/lib/safety-status";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  approveSimopsConflict,
  assessSimopsConflict,
  createMitigationPlan,
  getSimopsConflict,
  rejectSimopsConflict,
} from "@/lib/simops/api";
import type { ConflictDetail } from "@/lib/simops/types";
import {
  queueOfflineApprove,
  queueOfflineAssess,
  queueOfflineMitigation,
  queueOfflineReject,
} from "@/lib/simops/offline";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function SimopsConflictDetailScreen() {
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ConflictDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskSummary, setRiskSummary] = useState("");
  const [planSummary, setPlanSummary] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [comments, setComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  // Rejecting suspends every permit in the clash, so its form opens only on request.
  const [rejecting, setRejecting] = useState(false);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return getSimopsConflict(id)
      .then((data) => {
        setDetail(data);
        setRiskSummary(data.assessment?.riskSummary ?? "");
        setPlanSummary(data.mitigation?.planSummary ?? "");
        setActionDescription(data.mitigation?.actions[0]?.description ?? "");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The clash could not be loaded.");
      });
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function runAction(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work. Try again.");
    }
  }

  const back = { label: "Work clashes", href: "/simops" };
  if (loading || !detail) {
    return <ScreenState error={loading ? null : error} back={back} />;
  }

  const status = detail.conflict.status;
  const isResolved = status === "approved" || status === "rejected";
  const overlap = sharedWindow(detail.participants);
  const c = tokens.colors;

  return (
    <Screen>
      <PageHeader title={detail.conflict.summary} back={back}>
        <ChipRow>
          <SafetyStatusChip map={CONFLICT_STATUS} status={status} />
          <SeverityChip severity={detail.conflict.severity} />
        </ChipRow>
        <AppText variant="caption" style={{ textTransform: "capitalize" }}>{`${detail.conflict.conflictType.replace(/_/g, " ")} clash`}</AppText>
      </PageHeader>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {queuedMessage ? <Banner tone="warning" title="Saved on this phone">{queuedMessage}</Banner> : null}

      <Banner tone={overlap ? "warning" : "info"} title={overlap ? "Overlap" : "No time overlap"}>
        {overlap ? `${formatDateTime(overlap.start)} to ${formatDateTime(overlap.end)}` : "The planned windows do not overlap, or one is not scheduled."}
      </Banner>

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Permits in this clash" count={detail.participants.length} />
        {detail.participants.map((participant) => (
          <Card key={participant.id} accent={tokens.status[participant.permit.status]} onPress={() => router.push(`/permits/${participant.permit.id}`)} accessibilityLabel={participant.permit.title}>
            <AppText variant="subheading">{participant.permit.title}</AppText>
            <ChipRow>
              <PermitStatusChip status={participant.permit.status} />
              <RefChip reference={participant.permit.reference} />
            </ChipRow>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Clock size={14} color={c.mutedForeground} />
              <AppText variant="caption">{formatWindow(participant.permit.plannedStartAt, participant.permit.plannedEndAt)}</AppText>
            </View>
          </Card>
        ))}
      </View>

      {!isResolved && !detail.assessment ? (
        <Card style={{ gap: tokens.space[3] }}>
          <AppText variant="title">1. Assess the risk</AppText>
          <TextField label="Operational risk" multiline value={riskSummary} onChangeText={setRiskSummary} placeholder="What could go wrong when both jobs run" />
          <Button
            label="Save assessment"
            disabled={!riskSummary.trim()}
            style={{ alignSelf: "flex-start" }}
            onPress={async () => {
              const payload = { assessedSeverity: detail.conflict.severity, riskSummary: riskSummary.trim() };
              if (!isOnline) {
                await queueOfflineAssess(detail.conflict.id, payload);
                setQueuedMessage("Assessment saved on this phone; not recorded until the server confirms it.");
                return;
              }
              await runAction(() => assessSimopsConflict(detail.conflict.id, payload));
            }}
          />
        </Card>
      ) : null}

      {!isResolved && detail.assessment && status === "assessed" ? (
        <Card style={{ gap: tokens.space[3] }}>
          <AppText variant="title">2. Plan the mitigation</AppText>
          <TextField label="Plan" multiline value={planSummary} onChangeText={setPlanSummary} placeholder="How both jobs are kept safe" />
          <TextField label="First action" multiline value={actionDescription} onChangeText={setActionDescription} placeholder="For example: stagger the start by two hours" />
          <Button
            label="Save mitigation"
            disabled={!planSummary.trim()}
            style={{ alignSelf: "flex-start" }}
            onPress={async () => {
              const payload = { planSummary: planSummary.trim(), actions: [{ description: actionDescription.trim() }] };
              if (!isOnline) {
                await queueOfflineMitigation(detail.conflict.id, payload);
                setQueuedMessage("Mitigation plan saved on this phone; not recorded until the server confirms it.");
                return;
              }
              await runAction(() => createMitigationPlan(detail.conflict.id, payload));
            }}
          />
        </Card>
      ) : null}

      {!isResolved && status === "mitigation_planned" ? (
        <Card style={{ gap: tokens.space[3] }}>
          <AppText variant="title">3. Approve</AppText>
          <TextField label="Comments" multiline value={comments} onChangeText={setComments} placeholder="Optional" />
          <Button
            label="Approve"
            icon={Check}
            color={c.success}
            style={{ alignSelf: "flex-start" }}
            onPress={async () => {
              if (!isOnline) {
                await queueOfflineApprove(detail.conflict.id, comments.trim());
                setQueuedMessage("Approval saved on this phone; nothing is approved until the server confirms it.");
                return;
              }
              await runAction(() => approveSimopsConflict(detail.conflict.id, comments.trim()));
            }}
          />
        </Card>
      ) : null}

      {isResolved ? (
        <Banner tone={status === "approved" ? "success" : "danger"} title={`Resolved: ${detail.resolution?.outcome ?? status}`}>
          {detail.resolution?.comments ?? ""}
        </Banner>
      ) : rejecting ? (
        <Card accent={c.danger} style={{ gap: tokens.space[3] }}>
          <AppText variant="subheading" tone="danger">Reject: every permit in this clash is suspended</AppText>
          <TextField label="Why it is rejected" required multiline value={rejectReason} onChangeText={setRejectReason} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
            <Button
              label="Reject and suspend permits"
              variant="danger"
              icon={Ban}
              disabled={!rejectReason.trim()}
              onPress={async () => {
                if (!isOnline) {
                  await queueOfflineReject(detail.conflict.id, rejectReason.trim());
                  setQueuedMessage("Rejection saved on this phone. Nothing is suspended until the server confirms it.");
                  return;
                }
                await runAction(() => rejectSimopsConflict(detail.conflict.id, rejectReason.trim()));
              }}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setRejecting(false)} />
          </View>
        </Card>
      ) : (
        <Button label="Reject and suspend permits…" variant="danger" icon={Ban} onPress={() => setRejecting(true)} style={{ alignSelf: "flex-start" }} />
      )}
    </Screen>
  );
}
