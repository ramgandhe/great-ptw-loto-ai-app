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
  continuePermit,
  createHandover,
  createRenewal,
  listDailyActivityHistory,
  listDailyProgress,
  listHandovers,
  listRevalidationHistory,
  recordDailyProgress,
  requestExtension,
  revalidatePermit,
  suspendPermitForRevalidation,
} from "@/lib/multi-day/api";
import {
  queueOfflineDailyProgress,
  queueOfflineExtensionRequest,
  queueOfflineHandover,
  queueOfflineRenewalCreate,
  queueOfflineRevalidation,
} from "@/lib/multi-day/offline";
import type { RevalidationOutcome } from "@/lib/multi-day/types";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";
import { listWorkforceDirectory } from "@/lib/workforce/api";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function MultiDayPermitScreen() {
  const { permitId } = useLocalSearchParams<{ permitId: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();

  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [directory, setDirectory] = useState<WorkforceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [operationalDate, setOperationalDate] = useState(todayIsoDate());
  const [completedWork, setCompletedWork] = useState("");
  const [pendingWork, setPendingWork] = useState("");
  const [summary, setSummary] = useState("");

  const [incomingUserId, setIncomingUserId] = useState("");
  const [completedActivities, setCompletedActivities] = useState("");
  const [outstandingWork, setOutstandingWork] = useState("");
  const [safetyObservations, setSafetyObservations] = useState("");

  const [revalidationOutcome, setRevalidationOutcome] = useState<RevalidationOutcome>("passed");
  const [findings, setFindings] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [requestedEndAt, setRequestedEndAt] = useState("");
  const [justification, setJustification] = useState("");

  const load = useCallback(async () => {
    if (!permitId) return;
    const permitDetail = await getPermit(permitId);
    setDetail(permitDetail);
    if (["active", "suspended"].includes(permitDetail.permit.status)) {
      await Promise.all([
        listDailyProgress(permitId),
        listHandovers(permitId),
        listDailyActivityHistory(permitId),
        listRevalidationHistory(permitId),
      ]);
    }
  }, [permitId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([load(), listWorkforceDirectory().then(setDirectory).catch(() => setDirectory([]))])
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  async function runAction(action: () => Promise<void>, success: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
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

  if (!detail || !permitId) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <Text style={{ color: "#b91c1c" }}>{error ?? "Permit not found"}</Text>
      </View>
    );
  }

  const canManage = ["active", "suspended"].includes(detail.permit.status);
  const inputStyle = [
    styles.input,
    { borderColor: tokens.colors.border, color: tokens.colors.foreground },
  ];

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: tokens.colors.primary, marginBottom: 8 }}>Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Multi-day operations</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>{detail.permit.title}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={{ color: tokens.colors.mutedForeground }}>{message}</Text> : null}

      {!canManage ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 12 }}>
          Available for active or suspended permits only.
        </Text>
      ) : (
        <>
          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Daily progress</Text>
            <TextInput style={inputStyle} value={operationalDate} onChangeText={setOperationalDate} placeholder="YYYY-MM-DD" placeholderTextColor={tokens.colors.mutedForeground} />
            <TextInput style={inputStyle} multiline value={completedWork} onChangeText={setCompletedWork} placeholder="Work completed" placeholderTextColor={tokens.colors.mutedForeground} />
            <TextInput style={inputStyle} multiline value={pendingWork} onChangeText={setPendingWork} placeholder="Outstanding work" placeholderTextColor={tokens.colors.mutedForeground} />
            <TextInput style={inputStyle} multiline value={summary} onChangeText={setSummary} placeholder="Daily summary" placeholderTextColor={tokens.colors.mutedForeground} />
            <Pressable
              style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
              onPress={async () => {
                const payload = {
                  operationalDate,
                  completedWork: completedWork.trim(),
                  pendingWork: pendingWork.trim() || undefined,
                  summary: summary.trim(),
                  submit: true,
                };
                if (!isOnline) {
                  await queueOfflineDailyProgress(permitId, payload);
                  setMessage("Daily progress queued for sync");
                  return;
                }
                await runAction(() => recordDailyProgress(permitId, payload).then(() => undefined), "Daily progress saved");
              }}
            >
              <Text style={styles.primaryButtonText}>Submit progress</Text>
            </Pressable>
          </View>

          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Shift handover</Text>
            {directory.slice(0, 5).map((person) => (
              <Pressable key={person.id} onPress={() => setIncomingUserId(person.id)}>
                <Text style={{ color: incomingUserId === person.id ? tokens.colors.primary : tokens.colors.foreground }}>
                  {person.name}
                </Text>
              </Pressable>
            ))}
            <TextInput style={inputStyle} multiline value={completedActivities} onChangeText={setCompletedActivities} placeholder="Completed activities" placeholderTextColor={tokens.colors.mutedForeground} />
            <TextInput style={inputStyle} multiline value={outstandingWork} onChangeText={setOutstandingWork} placeholder="Outstanding work" placeholderTextColor={tokens.colors.mutedForeground} />
            <TextInput style={inputStyle} multiline value={safetyObservations} onChangeText={setSafetyObservations} placeholder="Safety observations" placeholderTextColor={tokens.colors.mutedForeground} />
            <Pressable
              style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
              onPress={async () => {
                const payload = {
                  incomingUserId,
                  completedActivities: completedActivities.trim(),
                  outstandingWork: outstandingWork.trim(),
                  safetyObservations: safetyObservations.trim() || undefined,
                };
                if (!incomingUserId) {
                  setError("Select incoming personnel");
                  return;
                }
                if (!isOnline) {
                  await queueOfflineHandover(permitId, payload);
                  setMessage("Handover queued for sync");
                  return;
                }
                await runAction(() => createHandover(permitId, payload).then(() => undefined), "Handover saved");
              }}
            >
              <Text style={styles.primaryButtonText}>Complete handover</Text>
            </Pressable>
          </View>

          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Revalidation</Text>
            <TextInput style={inputStyle} value={operationalDate} onChangeText={setOperationalDate} placeholder="Operational date" placeholderTextColor={tokens.colors.mutedForeground} />
            <View style={styles.row}>
              <Pressable onPress={() => setRevalidationOutcome("passed")}>
                <Text style={{ color: revalidationOutcome === "passed" ? tokens.colors.primary : tokens.colors.foreground }}>Passed</Text>
              </Pressable>
              <Pressable onPress={() => setRevalidationOutcome("failed")}>
                <Text style={{ color: revalidationOutcome === "failed" ? tokens.colors.primary : tokens.colors.foreground }}>Failed</Text>
              </Pressable>
            </View>
            <TextInput style={inputStyle} multiline value={findings} onChangeText={setFindings} placeholder="Findings" placeholderTextColor={tokens.colors.mutedForeground} />
            <Pressable
              style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
              onPress={async () => {
                const payload = { operationalDate, outcome: revalidationOutcome, findings: findings.trim() };
                if (!isOnline) {
                  await queueOfflineRevalidation(permitId, payload);
                  setMessage("Revalidation queued for sync");
                  return;
                }
                await runAction(() => revalidatePermit(permitId, payload).then(() => undefined), "Revalidation saved");
              }}
            >
              <Text style={styles.primaryButtonText}>Submit revalidation</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
              onPress={() => runAction(() => continuePermit(permitId).then(() => undefined), "Permit continued")}
            >
              <Text style={{ color: tokens.colors.foreground }}>Continue permit</Text>
            </Pressable>
            <TextInput style={inputStyle} multiline value={suspendReason} onChangeText={setSuspendReason} placeholder="Suspend reason" placeholderTextColor={tokens.colors.mutedForeground} />
            <Pressable
              style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
              onPress={() =>
                runAction(
                  () => suspendPermitForRevalidation(permitId, suspendReason.trim()).then(() => undefined),
                  "Permit suspended",
                )
              }
            >
              <Text style={{ color: tokens.colors.foreground }}>Suspend permit</Text>
            </Pressable>
            <TextInput style={inputStyle} value={requestedEndAt} onChangeText={setRequestedEndAt} placeholder="Extension end (ISO datetime)" placeholderTextColor={tokens.colors.mutedForeground} />
            <TextInput style={inputStyle} multiline value={justification} onChangeText={setJustification} placeholder="Extension justification" placeholderTextColor={tokens.colors.mutedForeground} />
            <Pressable
              style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
              onPress={async () => {
                const payload = {
                  requestedEndAt: requestedEndAt.trim(),
                  justification: justification.trim(),
                };
                if (!isOnline) {
                  await queueOfflineExtensionRequest(permitId, payload);
                  setMessage("Extension request queued for sync");
                  return;
                }
                await runAction(() => requestExtension(permitId, payload).then(() => undefined), "Extension requested");
              }}
            >
              <Text style={{ color: tokens.colors.foreground }}>Request extension</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
              onPress={async () => {
                if (!isOnline) {
                  await queueOfflineRenewalCreate(permitId);
                  setMessage("Renewal create queued for sync");
                  return;
                }
                await runAction(() => createRenewal(permitId).then(() => undefined), "Renewal draft created");
              }}
            >
              <Text style={{ color: tokens.colors.foreground }}>Create renewal draft</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8, gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 44, textAlignVertical: "top" },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: "center" },
  row: { flexDirection: "row", gap: 16 },
  error: { color: "#b91c1c" },
});
