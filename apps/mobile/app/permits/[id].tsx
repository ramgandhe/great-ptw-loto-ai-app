import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getApprovalHistory, getApprovalReview } from "@/lib/approval/api";
import type { ApprovalHistoryEntry, ApprovalReview } from "@/lib/approval/types";
import { getPermit } from "@/lib/permit/api";
import { getLocalPermitDraft } from "@/lib/permit/offline";
import { permitDetailToForm } from "@/lib/permit/form";
import { isEditablePermitStatus } from "@/lib/permit/status";
import type { PermitDetail } from "@/lib/permit/types";

const APPROVAL_STATUSES = new Set([
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
]);

export default function PermitDetailScreen() {
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

    getPermit(id)
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
        setError(err instanceof ApiError ? err.message : "Failed to load permit");
      });
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!detail && !localTitle) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (localTitle && !detail) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{localTitle}</Text>
        <Text style={styles.meta}>Local offline draft — awaiting sync</Text>
        <Pressable style={styles.button} onPress={() => router.push(`/permits/${id}/edit`)}>
          <Text style={styles.buttonText}>Edit draft</Text>
        </Pressable>
      </View>
    );
  }

  const form = permitDetailToForm(detail!);
  const status = detail!.permit.status;
  const canEdit = isEditablePermitStatus(status);
  const isResubmit = status === "deferred" || status === "rejected";
  const completedStages = review?.workflow.filter((row) => row.assignment.status === "completed").length ?? 0;
  const totalStages = review?.workflow.length ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{detail!.permit.title}</Text>
      <Text style={styles.meta}>
        {detail!.permit.reference ?? "Draft"} · {status.replace(/_/g, " ")}
      </Text>
      <Text style={styles.line}>Location: {form.locationId || "—"}</Text>
      <Text style={styles.line}>Hazards: {detail!.hazards.length}</Text>
      <Text style={styles.line}>Executors: {detail!.executors.length}</Text>
      <Text style={styles.line}>Attachments: {detail!.attachments.length}</Text>

      {review ? (
        <View style={styles.approvalBox}>
          <Text style={styles.sectionTitle}>Approval progress</Text>
          <Text style={styles.line}>
            {completedStages} of {totalStages} stages complete
          </Text>
          <Pressable onPress={() => router.push(`/approvals/${id}/history`)}>
            <Text style={styles.link}>View approval history</Text>
          </Pressable>
        </View>
      ) : null}

      {!review && history.length > 0 ? (
        <View style={styles.approvalBox}>
          <Text style={styles.sectionTitle}>Approval activity</Text>
          {history.slice(0, 2).map((entry) => (
            <Text key={entry.id} style={styles.line}>
              {entry.action.replace(/_/g, " ")} · {new Date(entry.createdAt).toLocaleString()}
            </Text>
          ))}
        </View>
      ) : null}

      {canEdit ? (
        <Pressable style={styles.button} onPress={() => router.push(`/permits/${id}/edit`)}>
          <Text style={styles.buttonText}>{isResubmit ? "Revise & resubmit" : "Edit draft"}</Text>
        </Pressable>
      ) : null}
      {["approved", "active", "suspended"].includes(status) ? (
        <Pressable style={styles.button} onPress={() => router.push(`/execution/${id}`)}>
          <Text style={styles.buttonText}>
            {status === "approved" ? "Start execution" : "Open execution"}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  meta: { color: "#666", marginBottom: 8 },
  line: { fontSize: 14, color: "#374151" },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  approvalBox: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    gap: 4,
  },
  link: { color: "#2563eb", fontSize: 14, marginTop: 4 },
  button: {
    marginTop: 16,
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
});
