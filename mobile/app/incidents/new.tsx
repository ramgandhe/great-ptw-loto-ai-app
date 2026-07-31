import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { createIncident } from "@/lib/incidents/api";
import { queueOfflineIncidentReport } from "@/lib/incidents/offline";
import type { IncidentType } from "@/lib/incidents/types";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function NewIncidentScreen() {
  const { tokens } = useTheme();
  const { isOnline } = useOffline();
  const [incidentType, setIncidentType] = useState<IncidentType>("incident");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(submit: boolean) {
    setError(null);
    const payload = {
      incidentType,
      title: title.trim(),
      description: description.trim(),
      occurredAt: new Date().toISOString(),
      submit,
    };
    try {
      if (!isOnline) {
        await queueOfflineIncidentReport(payload);
        setMessage("Report queued for sync");
        return;
      }
      const incident = await createIncident(payload);
      router.replace(`/incidents/${incident.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to report incident");
    }
  }

  const inputStyle = [styles.input, { borderColor: tokens.colors.border, color: tokens.colors.foreground }];

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Report incident</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={{ color: tokens.colors.mutedForeground }}>{message}</Text> : null}

      <View style={styles.row}>
        {(["incident", "near_miss", "unsafe_condition"] as IncidentType[]).map((type) => (
          <Pressable key={type} onPress={() => setIncidentType(type)}>
            <Text style={{ color: incidentType === type ? tokens.colors.primary : tokens.colors.foreground }}>
              {type.replace(/_/g, " ")}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={tokens.colors.mutedForeground} />
      <TextInput style={inputStyle} multiline value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={tokens.colors.mutedForeground} />

      <Pressable style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]} onPress={() => handleSubmit(true)}>
        <Text style={styles.primaryButtonText}>Submit report</Text>
      </Pressable>
      <Pressable style={[styles.secondaryButton, { borderColor: tokens.colors.border }]} onPress={() => handleSubmit(false)}>
        <Text style={{ color: tokens.colors.foreground }}>Save draft</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 44, textAlignVertical: "top" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  secondaryButton: { borderWidth: 1, borderRadius: 8, padding: 12, alignItems: "center" },
  error: { color: "#b91c1c" },
});
