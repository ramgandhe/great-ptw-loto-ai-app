import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError } from "@/lib/api";
import { getPermit } from "@/lib/permit/api";
import { getLocalPermitDraft } from "@/lib/permit/offline";
import { permitDetailToForm } from "@/lib/permit/form";
import type { PermitDetail } from "@/lib/permit/types";

export default function PermitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<PermitDetail | null>(null);
  const [localTitle, setLocalTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    getPermit(id)
      .then(setDetail)
      .catch(async (err) => {
        const local = await getLocalPermitDraft(id);
        if (local) {
          setLocalTitle(local.title);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load permit");
      });
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!detail && !localTitle) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (localTitle && !detail) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{localTitle}</Text>
        <Text style={styles.meta}>Local offline draft — awaiting sync</Text>
        <Pressable style={styles.button} onPress={() => router.push(`/permits/${id}/edit`)}>
          <Text style={styles.buttonText}>Edit draft</Text>
        </Pressable>
      </View>
    );
  }

  const form = permitDetailToForm(detail!);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{detail!.permit.title}</Text>
      <Text style={styles.meta}>
        {detail!.permit.reference ?? "Draft"} · {detail!.permit.status.replace(/_/g, " ")}
      </Text>
      <Text style={styles.line}>Location: {form.locationId || "—"}</Text>
      <Text style={styles.line}>Hazards: {detail!.hazards.length}</Text>
      <Text style={styles.line}>Executors: {detail!.executors.length}</Text>
      <Text style={styles.line}>Attachments: {detail!.attachments.length}</Text>
      {detail!.permit.status === "draft" ? (
        <Pressable style={styles.button} onPress={() => router.push(`/permits/${id}/edit`)}>
          <Text style={styles.buttonText}>Edit draft</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  meta: { color: "#666", marginBottom: 8 },
  line: { fontSize: 14, color: "#374151" },
  button: {
    marginTop: 16,
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c" },
});
