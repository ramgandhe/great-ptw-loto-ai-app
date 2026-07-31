import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError } from "@/lib/api";
import { listIncidents } from "@/lib/incidents/api";
import type { Incident } from "@/lib/incidents/types";
import { useTheme } from "@/providers/theme-provider";

export default function IncidentsScreen() {
  const { tokens } = useTheme();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listIncidents()
      .then(setIncidents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load incidents"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: tokens.colors.background }]}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: tokens.colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Incidents</Text>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: tokens.colors.primary }]}
        onPress={() => router.push("/incidents/new")}
      >
        <Text style={styles.primaryButtonText}>Report incident</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {incidents.length === 0 ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 12 }}>No incidents yet.</Text>
      ) : (
        incidents.map((incident) => (
          <Pressable
            key={incident.id}
            style={[styles.card, { borderColor: tokens.colors.border }]}
            onPress={() => router.push(`/incidents/${incident.id}`)}
          >
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{incident.title}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {incident.reference} · {incident.status.replace(/_/g, " ")}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  primaryButton: { borderRadius: 8, padding: 12, alignItems: "center", marginTop: 8 },
  primaryButtonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#b91c1c", marginTop: 8 },
});
