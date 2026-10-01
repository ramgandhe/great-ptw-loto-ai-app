import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConnectivityBanner } from "@/components/offline/connectivity-banner";
import { SyncStatusPanel } from "@/components/offline/sync-status-panel";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { router } from "expo-router";
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

        {/* Versions, API health and storage live here, not on Home. */}
        <Pressable accessibilityRole="button" style={[styles.link, { borderColor: tokens.colors.border, borderRadius: tokens.radius }]} onPress={() => router.push("/platform")}>
          <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>Platform status and diagnostics</Text>
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
  link: { borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  buttonText: { fontWeight: "500" },
});
