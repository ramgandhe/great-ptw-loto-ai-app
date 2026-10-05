import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, ChipRow, InfoList, PageHeader, PermitStatusChip, PermitTypeChip, ProgressBar, RefChip, Screen, ScreenState, SectionTitle } from "@/components/ui";
import { History, Lock, Pencil, Play } from "@/components/ui/icons";
import { formatDateTime, formatWindow } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry, ApprovalReview } from "@/lib/approval/types";
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

  useEffect(() => {
    if (!id) {
      return;
    }

    // A permit created offline keeps its local id in links until its create syncs.
    resolvePermitId(id)
      .then(getPermit)
      .then(async (permitDetail) => {
        setDetail(permitDetail);
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

  return (
    <Screen
      footer={
        canEdit || executable ? (
          <ActionBar>
            {executable && permit.machineryId ? (
              <Button label="LOTOTO" variant="outline" icon={Lock} onPress={() => router.push(`/lototo/new?machineryId=${permit.machineryId}`)} />
            ) : null}
            {canEdit ? (
              <Button label={isResubmit ? "Revise and resubmit" : "Edit draft"} icon={Pencil} color={isResubmit ? tokens.action.fix : undefined} onPress={() => router.push(`/permits/${id}/edit`)} />
            ) : null}
            {executable ? <Button label={status === "approved" ? "Start work" : "Open work"} icon={Play} onPress={() => router.push(`/execution/${id}`)} /> : null}
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

      <Card accent={tokens.status[status]}>
        <InfoList
          rows={[
            ["Place", form.locationId ? names.location(form.locationId) : "Not set"],
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
