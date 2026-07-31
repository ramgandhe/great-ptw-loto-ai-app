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
  activatePermit,
  addProgress,
  resumePermit,
  suspendPermit,
  uploadEvidence,
} from "@/lib/execution/api";
import { initExecutionOfflineStorage, queueOfflineEvidence, queueOfflineProgress } from "@/lib/execution/offline";
import { getPermit } from "@/lib/permit/api";
import type { PermitDetail } from "@/lib/permit/types";

export default function ExecutePermitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const permitId = id ?? "";
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await initExecutionOfflineStorage();
      setDetail(await getPermit(permitId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load permit");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permitId) {
      load();
    }
  }, [permitId]);

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
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

  async function handleActivate() {
    await runAction(() => activatePermit(permitId), "Work started");
  }

  async function handleResume() {
    await runAction(() => resumePermit(permitId), "Work resumed");
  }

  async function handleSuspend() {
    if (!suspendReason.trim()) {
      setError("Suspension reason is required");
      return;
    }
    await runAction(() => suspendPermit(permitId, suspendReason.trim()), "Work suspended");
    setSuspendReason("");
  }

  async function handleProgress(offline: boolean) {
    if (!summary.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (offline) {
        await queueOfflineProgress(permitId, summary.trim());
        setMessage("Progress saved offline — sync from the list screen");
      } else {
        await addProgress(permitId, { summary: summary.trim() });
        setMessage("Progress recorded");
      }
      setSummary("");
    } catch (err) {
      if (!offline && err instanceof ApiError) {
        try {
          await queueOfflineProgress(permitId, summary.trim());
          setMessage("Network error — progress queued offline");
          setSummary("");
        } catch {
          setError(err.message);
        }
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to record progress");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCameraCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission required", "Enable camera access to capture evidence.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const file = {
      uri: asset.uri,
      name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    };

    setSubmitting(true);
    setError(null);
    try {
      await uploadEvidence(permitId, file);
      setMessage("Evidence uploaded");
    } catch {
      await queueOfflineEvidence(permitId, {
        uri: file.uri,
        fileName: file.name,
        contentType: file.type,
      });
      setMessage("Upload failed — evidence queued for sync");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  if (!detail) {
    return <Text style={styles.error}>{error ?? "Permit not found"}</Text>;
  }

  const { permit } = detail;
  const isApproved = permit.status === "approved";
  const isActive = permit.status === "active";
  const isSuspended = permit.status === "suspended";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{permit.title}</Text>
      <Text style={styles.meta}>{permit.status.replace(/_/g, " ")}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.actions}>
        {isApproved ? (
          <Pressable style={styles.primaryButton} onPress={handleActivate} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Starting..." : "Start work"}</Text>
          </Pressable>
        ) : null}
        {isSuspended ? (
          <Pressable style={styles.primaryButton} onPress={handleResume} disabled={submitting}>
            <Text style={styles.primaryButtonText}>{submitting ? "Resuming..." : "Resume work"}</Text>
          </Pressable>
        ) : null}
      </View>

      {isActive ? (
        <>
          <Text style={styles.sectionTitle}>Progress update</Text>
          <TextInput
            style={styles.input}
            value={summary}
            onChangeText={setSummary}
            placeholder="Describe work progress..."
            multiline
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => handleProgress(false)}
            disabled={submitting || !summary.trim()}
          >
            <Text style={styles.primaryButtonText}>Save progress</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => handleProgress(true)}
            disabled={submitting || !summary.trim()}
          >
            <Text style={styles.secondaryButtonText}>Save offline</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Camera evidence</Text>
          <Pressable style={styles.secondaryButton} onPress={handleCameraCapture} disabled={submitting}>
            <Text style={styles.secondaryButtonText}>Capture photo</Text>
          </Pressable>
        </>
      ) : null}

      {isActive ? (
        <>
          <Text style={styles.sectionTitle}>Suspend work</Text>
          <TextInput
            style={styles.input}
            value={suspendReason}
            onChangeText={setSuspendReason}
            placeholder="Suspension reason..."
            multiline
          />
          <Pressable
            style={styles.dangerButton}
            onPress={handleSuspend}
            disabled={submitting || !suspendReason.trim()}
          >
            <Text style={styles.primaryButtonText}>Suspend work</Text>
          </Pressable>
        </>
      ) : null}

      <View style={styles.links}>
        <Pressable onPress={() => router.push(`/execution/${permitId}/progress`)}>
          <Text style={styles.link}>Progress timeline</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/execution/${permitId}/evidence`)}>
          <Text style={styles.link}>Evidence gallery</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  title: { fontSize: 20, fontWeight: "600" },
  meta: { fontSize: 13, color: "#666", textTransform: "capitalize" },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
  },
  actions: { gap: 8 },
  primaryButton: {
    backgroundColor: "#1f2937",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "500" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#111827", fontWeight: "500" },
  dangerButton: {
    backgroundColor: "#b91c1c",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  links: { marginTop: 16, gap: 8 },
  link: { color: "#2563eb", fontSize: 14 },
  error: { color: "#b91c1c" },
  message: { color: "#059669" },
});
