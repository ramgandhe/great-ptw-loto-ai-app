import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ConnectivityBanner } from "@/components/offline/connectivity-banner";
import { SyncStatusPanel } from "@/components/offline/sync-status-panel";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { getFailedSyncCount } from "@/lib/offline";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { tokens } = useTheme();
  const [failedCount, setFailedCount] = useState(0);

  const refreshFailedCount = useCallback(async () => {
    setFailedCount(await getFailedSyncCount());
  }, []);

  useEffect(() => {
    void refreshFailedCount();
  }, [refreshFailedCount]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <ConnectivityBanner />
      <ScrollView contentContainerStyle={[styles.container, { padding: tokens.spacing.lg }]}>
        <Text style={[styles.title, { color: tokens.colors.foreground, fontSize: tokens.typography.title }]}>
          Settings
        </Text>

        <ThemeSettings />

        <SyncStatusPanel failedCount={failedCount} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/platform")}
          style={[
            styles.linkButton,
            { borderColor: tokens.colors.border, borderRadius: tokens.radius },
          ]}
        >
          <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>Platform status</Text>
          <Text style={{ color: tokens.colors.mutedForeground, marginTop: 4 }}>
            API health, release info and sync diagnostics
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: tokens.colors.primary, borderRadius: tokens.radius }]}
          onPress={() => signOut()}
        >
          <Text style={[styles.buttonText, { color: tokens.colors.primaryForeground }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  title: { fontWeight: "600" },
  linkButton: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  buttonText: { fontWeight: "500" },
});
