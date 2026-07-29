import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { loadMyProfile } from "@/lib/workforce/offline";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { useTheme } from "@/providers/theme-provider";

export default function WorkforceProfileScreen() {
  const { tokens } = useTheme();
  const [profile, setProfile] = useState<WorkforceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyProfile()
      .then((records) => setProfile(records[0] ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} />;
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { padding: tokens.spacing.lg }]}>
      {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
      {!profile ? (
        <Text style={{ color: tokens.colors.mutedForeground }}>No profile cached.</Text>
      ) : (
        <>
          <Text style={[styles.title, { color: tokens.colors.foreground }]}>{profile.name}</Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>{profile.email ?? "—"}</Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>Role: {profile.role ?? "—"}</Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>Status: {profile.status ?? "active"}</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
});
