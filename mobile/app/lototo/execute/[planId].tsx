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
      if (!selectedPointId && data.sequence[0]) {
        setSelectedPointId(data.sequence[0].isolationPointId);
      }
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
      setMessage(successMessage);
      await load();
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
      setMessage("Lock queued for sync");
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
      setMessage("Tag queued for sync");
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
                setMessage("Verification queued for sync");
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
          onPress={() => void handleStart()}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>Start isolation</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const execution = detail.execution;
  const canApply = execution.status === "in_progress";

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>
        {detail.plan?.title ?? "Isolation execution"}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>
        Status: {execution.status.replace(/_/g, " ")} · Network: {isOnline ? "online" : "offline"}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Text style={styles.section}>Checklist ({detail.sequence.length} steps)</Text>
      {detail.sequence.map((step) => {
        const locked = detail.locks.some(
          (lock) => lock.isolationPointId === step.isolationPointId && lock.status === "applied",
        );
        const tagged = detail.tags.some(
          (tag) => tag.isolationPointId === step.isolationPointId && tag.status === "applied",
        );
        return (
          <Pressable
            key={step.isolationPointId}
            onPress={() => setSelectedPointId(step.isolationPointId)}
            style={[
              styles.step,
              {
                borderColor: selectedPointId === step.isolationPointId ? tokens.colors.primary : tokens.colors.border,
              },
            ]}
          >
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>
              {step.sequenceOrder}. {step.isolationNumber}
            </Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
              {locked ? "Locked" : "Lock pending"} · {tagged ? "Tagged" : "Tag pending"}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.section}>Apply lock</Text>
      <TextInput
        value={lockTag}
        onChangeText={setLockTag}
        placeholder="Lock tag ID"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <TextInput
        value={lockMethod}
        onChangeText={setLockMethod}
        placeholder="Lock method"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: !canApply || submitting ? 0.6 : 1 }]}
        onPress={() => void handleApplyLock(false)}
        disabled={!canApply || submitting}
      >
        <Text style={styles.buttonText}>Apply lock</Text>
      </Pressable>
      <Pressable
        style={[styles.secondaryButton, { opacity: !canApply || submitting ? 0.6 : 1 }]}
        onPress={() => void handleApplyLock(true)}
        disabled={!canApply || submitting}
      >
        <Text style={styles.secondaryButtonText}>Queue lock offline</Text>
      </Pressable>

      <Text style={styles.section}>Apply tag</Text>
      <TextInput
        value={tagNumber}
        onChangeText={setTagNumber}
        placeholder="Tag number"
        style={[styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }]}
      />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: !canApply || submitting ? 0.6 : 1 }]}
        onPress={() => void handleApplyTag(false)}
        disabled={!canApply || submitting}
      >
        <Text style={styles.buttonText}>Apply tag</Text>
      </Pressable>
      <Pressable
        style={[styles.secondaryButton, { opacity: !canApply || submitting ? 0.6 : 1 }]}
        onPress={() => void handleApplyTag(true)}
        disabled={!canApply || submitting}
      >
        <Text style={styles.secondaryButtonText}>Queue tag offline</Text>
      </Pressable>

      <Text style={styles.section}>Verification</Text>
      <Pressable style={styles.secondaryButton} onPress={() => void handleVerify()}>
        <Text style={styles.secondaryButtonText}>Record pass verification</Text>
      </Pressable>

      {execution.status === "in_progress" ? (
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
          onPress={() =>
            void runAction(async () => {
              await markIsolationComplete(execution.id);
            }, "Isolation complete")
          }
          disabled={submitting}
        >
          <Text style={styles.buttonText}>Mark isolation complete</Text>
        </Pressable>
      ) : null}

      {execution.status === "isolated" ? (
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary, opacity: submitting ? 0.6 : 1 }]}
          onPress={() =>
            void runAction(async () => {
              await markIsolationVerified(execution.id);
            }, "Isolation verified")
          }
          disabled={submitting}
        >
          <Text style={styles.buttonText}>Complete verification</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Evidence</Text>
      <Pressable style={styles.secondaryButton} onPress={() => void handleCameraCapture()}>
        <Text style={styles.secondaryButtonText}>Capture photo</Text>
      </Pressable>

      {execution.status === "verified" && detail.plan ? (
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary }]}
          onPress={() => router.push(`/lototo/restoration/${execution.id}`)}
        >
          <Text style={styles.buttonText}>Start restoration</Text>
        </Pressable>
      ) : null}

      {execution.status === "verified" && detail.plan ? (
        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary }]}
          onPress={() => router.push(`/execution/${detail.plan!.permitId}`)}
        >
          <Text style={styles.buttonText}>Open permit execution</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  section: { marginTop: 12, fontSize: 16, fontWeight: "600" },
  step: { borderWidth: 1, borderRadius: 8, padding: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  button: { borderRadius: 8, padding: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "600" },
  error: { color: "#b91c1c" },
  success: { color: "#047857" },
});
