import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

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
        setError(err instanceof ApiError ? err.message : "Failed to load conflict");
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
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  const status = detail?.conflict.status;
  const isResolved = status === "approved" || status === "rejected";

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: tokens.colors.primary, marginBottom: 8 }}>Back</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {queuedMessage ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginBottom: 8 }}>{queuedMessage}</Text>
      ) : null}

      {detail ? (
        <>
          <Text style={[styles.title, { color: tokens.colors.foreground }]}>Conflict review</Text>
          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{detail.conflict.summary}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {detail.conflict.status.replace(/_/g, " ")} · {detail.conflict.severity} severity
            </Text>
          </View>

          {detail.participants.map((participant) => (
            <View key={participant.id} style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{participant.permit.title}</Text>
              <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                {formatDate(participant.permit.plannedStartAt)} → {formatDate(participant.permit.plannedEndAt)}
              </Text>
            </View>
          ))}

          {!isResolved && !detail.assessment ? (
            <View style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Assessment</Text>
              <TextInput
                style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
                multiline
                value={riskSummary}
                onChangeText={setRiskSummary}
                placeholder="Describe operational risk"
                placeholderTextColor={tokens.colors.mutedForeground}
              />
              <Pressable
                style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
                onPress={async () => {
                  const payload = {
                    assessedSeverity: detail.conflict.severity,
                    riskSummary: riskSummary.trim(),
                  };
                  if (!isOnline) {
                    await queueOfflineAssess(detail.conflict.id, payload);
                    setQueuedMessage("Assessment queued for sync");
                    return;
                  }
                  await runAction(() => assessSimopsConflict(detail.conflict.id, payload));
                }}
              >
                <Text style={styles.primaryButtonText}>Save assessment</Text>
              </Pressable>
            </View>
          ) : null}

          {!isResolved && detail.assessment && status === "assessed" ? (
            <View style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Mitigation</Text>
              <TextInput
                style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
                multiline
                value={planSummary}
                onChangeText={setPlanSummary}
                placeholder="Plan summary"
                placeholderTextColor={tokens.colors.mutedForeground}
              />
              <TextInput
                style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
                multiline
                value={actionDescription}
                onChangeText={setActionDescription}
                placeholder="Primary action"
                placeholderTextColor={tokens.colors.mutedForeground}
              />
              <Pressable
                style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
                onPress={async () => {
                  const payload = {
                    planSummary: planSummary.trim(),
                    actions: [{ description: actionDescription.trim() }],
                  };
                  if (!isOnline) {
                    await queueOfflineMitigation(detail.conflict.id, payload);
                    setQueuedMessage("Mitigation queued for sync");
                    return;
                  }
                  await runAction(() => createMitigationPlan(detail.conflict.id, payload));
                }}
              >
                <Text style={styles.primaryButtonText}>Save mitigation</Text>
              </Pressable>
            </View>
          ) : null}

          {!isResolved && status === "mitigation_planned" ? (
            <View style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Approve</Text>
              <TextInput
                style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
                multiline
                value={comments}
                onChangeText={setComments}
                placeholder="Approval comments"
                placeholderTextColor={tokens.colors.mutedForeground}
              />
              <Pressable
                style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
                onPress={async () => {
                  if (!isOnline) {
                    await queueOfflineApprove(detail.conflict.id, comments.trim());
                    setQueuedMessage("Approval queued for sync");
                    return;
                  }
                  await runAction(() => approveSimopsConflict(detail.conflict.id, comments.trim()));
                }}
              >
                <Text style={styles.primaryButtonText}>Approve conflict</Text>
              </Pressable>
            </View>
          ) : null}

          {!isResolved ? (
            <View style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={{ color: "#b91c1c", fontWeight: "600" }}>Reject</Text>
              <TextInput
                style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
                multiline
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Rejection reason"
                placeholderTextColor={tokens.colors.mutedForeground}
              />
              <Pressable
                style={[styles.primaryButton, { backgroundColor: "#b91c1c" }]}
                onPress={async () => {
                  if (!isOnline) {
                    await queueOfflineReject(detail.conflict.id, rejectReason.trim());
                    setQueuedMessage("Rejection queued for sync");
                    return;
                  }
                  await runAction(() => rejectSimopsConflict(detail.conflict.id, rejectReason.trim()));
                }}
              >
                <Text style={styles.primaryButtonText}>Reject conflict</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: tokens.colors.mutedForeground }}>
              Resolved: {detail.resolution?.outcome} — {detail.resolution?.comments}
            </Text>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8, gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 72, textAlignVertical: "top" },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
});
