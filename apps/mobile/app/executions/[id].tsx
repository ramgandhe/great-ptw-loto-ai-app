import { useCallback, useEffect, useState } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  activatePermit,
  addProgress,
  getExecution,
  suspendPermit,
  uploadEvidence,
} from "@/lib/execution/api";
import { queueEvidence, queueProgress } from "@/lib/execution/offline";
import type { ExecutionDetail } from "@/lib/execution/types";
import { isOfflineError } from "@/lib/permit/offline";

export default function ExecutionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await getExecution(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load execution");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startWork() {
    if (!id) return;
    setBusy(true);
    try {
      await activatePermit(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProgress() {
    if (!id || !summary.trim()) return;
    setBusy(true);
    try {
      await addProgress(id, summary.trim());
      setSummary("");
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueProgress(id, summary.trim());
        setSummary("");
        Alert.alert("Saved offline", "The update will sync when connectivity returns.");
      } else {
        setError(err instanceof Error ? err.message : "Progress update failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickEvidence() {
    if (!id) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const file = {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
    };
    setBusy(true);
    try {
      await uploadEvidence(id, file);
      await load();
    } catch (err) {
      if (isOfflineError(err)) {
        await queueEvidence(id, file);
        Alert.alert("Queued offline", "Evidence will upload when connectivity returns.");
      } else {
        setError(err instanceof Error ? err.message : "Evidence upload failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function suspend() {
    if (!id || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await suspendPermit(id, reason.trim());
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suspension failed");
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (!detail) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  }

  const active = detail.permit.status === "active";
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{detail.permit.title}</Text>
      <Text style={styles.meta}>
        {detail.permit.reference ?? "No reference"} · {detail.permit.status.replace(/_/g, " ")}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {detail.permit.status === "approved" ? (
        <Pressable style={styles.primaryButton} disabled={busy} onPress={startWork}>
          <Text style={styles.primaryText}>Confirm readiness and start work</Text>
        </Pressable>
      ) : null}

      {active ? (
        <>
          <Text style={styles.heading}>Progress update</Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            multiline
            maxLength={2000}
            placeholder="Work completed, current conditions and next action"
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} disabled={busy || !summary.trim()} onPress={saveProgress}>
            <Text style={styles.primaryText}>Record progress</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} disabled={busy} onPress={pickEvidence}>
            <Text style={styles.secondaryText}>Capture or upload evidence</Text>
          </Pressable>
          <Text style={styles.heading}>Suspend work</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
            placeholder="Mandatory suspension reason"
            style={styles.input}
          />
          <Pressable style={styles.dangerButton} disabled={busy || reason.trim().length < 3} onPress={suspend}>
            <Text style={styles.primaryText}>Confirm suspension</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.heading}>Timeline</Text>
      {detail.progress.length === 0 ? (
        <Text style={styles.meta}>No progress recorded.</Text>
      ) : (
        detail.progress.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <Text>{entry.summary}</Text>
            <Text style={styles.caption}>{new Date(entry.recordedAt).toLocaleString()}</Text>
          </View>
        ))
      )}
      <Text style={styles.heading}>Evidence ({detail.evidence.length})</Text>
      {detail.evidence.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text>{item.fileName}</Text>
          <Text style={styles.caption}>{Math.round(item.fileSize / 1024)} KB</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  meta: { color: "#6b7280" },
  heading: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  input: { minHeight: 88, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, textAlignVertical: "top" },
  primaryButton: { backgroundColor: "#1f2937", borderRadius: 8, padding: 12, alignItems: "center" },
  primaryText: { color: "#ffffff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderColor: "#1f2937", borderRadius: 8, padding: 12, alignItems: "center" },
  secondaryText: { color: "#1f2937", fontWeight: "600" },
  dangerButton: { backgroundColor: "#b91c1c", borderRadius: 8, padding: 12, alignItems: "center" },
  card: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, gap: 4 },
  caption: { color: "#6b7280", fontSize: 12 },
  error: { color: "#b91c1c" },
});
