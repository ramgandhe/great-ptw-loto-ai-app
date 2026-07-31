import { useEffect, useMemo, useState } from "react";
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

  const removedLockIds = useMemo(
    () => new Set(restoration?.lockRemovals.map((item) => item.appliedLockId) ?? []),
    [restoration?.lockRemovals],
  );
  const removedTagIds = useMemo(
    () => new Set(restoration?.tagRemovals.map((item) => item.appliedTagId) ?? []),
    [restoration?.tagRemovals],
  );

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
    if (!selectedPointId && iso.sequence[0]) {
      setSelectedPointId(iso.sequence[0].isolationPointId);
    }
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
      setMessage(successMessage);
      await load();
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
        <Text style={styles.error}>{error ?? "Restoration not found"}</Text>
      </View>
    );
  }

  const canRestore = restoration.execution.status === "verified";
  const activeLocks = executionDetail.locks.filter(
    (lock) => lock.status === "applied" && !removedLockIds.has(lock.id),
  );
  const activeTags = executionDetail.tags.filter(
    (tag) => tag.status === "applied" && !removedTagIds.has(tag.id),
  );

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>
        {executionDetail.plan?.title ?? "Restoration"}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>
        Status: {restoration.execution.status} · Network: {isOnline ? "online" : "offline"}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.section}>Remove locks ({activeLocks.length})</Text>
      {activeLocks.map((lock) => (
        <View key={lock.id} style={styles.row}>
          <Text style={{ color: tokens.colors.foreground, flex: 1 }}>{lock.lockTag}</Text>
          <Pressable
            style={styles.secondaryButton}
            disabled={!canRestore || submitting}
            onPress={() => {
              const action = async () => {
                if (!isOnline) {
                  await queueOfflineLockRemoval(executionId!, { appliedLockId: lock.id });
                  setMessage("Lock removal queued");
                  return;
                }
                await removeLock(executionId!, lock.id);
              };
              void runAction(action, "Lock removed");
            }}
          >
            <Text style={styles.secondaryButtonText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>Remove tags ({activeTags.length})</Text>
      {activeTags.map((tag) => (
        <View key={tag.id} style={styles.row}>
          <Text style={{ color: tokens.colors.foreground, flex: 1 }}>{tag.tagNumber}</Text>
          <Pressable
            style={styles.secondaryButton}
            disabled={!canRestore || submitting}
            onPress={() => {
              const action = async () => {
                if (!isOnline) {
                  await queueOfflineTagRemoval(executionId!, { appliedTagId: tag.id });
                  setMessage("Tag removal queued");
                  return;
                }
                await removeTag(executionId!, tag.id);
              };
              void runAction(action, "Tag removed");
            }}
          >
            <Text style={styles.secondaryButtonText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>Restore equipment</Text>
      {executionDetail.sequence.map((step) => (
        <Pressable
          key={step.isolationPointId}
          onPress={() => setSelectedPointId(step.isolationPointId)}
          style={[
            styles.step,
            {
              borderColor:
                selectedPointId === step.isolationPointId
                  ? tokens.colors.primary
                  : tokens.colors.border,
            },
          ]}
        >
          <Text style={{ color: tokens.colors.foreground }}>
            {step.sequenceOrder}. {step.isolationNumber}
          </Text>
        </Pressable>
      ))}
      <TextInput
        value={restoreMethod}
        onChangeText={setRestoreMethod}
        placeholder="Restoration method"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: !canRestore || submitting ? 0.6 : 1 }]}
        disabled={!canRestore || submitting || !selectedPointId}
        onPress={() => {
          const action = async () => {
            const payload = {
              isolationPointId: selectedPointId,
              method: restoreMethod.trim() || undefined,
            };
            if (!isOnline) {
              await queueOfflineEquipmentRestore(executionId!, payload);
              setMessage("Restore queued for sync");
              return;
            }
            await restoreEquipment(executionId!, payload);
          };
          void runAction(action, "Equipment restored");
        }}
      >
        <Text style={styles.buttonText}>Restore point</Text>
      </Pressable>

      {canRestore ? (
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
          disabled={submitting}
          onPress={() => {
            Alert.alert("Complete restoration", "Confirm all points are restored?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Confirm",
                onPress: () => {
                  void runAction(async () => {
                    await completeRestoration(executionId!);
                  }, "Restoration complete");
                },
              },
            ]);
          }}
        >
          <Text style={styles.buttonText}>Complete restoration</Text>
        </Pressable>
      ) : null}

      {restoration.execution.status === "restored" ? (
        <Text style={styles.success}>
          Restored · {restoration.restorations.length} points · {historyCount} history events
        </Text>
      ) : null}

      {executionDetail.plan ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push(`/lototo/history/${executionDetail.plan!.id}`)}
        >
          <Text style={styles.secondaryButtonText}>View LOTOTO history</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  section: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: { borderWidth: 1, borderRadius: 8, padding: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  button: { borderRadius: 8, padding: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "600", fontSize: 13 },
  error: { color: "#b91c1c" },
  success: { color: "#047857" },
});
