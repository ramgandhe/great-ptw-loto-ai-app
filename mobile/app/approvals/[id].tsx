import { useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ActionBar, AppText, Banner, Button, Card, ChipRow, ChoiceGroup, InfoList, PageHeader, PermitStatusChip, PermitTypeChip, ProgressBar, RefChip, Screen, ScreenState, SectionTitle, TextField } from "@/components/ui";
import { Check, History } from "@/components/ui/icons";
import { formatWindow } from "@/lib/format";
import { ApiError } from "@/lib/api";
import {
  approvePermit,
  deferPermit,
  getApprovalReview,
  rejectPermit,
} from "@/lib/approval/api";
import type { ApprovalReview } from "@/lib/approval/types";
import { permitDetailToForm } from "@/lib/permit/form";
import { stageAnswersLeft, stageAnswersPayload, type StageAnswerEdits } from "@/lib/permit/forms";
import { StageAnswers, useSignerName } from "@/components/permit/stage-answers";
import { useOrgNames } from "@/lib/permit/names";
import { useTheme } from "@/providers/theme-provider";

type ActionMode = "approve" | "reject" | "defer" | null;

export default function PermitApprovalReviewScreen() {
  const { tokens } = useTheme();
  const names = useOrgNames();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stageEdits, setStageEdits] = useState<StageAnswerEdits>({});
  const [commentError, setCommentError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const signerName = useSignerName();

  useEffect(() => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    getApprovalReview(id)
      .then(setReview)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "The permit could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const canAct = review?.permit.status === "pending_approval" && review.activeAssignment !== null;
  const activeStep = review?.activeAssignment?.step;

  function commentRequired(mode: ActionMode): boolean {
    if (!activeStep || !mode) {
      return false;
    }
    if (mode === "approve") {
      return activeStep.commentRequiredOnApprove;
    }
    if (mode === "reject") {
      return activeStep.commentRequiredOnReject;
    }
    return activeStep.commentRequiredOnDefer;
  }

  async function submitAction(mode: ActionMode) {
    if (!id || !mode) {
      return;
    }
    setActionError(null);
    if (commentRequired(mode) && !comment.trim()) {
      setCommentError("A comment is required for this decision.");
      return;
    }
    setCommentError(null);

    setSubmitting(true);
    try {
      let updated: ApprovalReview;
      if (mode === "approve") {
        updated = await approvePermit(id, comment, review ? stageAnswersPayload(stageEdits, review.permit.draftRevision) : undefined);
      } else if (mode === "reject") {
        updated = await rejectPermit(id, comment);
      } else {
        updated = await deferPermit(id, comment);
      }

      setReview(updated);
      setActionMode(null);
      setComment("");
      setStageEdits({});

      if (mode !== "approve" || updated.permit.status !== "pending_approval") {
        router.replace("/approvals");
      }
    } catch (err) {
      // Someone changed or signed the permit meanwhile: reload it and keep this person's entries.
      if (err instanceof ApiError && err.status === 409) {
        getApprovalReview(id).then(setReview, () => undefined);
      }
      setActionError(err instanceof ApiError ? err.message : "The decision could not be saved. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const back = { label: "Approvals", href: "/approvals" };
  if (loading || error || !review) {
    return <ScreenState error={loading ? null : (error ?? "This permit was not found.")} back={back} />;
  }

  const form = permitDetailToForm(review);
  const completedStages = review.workflow.filter((row) => row.assignment.status === "completed").length;
  const type = names.permitType(review.permit.permitTypeId);
  const c = tokens.colors;
  const DECISIONS = [
    { mode: "approve" as const, label: "Approve", color: c.success },
    { mode: "defer" as const, label: "Defer", color: c.warning },
    { mode: "reject" as const, label: "Reject", color: c.danger },
  ];
  const chosen = DECISIONS.find((d) => d.mode === actionMode);
  const signaturesLeft = stageAnswersLeft(review.permit.formResponses ?? [], "approval", stageEdits);

  return (
    <Screen
      footer={
        canAct && chosen ? (
          <ActionBar>
            <Button
              label="Cancel"
              variant="secondary"
              disabled={submitting}
              onPress={() => {
                setActionMode(null);
                setComment("");
                setCommentError(null);
              }}
            />
            <Button label={chosen.label} color={chosen.color} loading={submitting} onPress={() => void submitAction(actionMode)} />
          </ActionBar>
        ) : undefined
      }
    >
      <PageHeader title={review.permit.title} back={back}>
        <ChipRow>
          <PermitStatusChip status={review.permit.status} />
          <RefChip reference={review.permit.reference} />
          {type ? <PermitTypeChip name={type.name} color={type.color} /> : null}
        </ChipRow>
      </PageHeader>

      <Card>
        <InfoList
          rows={[
            ["Work", form.workScope || "Not described"],
            ["Place", names.location(form.locationId)],
            ["When", formatWindow(review.permit.plannedStartAt, review.permit.plannedEndAt)],
            ["Hazards", `${form.hazards.filter((h) => h.hazardCategoryId).length} identified`],
            ["Attachments", review.attachments.length ? `${review.attachments.length} files` : "None"],
          ]}
        />
      </Card>

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Approval stages" action={<Button label="History" variant="ghost" size="sm" icon={History} onPress={() => router.push(`/approvals/${id}/history`)} />} />
        <Card>
          <ProgressBar value={completedStages} total={review.workflow.length} label={`${completedStages} of ${review.workflow.length} stages complete`} />
          {review.workflow.map(({ assignment, step }) => {
            const done = assignment.status === "completed";
            const active = review.activeAssignment?.assignment.id === assignment.id;
            const dot = done ? c.success : active ? c.primaryFill : c.inputBorder;
            return (
              <View key={assignment.id} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], minHeight: 44 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: done || active ? dot : "transparent", borderWidth: done || active ? 0 : 2, borderColor: dot }}>
                  {done ? <Check size={14} color={c.card} strokeWidth={3} /> : <AppText variant="label" maxFontSizeMultiplier={1.2} style={{ color: active ? c.primaryForeground : c.mutedForeground, fontSize: tokens.text.xs }}>{step.stepSequence}</AppText>}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight={active ? "semibold" : "medium"}>{step.name}</AppText>
                  <AppText variant="caption" style={{ textTransform: "capitalize" }}>{active ? "Waiting for a decision" : assignment.status.replace(/_/g, " ")}</AppText>
                </View>
              </View>
            );
          })}
        </Card>
      </View>

      {canAct ? (
        <View style={{ gap: tokens.space[3] }}>
          <SectionTitle title="Your decision" description={activeStep ? `Stage: ${activeStep.name}` : undefined} />
          <Card style={{ gap: tokens.space[4] }}>
            <ChoiceGroup
              fill
              options={DECISIONS.map((d) => ({ key: d.mode, label: d.label, color: d.color }))}
              value={actionMode}
              disabled={submitting}
              onChange={(mode) => {
                setActionMode(mode);
                setCommentError(null);
                setActionError(null);
              }}
            />
            {actionMode === "approve" ? (
              <>
                <StageAnswers
                  responses={review.permit.formResponses ?? []}
                  stage="approval"
                  edits={stageEdits}
                  onChange={setStageEdits}
                  signerName={signerName}
                  disabled={submitting}
                />
                {signaturesLeft > 0 ? <AppText variant="caption" tone="warning" weight="semibold">{`${signaturesLeft} left to sign. The final approval needs them.`}</AppText> : null}
              </>
            ) : null}
            {actionMode ? (
              <TextField
                label={actionMode === "approve" ? "Approval comment" : actionMode === "reject" ? "Why it is rejected" : "What needs clarifying"}
                required={commentRequired(actionMode)}
                multiline
                value={comment}
                onChangeText={(text) => {
                  setComment(text);
                  if (text.trim()) setCommentError(null);
                }}
                error={commentError}
                placeholder={commentRequired(actionMode) ? "Required for this decision" : "Optional"}
              />
            ) : (
              <AppText variant="caption">Choose a decision to continue.</AppText>
            )}
            {actionError ? <Banner tone="danger">{actionError}</Banner> : null}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
