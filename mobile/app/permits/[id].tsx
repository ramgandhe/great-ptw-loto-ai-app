import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, ChipRow, InfoList, PageHeader, PermitStatusChip, PermitTypeChip, ProgressBar, RefChip, Screen, ScreenState, SectionTitle } from "@/components/ui";
import { History, Lock, Pencil, Play } from "@/components/ui/icons";
import { formatDateTime, formatWindow } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { getProfile } from "@/lib/auth/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry, ApprovalReview } from "@/lib/approval/types";
import { getProfile } from "@/lib/auth/api";
import { getPermit } from "@/lib/permit/api";
import { getLocalPermitDraft, resolvePermitId } from "@/lib/permit/offline";
import { permitDetailToForm } from "@/lib/permit/form";
import { isEditablePermitStatus } from "@/lib/permit/status";
import type { PermitDetail } from "@/lib/permit/types";
import { useOrgNames } from "@/lib/permit/names";
import { useTheme } from "@/providers/theme-provider";

const APPROVAL_STATUSES = new Set([
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
]);

export default function PermitDetailScreen() {
  const { tokens } = useTheme();
  const names = useOrgNames();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [localTitle, setLocalTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [privileged, setPrivileged] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    // A permit created offline keeps its local id in links until its create syncs.
    resolvePermitId(id)
      .then(getPermit)
      .then(async (permitDetail) => {
        setDetail(permitDetail);
        const profile = await getProfile().catch(() => null);
        setUserId(profile?.id ?? null);
        setPrivileged(Boolean(profile?.roles.some((role) => role === "tenant-owner" || role === "tenant-admin" || role === "platform-admin")));
        if (APPROVAL_STATUSES.has(permitDetail.permit.status)) {
          const [reviewData, historyData] = await Promise.all([
            getApprovalReview(id).catch(() => null),
            getApprovalHistory(id).catch(() => [] as ApprovalHistoryEntry[]),
          ]);
          setReview(reviewData);
          setHistory(historyData);
        }
      })
      .catch(async (err) => {
        const local = await getLocalPermitDraft(id);
        if (local) {
          setLocalTitle(local.title);
          return;
        }
        setError(err instanceof ApiError ? err.message : "The permit could not be loaded.");
      });
  }, [id]);

  const back = { label: "Permits", href: "/permits" };

  if (error || (!detail && !localTitle)) {
    return <ScreenState error={error} back={back} />;
  }

  if (localTitle && !detail) {
    return (
      <Screen footer={<ActionBar><Button label="Edit draft" icon={Pencil} onPress={() => router.push(`/permits/${id}/edit`)} /></ActionBar>}>
        <PageHeader title={localTitle} back={back} />
        <Banner tone="warning" title="Saved on this phone">It is sent to the server when the connection returns; until then it has no reference.</Banner>
      </Screen>
    );
  }

  const permit = detail!.permit;
  const form = permitDetailToForm(detail!);
  const status = permit.status;
  const canEdit = isEditablePermitStatus(status);
  const isResubmit = status === "deferred" || status === "rejected";
  const completedStages = review?.workflow.filter((row) => row.assignment.status === "completed").length ?? 0;
  const totalStages = review?.workflow.length ?? 0;
  const type = names.permitType(permit.permitTypeId);
  const executable = ["approved", "active", "suspended"].includes(status);
  const released = Boolean(permit.executionReleasedAt);
  const isReceiver = Boolean(userId && (permit.submittedBy === userId || permit.createdBy === userId));
  const assigned = Boolean(userId && detail.executors.some((row) => row.workforceUserId === userId));

  return (
    <Screen
      footer={
        canEdit || executable ? (
          <ActionBar>
            {executable && (detail!.assets?.[0]?.assetId || permit.machineryId) ? (
              <Button
                label="LOTOTO"
                variant="outline"
                icon={Lock}
                onPress={() => router.push(`/lototo/new?assetId=${detail!.assets?.[0]?.assetId ?? permit.machineryId}`)}
              />
            ) : null}
            {canEdit ? (
              <Button label={isResubmit ? "Revise and resubmit" : "Edit draft"} icon={Pencil} color={isResubmit ? tokens.action.fix : undefined} onPress={() => router.push(`/permits/${id}/edit`)} />
            ) : null}
            {status === "approved" && !released && isReceiver ? (
              <Button label="Release for execution" onPress={() => router.push(`/execution/${id}`)} />
            ) : null}
            {status === "approved" && released && (assigned || privileged) ? (
              <Button label="Start work" icon={Play} onPress={() => router.push(`/execution/${id}`)} />
            ) : null}
            {executable && status !== "approved" ? (
              <Button label="Open work" icon={Play} onPress={() => router.push(`/execution/${id}`)} />
            ) : null}
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={permit.title} back={back}>
        <ChipRow>
          <PermitStatusChip status={status} />
          <RefChip reference={permit.reference} />
          {type ? <PermitTypeChip name={type.name} color={type.color} /> : null}
        </ChipRow>
      </PageHeader>

      {status === "approved" && !released ? (
        <Banner tone="warning">{isReceiver ? "Confirm the site checklist, then release this permit for execution." : "Waiting for the receiver to release this permit."}</Banner>
      ) : null}
      {status === "approved" && released ? (
        <Banner tone="success">Released for execution{permit.executionReleasedAt ? ` ${formatDateTime(permit.executionReleasedAt)}` : ""}.</Banner>
      ) : null}
      {status === "execution_completed" ? (
        <Banner tone="success">Work is complete and sent for review and closure.</Banner>
      ) : null}
      {status === "pending_closure" ? (
        <Banner tone="info">Verification is done and sent for sign-off.</Banner>
      ) : null}

      <Card accent={tokens.status[status]}>
        <InfoList
          rows={[
            ["Place", [permit.placePath, permit.exactSpot].filter(Boolean).join(" · ") || (form.workLocationId ? names.location(form.workLocationId) : "Not set")],
            ["When", formatWindow(permit.plannedStartAt, permit.plannedEndAt)],
            ["Work", permit.workScope],
            ["Hazards", `${detail!.hazards.length} identified`],
            ["Crew", `${detail!.executors.length} assigned`],
            ["Attachments", detail!.attachments.length ? `${detail!.attachments.length} files` : "None"],
          ]}
        />
      </Card>

      {review ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Approval" />
          <Card>
            <ProgressBar value={completedStages} total={totalStages} label={`${completedStages} of ${totalStages} approval stages complete`} />
            <Button label="Approval history" variant="ghost" size="sm" icon={History} onPress={() => router.push(`/approvals/${id}/history`)} style={{ alignSelf: "flex-start" }} />
          </Card>
        </View>
      ) : null}

      {!review && history.length > 0 ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Approval activity" />
          <Card>
            {history.slice(0, 2).map((entry) => (
              <View key={entry.id} style={{ gap: 2 }}>
                <AppText variant="body" weight="medium" style={{ textTransform: "capitalize" }}>{entry.action.replace(/_/g, " ")}</AppText>
                <AppText variant="caption">{formatDateTime(entry.createdAt)}</AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
