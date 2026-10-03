import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

type ActionMode = "approve" | "reject" | "defer" | null;

export default function PermitApprovalReviewScreen() {
  const styles = useThemedStyles(createStyles);
  const names = useOrgNames();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stageEdits, setStageEdits] = useState<StageAnswerEdits>({});
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
        setError(err instanceof ApiError ? err.message : "Failed to load permit review");
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
    if (commentRequired(mode) && !comment.trim()) {
      Alert.alert("Comment required", "Please enter a comment before continuing.");
      return;
    }

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
      Alert.alert("Action failed", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !review) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Permit not found"}</Text>
      </View>
    );
  }

  const form = permitDetailToForm(review);
  const completedStages = review.workflow.filter((row) => row.assignment.status === "completed").length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{review.permit.title}</Text>
      <Text style={styles.meta}>
        {review.permit.reference ?? "No reference yet"} ·{" "}
        {review.permit.status.replace(/_/g, " ")}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Approval progress</Text>
        <Text style={styles.meta}>
          {completedStages} of {review.workflow.length} stages complete
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workflow</Text>
        {review.workflow.map(({ assignment, step }) => (
          <View key={assignment.id} style={styles.workflowRow}>
            <Text style={styles.workflowTitle}>
              {step.stepSequence}. {step.name}
            </Text>
            <Text style={styles.meta}>{assignment.status.replace(/_/g, " ")}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.meta}>Work scope: {form.workScope || "—"}</Text>
        <Text style={styles.meta}>Location: {names.location(form.locationId)}</Text>
        <Text style={styles.meta}>Hazards: {form.hazards.filter((h) => h.hazardCategoryId).length}</Text>
        <Text style={styles.meta}>
          Attachments: {review.attachments.length}
        </Text>
      </View>

      <Pressable style={styles.linkButton} onPress={() => router.push(`/approvals/${id}/history`)}>
        <Text style={styles.linkButtonText}>View approval history</Text>
      </Pressable>

      {canAct ? (
        <View style={styles.actions}>
          {!actionMode ? (
            <>
              <Pressable style={styles.primaryButton} onPress={() => setActionMode("approve")}>
                <Text style={styles.primaryButtonText}>Approve</Text>
              </Pressable>
              <Pressable style={styles.destructiveButton} onPress={() => setActionMode("reject")}>
                <Text style={styles.destructiveButtonText}>Reject</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setActionMode("defer")}>
                <Text style={styles.secondaryButtonText}>Defer</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.commentBox}>
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
                  {stageAnswersLeft(review.permit.formResponses ?? [], "approval", stageEdits) > 0 ? (
                    <Text style={styles.meta}>
                      {`${stageAnswersLeft(review.permit.formResponses ?? [], "approval", stageEdits)} left to sign. The final approval needs them.`}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Text style={styles.sectionTitle}>
                {actionMode === "approve"
                  ? "Approval comment"
                  : actionMode === "reject"
                    ? "Rejection reason"
                    : "Clarification request"}
                {commentRequired(actionMode) ? " (required)" : ""}
              </Text>
              <TextInput
                style={styles.textInput}
                multiline
                value={comment}
                onChangeText={setComment}
                placeholder="Enter comment..."
              />
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  disabled={submitting}
                  onPress={() => {
                    setActionMode(null);
                    setComment("");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={actionMode === "reject" ? styles.destructiveButton : styles.primaryButton}
                  disabled={submitting}
                  onPress={() => void submitAction(actionMode)}
                >
                  <Text
                    style={
                      actionMode === "reject"
                        ? styles.destructiveButtonText
                        : styles.primaryButtonText
                    }
                  >
                    {submitting ? "Submitting..." : "Confirm"}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  title: { fontSize: 22, fontWeight: "600", color: c.foreground },
  meta: { fontSize: 13, color: c.mutedForeground },
  section: { gap: 6, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: c.foreground },
  workflowRow: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  workflowTitle: { fontSize: 14, fontWeight: "500", color: c.foreground },
  linkButton: { marginTop: 8 },
  linkButtonText: { color: c.primary, fontWeight: "500" },
  actions: { marginTop: 16, gap: 8 },
  primaryButton: {
    backgroundColor: c.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: { color: c.primaryForeground, fontWeight: "600" },
  destructiveButton: {
    backgroundColor: c.dangerBg,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  destructiveButtonText: { color: c.danger, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: { color: c.foreground, fontWeight: "600" },
  commentBox: { gap: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    minHeight: 96,
    padding: 10,
    textAlignVertical: "top",
  },
  actionRow: { flexDirection: "row", gap: 8 },
  error: { color: c.danger },
});
