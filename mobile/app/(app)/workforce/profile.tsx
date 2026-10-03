import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { loadMyProfile } from "@/lib/workforce/offline";
import type { WorkforceRecord } from "@/lib/workforce/types";
import { useTheme } from "@/providers/theme-provider";
import { useThemedStyles } from "@/theme/use-themed-styles";
import type { ThemeColors } from "@/theme/types";

export default function WorkforceProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const themeColors = useTheme().tokens.colors;
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
      {error ? <Text style={{ color: themeColors.danger }}>{error}</Text> : null}
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

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { gap: 8 },
  title: { fontSize: 20, fontWeight: "600", color: c.foreground },
});
