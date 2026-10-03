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
import { getIsolationExecutionDetail } from "@/lib/isolation-execution/api";
import type { IsolationExecutionDetail } from "@/lib/isolation-execution/types";
import {
  completeRestoration,
  getExecutionHistory,
  getRestoration,
  removeLock,
  removeTag,
  restoreEquipment,
} from "@/lib/restoration/api";
import type { RestorationDetail } from "@/lib/restoration/types";
import { restorationProgress } from "@/lib/restoration/progress";
import {
  queueOfflineEquipmentRestore,
  queueOfflineLockRemoval,
  queueOfflineTagRemoval,
} from "@/lib/restoration/offline";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function RestorationScreen() {
  const { executionId } = useLocalSearchParams<{ executionId: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();

  const [executionDetail, setExecutionDetail] = useState<IsolationExecutionDetail | null>(null);
  const [restoration, setRestoration] = useState<RestorationDetail | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedPointId, setSelectedPointId] = useState("");
  const [restoreMethod, setRestoreMethod] = useState("re-energise");

  async function load() {
    if (!executionId) {
      return;
    }
    const [iso, rest, hist] = await Promise.all([
      getIsolationExecutionDetail(executionId),
      getRestoration(executionId),
      getExecutionHistory(executionId),
    ]);
    setExecutionDetail(iso);
    setRestoration(rest);
    setHistoryCount(hist.length);
    // Work on the first point with something still on it.
    setSelectedPointId(restorationProgress(iso.sequence, iso.locks, iso.tags, rest).current?.step.isolationPointId ?? "");
  }

  useEffect(() => {
    load()
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load restoration");
      })
      .finally(() => setLoading(false));
  }, [executionId]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
      setMessage((current) => current ?? successMessage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (!executionDetail || !restoration) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <Text style={{ color: tokens.colors.danger }}>{error ?? "Restoration not found"}</Text>
      </View>
    );
  }

  const canRestore = restoration.execution.status === "verified";
  const { points, current, outstanding } = restorationProgress(executionDetail.sequence, executionDetail.locks, executionDetail.tags, restoration);
  const selected = points.find((p) => p.step.isolationPointId === selectedPointId) ?? current;
  const c = tokens.colors;
  const text = { color: c.foreground };
  const muted = { color: c.mutedForeground };
  const outline = [styles.secondaryButton, { borderColor: c.border, backgroundColor: c.card }];
  // Each removal and restoration is its own confirmed step. Offline, it is saved on the phone and
  // reported as not done until the server confirms it.
  const confirmed = (title: string, body: string, online: () => Promise<unknown>, offline: () => Promise<unknown>, done: string) =>
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () =>
          void runAction(async () => {
            if (isOnline) await online();
            else {
              await offline();
              setMessage(`${done}: saved on this phone, not done until the server confirms it.`);
            }
          }, done),
      },
    ]);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, text]}>{executionDetail.plan?.title ?? "Restoration"}</Text>
      <Text style={muted}>
        {`Still on: ${outstanding.locks} lock${outstanding.locks === 1 ? "" : "s"}, ${outstanding.tags} tag${outstanding.tags === 1 ? "" : "s"}; ${outstanding.points} of ${points.length} points to restore${isOnline ? "" : " · offline"}`}
      </Text>
      {!canRestore && restoration.execution.status !== "restored" ? <Text style={{ color: c.warning }}>Restoration starts once the isolation is verified.</Text> : null}

      {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      {message ? <Text style={{ color: c.success }}>{message}</Text> : null}

      <View style={styles.chips}>
        {points.map((p) => (
          <Pressable
            key={p.step.isolationPointId}
            accessibilityRole="button"
            accessibilityState={{ selected: p === selected }}
            onPress={() => setSelectedPointId(p.step.isolationPointId)}
            style={[styles.chip, { borderColor: p === selected ? c.primary : c.border }]}
          >
            <Text style={[text, p === selected && { fontWeight: "700" }]}>{`${p.done ? "✓ " : ""}${p.step.sequenceOrder}. ${p.step.isolationNumber}`}</Text>
          </Pressable>
        ))}
      </View>

      {selected ? (
        <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
          <Text style={[styles.section, text]}>{`Point ${selected.step.sequenceOrder}: ${selected.step.isolationNumber}`}</Text>
          <Text style={[styles.label, text]}>1. Remove locks and tags</Text>
          {selected.locks.length + selected.tags.length === 0 ? <Text style={muted}>Nothing left on this point.</Text> : null}
          {selected.locks.map((lock) => (
            <Pressable
              key={lock.id}
              accessibilityRole="button"
              style={outline}
              disabled={!canRestore || submitting}
              onPress={() =>
                confirmed("Remove lock", `Remove lock ${lock.lockTag}?`, () => removeLock(executionId!, lock.id), () => queueOfflineLockRemoval(executionId!, { appliedLockId: lock.id }), "Lock removed")
              }
            >
              <Text style={[styles.secondaryButtonText, text]}>{`Remove lock ${lock.lockTag}`}</Text>
            </Pressable>
          ))}
          {selected.tags.map((tag) => (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              style={outline}
              disabled={!canRestore || submitting}
              onPress={() =>
                confirmed("Remove tag", `Remove tag ${tag.tagNumber}?`, () => removeTag(executionId!, tag.id), () => queueOfflineTagRemoval(executionId!, { appliedTagId: tag.id }), "Tag removed")
              }
            >
              <Text style={[styles.secondaryButtonText, text]}>{`Remove tag ${tag.tagNumber}`}</Text>
            </Pressable>
          ))}

          <Text style={[styles.label, text]}>2. Restore</Text>
          {selected.restored ? (
            <Text style={{ color: c.success }}>{`Restored${selected.restored.method ? ` · ${selected.restored.method}` : ""}`}</Text>
          ) : (
            <>
              <TextInput value={restoreMethod} onChangeText={setRestoreMethod} placeholder="Restoration method" placeholderTextColor={c.mutedForeground} style={[styles.input, { borderColor: c.border, color: c.foreground }]} />
              <Pressable
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: c.primary, opacity: !canRestore || submitting ? 0.6 : 1 }]}
                disabled={!canRestore || submitting}
                onPress={() => {
                  const payload = { isolationPointId: selected.step.isolationPointId, method: restoreMethod.trim() || undefined };
                  confirmed(
                    "Restore point",
                    `Restore ${selected.step.isolationNumber}?${selected.locks.length + selected.tags.length ? " Locks or tags are still on this point." : ""}`,
                    () => restoreEquipment(executionId!, payload),
                    () => queueOfflineEquipmentRestore(executionId!, payload),
                    "Equipment restored",
                  );
                }}
              >
                <Text style={[styles.buttonText, { color: c.primaryForeground }]}>Restore point</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {canRestore ? (
        <Pressable
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: c.primary, opacity: submitting || outstanding.points > 0 ? 0.6 : 1 }]}
          disabled={submitting || outstanding.points > 0}
          onPress={() =>
            Alert.alert("Complete restoration", "Every point is restored?", [
              { text: "Cancel", style: "cancel" },
              { text: "Confirm", onPress: () => void runAction(async () => void (await completeRestoration(executionId!)), "Restoration complete") },
            ])
          }
        >
          <Text style={[styles.buttonText, { color: c.primaryForeground }]}>
            {outstanding.points > 0 ? `Complete restoration (${outstanding.points} to restore first)` : "Complete restoration"}
          </Text>
        </Pressable>
      ) : null}

      {restoration.execution.status === "restored" ? (
        <Text style={{ color: c.success }}>{`Restored · ${restoration.restorations.length} points · ${historyCount} history events`}</Text>
      ) : null}

      {executionDetail.plan ? (
        <Pressable accessibilityRole="button" style={outline} onPress={() => router.push(`/lototo/history/${executionDetail.plan!.id}`)}>
          <Text style={[styles.secondaryButtonText, text]}>View LOTOTO history</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  section: { marginTop: 4, fontSize: 16, fontWeight: "600" },
  label: { marginTop: 8, fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 48, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderRadius: 24 },
  card: { gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  button: { minHeight: 48, borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "600" },
  secondaryButton: { minHeight: 48, borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  secondaryButtonText: { fontWeight: "600" },
});
