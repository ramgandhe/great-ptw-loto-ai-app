import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadOrganisationProfile } from "@/lib/organisation/offline";
import type { Organisation } from "@/lib/organisation/types";
import { useTheme } from "@/providers/theme-provider";

export default function OrganisationProfileScreen() {
  const { tokens } = useTheme();
  const [org, setOrg] = useState<Organisation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrganisationProfile()
      .then((records) => setOrg(records[0] ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { padding: tokens.spacing.lg }]}>
      {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
      {!org ? (
        <Text style={{ color: tokens.colors.mutedForeground }}>No organisation profile cached.</Text>
      ) : (
        <>
          <Text style={[styles.title, { color: tokens.colors.foreground }]}>{org.name}</Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>Legal name: {org.legalName ?? "—"}</Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>
            Registration: {org.registrationNumber ?? "—"}
          </Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>Status: {org.status ?? "active"}</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
});
