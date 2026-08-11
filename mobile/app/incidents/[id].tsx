import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import {
  assignInvestigation,
  closeIncident,
  continueNearMiss,
  createCorrectiveAction,
  getIncident,
  recordRootCause,
  stopNearMiss,
  submitIncident,
  verifyIncident,
} from "@/lib/incidents/api";
import { queueOfflineIncidentSubmit } from "@/lib/incidents/offline";
import type { IncidentDetail } from "@/lib/incidents/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [investigatorId, setInvestigatorId] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveTitle, setCorrectiveTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return getIncident(id).then(setDetail);
  }, [id]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
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

  if (!detail) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <Text style={styles.error}>{error ?? "Incident not found"}</Text>
      </View>
    );
  }

  const { incident } = detail;
  const inputStyle = [styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }];

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: tokens.colors.primary, marginBottom: 8 }}>Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: tokens.colors.foreground }]}>{incident.title}</Text>
      <Text style={{ color: tokens.colors.mutedForeground }}>
        {incident.reference} · {incident.status.replace(/_/g, " ")}
      </Text>
      <Text style={{ color: tokens.colors.foreground, marginTop: 8 }}>{incident.description}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {incident.status === "draft" ? (
        <Pressable
          style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
          onPress={async () => {
            if (!isOnline && id) {
              await queueOfflineIncidentSubmit(id);
              return;
            }
            await runAction(() => submitIncident(incident.id));
          }}
        >
          <Text style={styles.primaryButtonText}>Submit incident</Text>
        </Pressable>
      ) : null}

      {(detail as { severityLifecycle?: { lifecycleStatus: string; severityPath: string } })
        .severityLifecycle?.lifecycleStatus === "awaiting_hod" ? (
        <View style={[styles.card, { borderColor: tokens.colors.border }]}>
          <Text style={{ fontWeight: "600", color: tokens.colors.foreground }}>
            Near-miss HOD decision
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
            onPress={() => runAction(() => continueNearMiss(incident.id, "continue"))}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
            onPress={() => runAction(() => stopNearMiss(incident.id, "stop"))}
          >
            <Text style={{ color: tokens.colors.foreground }}>Stop</Text>
          </Pressable>
        </View>
      ) : null}

      {incident.status !== "draft" && incident.status !== "closed" ? (
        <View style={[styles.card, { borderColor: tokens.colors.border }]}>
          <Text style={{ fontWeight: "600", color: tokens.colors.foreground }}>Investigation</Text>
          <TextInput style={inputStyle} value={investigatorId} onChangeText={setInvestigatorId} placeholder="Investigator ID" placeholderTextColor={tokens.colors.mutedForeground} />
          <Pressable
            style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
            onPress={() => runAction(() => assignInvestigation(incident.id, { investigatorId: investigatorId.trim() }))}
          >
            <Text style={{ color: tokens.colors.foreground }}>Assign</Text>
          </Pressable>
          <TextInput style={inputStyle} multiline value={rootCause} onChangeText={setRootCause} placeholder="Root cause" placeholderTextColor={tokens.colors.mutedForeground} />
          <Pressable
            style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
            onPress={() => runAction(() => recordRootCause(incident.id, { description: rootCause.trim() }))}
          >
            <Text style={{ color: tokens.colors.foreground }}>Record root cause</Text>
          </Pressable>
          <TextInput style={inputStyle} value={correctiveTitle} onChangeText={setCorrectiveTitle} placeholder="Corrective action title" placeholderTextColor={tokens.colors.mutedForeground} />
          <TextInput style={inputStyle} value={ownerId} onChangeText={setOwnerId} placeholder="Owner ID" placeholderTextColor={tokens.colors.mutedForeground} />
          <Pressable
            style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
            onPress={() =>
              runAction(() =>
                createCorrectiveAction(incident.id, {
                  title: correctiveTitle.trim(),
                  ownerId: ownerId.trim(),
                  dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
                }),
              )
            }
          >
            <Text style={{ color: tokens.colors.foreground }}>Add corrective action</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
            onPress={() =>
              runAction(() =>
                verifyIncident(incident.id, {
                  correctiveActionsConfirmed: true,
                  preventiveActionsReviewed: true,
                }),
              )
            }
          >
            <Text style={styles.primaryButtonText}>Verify</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: tokens.colors.border }]}
            onPress={() => runAction(() => closeIncident(incident.id))}
          >
            <Text style={{ color: tokens.colors.foreground }}>Close incident</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 12, gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 44, textAlignVertical: "top" },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: "center" },
  error: { color: "#b91c1c" },
});
