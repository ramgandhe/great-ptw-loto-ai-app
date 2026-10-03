import * as ImagePicker from "expo-image-picker";
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
  applyLock,
  applyTag,
  getIsolationExecutionForPlan,
  markIsolationComplete,
  markIsolationVerified,
  recordVerification,
  startIsolationExecution,
} from "@/lib/isolation-execution/api";
import {
  queueOfflineLock,
  queueOfflineTag,
  queueOfflineVerification,
} from "@/lib/isolation-execution/offline";
import type { IsolationExecutionDetail } from "@/lib/isolation-execution/types";
import { isolationProgress } from "@/lib/isolation-execution/progress";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function IsolationExecutionScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();

  const [detail, setDetail] = useState<IsolationExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedPointId, setSelectedPointId] = useState("");
  const [lockTag, setLockTag] = useState("");
  const [lockMethod, setLockMethod] = useState("padlock");
  const [tagNumber, setTagNumber] = useState("");
  const [tagType, setTagType] = useState("danger");

  async function load() {
    if (!planId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getIsolationExecutionForPlan(planId);
      setDetail(data);
      // After each action, move on to the first point still to finish.
      setSelectedPointId(isolationProgress(data.sequence, data.locks, data.tags, data.verifications).current?.step.isolationPointId ?? "");
    } catch (err) {
      if (err instanceof ApiError && err.message.includes("not found")) {
        setDetail(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load execution");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [planId]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStart() {
    if (!planId) {
      return;
    }
    await runAction(async () => {
      await startIsolationExecution(planId);
    }, "Isolation started");
  }

  async function handleApplyLock(offline: boolean) {
    if (!detail || !selectedPointId || !lockTag.trim()) {
      setError("Point and lock tag required");
      return;
    }

    const payload = {
      isolationPointId: selectedPointId,
      lockTag: lockTag.trim(),
      lockMethod: lockMethod.trim(),
    };

    if (offline || !isOnline) {
      await queueOfflineLock(detail.execution.id, payload);
      setMessage("Lock saved on this phone. It is not applied until the server confirms it.");
      setLockTag("");
      return;
    }

    await runAction(async () => {
      await applyLock(detail.execution.id, payload);
      setLockTag("");
    }, "Lock applied");
  }

  async function handleApplyTag(offline: boolean) {
    if (!detail || !selectedPointId || !tagNumber.trim()) {
      setError("Point and tag number required");
      return;
    }

    const payload = {
      isolationPointId: selectedPointId,
      tagNumber: tagNumber.trim(),
      tagType: tagType.trim(),
    };

    if (offline || !isOnline) {
      await queueOfflineTag(detail.execution.id, payload);
      setMessage("Tag saved on this phone. It is not applied until the server confirms it.");
      setTagNumber("");
      return;
    }

    await runAction(async () => {
      await applyTag(detail.execution.id, payload);
      setTagNumber("");
    }, "Tag applied");
  }

  async function handleVerify() {
    if (!detail || !selectedPointId) {
      return;
    }

    Alert.alert(
      "Record verification",
      "Record a passing verification for this isolation point?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            const payload = {
              isolationPointId: selectedPointId,
              result: "pass" as const,
              method: "try-out",
            };

            if (!isOnline) {
              void queueOfflineVerification(detail.execution.id, payload).then(() => {
                setMessage("Verification saved on this phone. It is not recorded until the server confirms it.");
              });
              return;
            }

            void runAction(async () => {
              await recordVerification(detail.execution.id, payload);
            }, "Verification recorded");
          },
        },
      ],
    );
  }

  async function handleCameraCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required for evidence capture");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setMessage("Photo captured — upload when online (evidence sync in SP-03.03)");
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (!detail) {
    return (
      <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: tokens.colors.foreground }]}>Isolation execution</Text>
        <Text style={{ color: tokens.colors.mutedForeground }}>
          No execution started for this plan.
        </Text>
        {error ? <Text style={{ color: tokens.colors.danger }}>{error}</Text> : null}
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
          onPress={() => void handleStart()}
          disabled={submitting}
        >
          <Text style={[styles.buttonText, { color: tokens.colors.primaryForeground }]}>Start isolation</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const execution = detail.execution;
  const canApply = execution.status === "in_progress";
  const { points, current, left } = isolationProgress(detail.sequence, detail.locks, detail.tags, detail.verifications);
  const selected = points.find((p) => p.step.isolationPointId === selectedPointId) ?? current;
  const finished = points.filter((p) => p.done && p !== selected);
  const c = tokens.colors;
  const text = { color: c.foreground };
  const muted = { color: c.mutedForeground };
  const outline = [styles.secondaryButton, { borderColor: c.border, backgroundColor: c.card }];
  const primary = (off: boolean) => [styles.button, { backgroundColor: c.primary, opacity: off ? 0.6 : 1 }];
  const confirmThen = (title: string, body: string, run: () => void) =>
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: run },
    ]);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, text]}>{detail.plan?.title ?? "Isolation execution"}</Text>
      <Text style={muted}>
        {points.length === 0 ? "No isolation sequence configured for this plan." : left === 0 ? `All ${points.length} points done` : `${left} of ${points.length} points to do`}
        {isOnline ? "" : " · offline"}
      </Text>

      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      {message ? <Text style={{ color: c.success }}>{message}</Text> : null}

      {/* Points in the approved order; a point opens once every earlier point is locked. */}
      <View style={styles.chips}>
        {points.map((p) => (
          <Pressable
            key={p.step.isolationPointId}
            accessibilityRole="button"
            accessibilityState={{ selected: p === selected, disabled: !p.open && !p.done }}
            disabled={!p.open && !p.done}
            onPress={() => setSelectedPointId(p.step.isolationPointId)}
            style={[styles.chip, { borderColor: p === selected ? c.primary : c.border, opacity: !p.open && !p.done ? 0.5 : 1 }]}
          >
            <Text style={[text, p === selected && { fontWeight: "700" }]}>
              {`${p.done ? "✓ " : ""}${p.step.sequenceOrder}. ${p.step.isolationNumber}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {selected ? (
        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={[styles.section, text]}>{`Point ${selected.step.sequenceOrder}: ${selected.step.isolationNumber}`}</Text>
          {selected.step.description ? <Text style={muted}>{selected.step.description}</Text> : null}

          <Text style={[styles.label, text]}>Lock</Text>
          {selected.lock ? (
            <Text style={{ color: c.success }}>{`Locked: ${selected.lock.lockTag} · ${selected.lock.lockMethod}`}</Text>
          ) : (
            <>
              <TextInput value={lockTag} onChangeText={setLockTag} placeholder="Lock tag number" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground }]} />
              <TextInput value={lockMethod} onChangeText={setLockMethod} placeholder="Lock method" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground }]} />
              <Pressable accessibilityRole="button" style={primary(!canApply || !selected.open || submitting)} onPress={() => void handleApplyLock(false)} disabled={!canApply || !selected.open || submitting}>
                <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Apply lock</Text>
              </Pressable>
              {!isOnline ? (
                <Pressable accessibilityRole="button" style={outline} onPress={() => void handleApplyLock(true)} disabled={!canApply || submitting}>
                  <Text style={[styles.secondaryButtonText, text]}>Save lock on this phone</Text>
                </Pressable>
              ) : null}
            </>
          )}

          <Text style={[styles.label, text]}>Tag</Text>
          {selected.tag ? (
            <Text style={{ color: c.success }}>{`Tagged: ${selected.tag.tagNumber} · ${selected.tag.tagType}`}</Text>
          ) : (
            <>
              <TextInput value={tagNumber} onChangeText={setTagNumber} placeholder="Tag number" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground }]} />
              <Pressable accessibilityRole="button" style={primary(!canApply || submitting)} onPress={() => void handleApplyTag(false)} disabled={!canApply || submitting}>
                <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Apply tag</Text>
              </Pressable>
            </>
          )}

          {selected.step.requiresVerification ? (
            <>
              <Text style={[styles.label, text]}>Verify isolation</Text>
              {selected.verification ? (
                <Text style={{ color: c.success }}>Verified</Text>
              ) : (
                <Pressable accessibilityRole="button" style={outline} onPress={() => void handleVerify()} disabled={!selected.lock || submitting}>
                  <Text style={[styles.secondaryButtonText, text, !selected.lock && muted]}>
                    {selected.lock ? "Record pass verification" : "Lock this point before verifying it"}
                  </Text>
                </Pressable>
              )}
            </>
          ) : null}

          <Pressable accessibilityRole="button" style={outline} onPress={() => void handleCameraCapture()}>
            <Text style={[styles.secondaryButtonText, text]}>Capture evidence photo</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Isolation as a whole: two separate confirmed steps. */}
      {execution.status === "in_progress" ? (
        <Pressable
          accessibilityRole="button"
          style={primary(submitting || points.some((p) => !p.lock))}
          disabled={submitting || points.some((p) => !p.lock)}
          onPress={() => confirmThen("Mark isolation complete", "Every point is locked and isolation is complete?", () => void runAction(() => markIsolationComplete(execution.id).then(() => undefined), "Isolation complete"))}
        >
          <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Mark isolation complete</Text>
        </Pressable>
      ) : null}
      {execution.status === "isolated" ? (
        <Pressable
          accessibilityRole="button"
          style={primary(submitting)}
          disabled={submitting}
          onPress={() => confirmThen("Complete verification", "All required verifications passed and work may start?", () => void runAction(() => markIsolationVerified(execution.id).then(() => undefined), "Isolation verified"))}
        >
          <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Complete verification</Text>
        </Pressable>
      ) : null}

      {finished.length > 0 ? (
        <>
          <Text style={[styles.section, text]}>{`Finished points (${finished.length})`}</Text>
          {finished.map((p) => (
            <Text key={p.step.isolationPointId} style={muted}>
              {`${p.step.sequenceOrder}. ${p.step.isolationNumber} · lock ${p.lock?.lockTag ?? "—"} · tag ${p.tag?.tagNumber ?? "—"}${p.step.requiresVerification ? " · verified" : ""}`}
            </Text>
          ))}
        </>
      ) : null}

      {execution.status === "verified" ? (
        <>
          <Pressable accessibilityRole="button" style={primary(false)} onPress={() => router.push(`/lototo/restoration/${execution.id}`)}>
            <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Start restoration</Text>
          </Pressable>
          {detail.plan?.permitId ? (
            <Pressable accessibilityRole="button" style={outline} onPress={() => router.push(`/execution/${detail.plan!.permitId}`)}>
              <Text style={[styles.secondaryButtonText, text]}>Open permit execution</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  section: { marginTop: 4, fontSize: 16, fontWeight: "600" },
  label: { marginTop: 8, fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 24 },
  card: { gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  step: { borderWidth: 1, borderRadius: 8, padding: 10 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  button: { minHeight: 48, borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "600" },
  secondaryButton: { minHeight: 48, borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  secondaryButtonText: { fontWeight: "600" },
});
