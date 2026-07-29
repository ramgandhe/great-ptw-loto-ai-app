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

type ActionMode = "approve" | "reject" | "defer" | null;

export default function PermitApprovalReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [review, setReview] = useState<ApprovalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        updated = await approvePermit(id, comment);
      } else if (mode === "reject") {
        updated = await rejectPermit(id, comment);
      } else {
        updated = await deferPermit(id, comment);
      }

      setReview(updated);
      setActionMode(null);
      setComment("");

      if (mode !== "approve" || updated.permit.status !== "pending_approval") {
        router.replace("/approvals");
      }
    } catch (err) {
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
        {review.permit.reference ?? review.permit.id.slice(0, 8)} ·{" "}
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
        <Text style={styles.meta}>Location: {form.locationId || "—"}</Text>
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

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  title: { fontSize: 22, fontWeight: "600" },
  meta: { fontSize: 13, color: "#666" },
  section: { gap: 6, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  workflowRow: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  workflowTitle: { fontSize: 14, fontWeight: "500" },
  linkButton: { marginTop: 8 },
  linkButtonText: { color: "#2563eb", fontWeight: "500" },
  actions: { marginTop: 16, gap: 8 },
  primaryButton: {
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  destructiveButton: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  destructiveButtonText: { color: "#b91c1c", fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "600" },
  commentBox: { gap: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    minHeight: 96,
    padding: 10,
    textAlignVertical: "top",
  },
  actionRow: { flexDirection: "row", gap: 8 },
  error: { color: "#b91c1c" },
});
