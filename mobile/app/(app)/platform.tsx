import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { ConnectivityBanner } from "@/components/offline/connectivity-banner";
import { SyncStatusPanel } from "@/components/offline/sync-status-panel";
import { getFailedSyncCount } from "@/lib/offline";
import { getHealth, getSystemVersion } from "@/lib/api/system";
import { useTheme } from "@/providers/theme-provider";

export default function PlatformScreen() {
  const { tokens } = useTheme();
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [health, systemVersion, failed] = await Promise.all([
        getHealth(),
        getSystemVersion(),
        getFailedSyncCount(),
      ]);
      setHealthStatus(health.status);
      setVersion(systemVersion.version);
      setEnvironment(systemVersion.environment);
      setFailedCount(failed);
    } catch (err) {
      setHealthStatus(null);
      setVersion(null);
      setEnvironment(null);
      setError(err instanceof Error ? err.message : "Failed to load platform status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const appVersion = Constants.expoConfig?.version ?? "unknown";

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <ConnectivityBanner />
      <ScrollView contentContainerStyle={[styles.container, { padding: tokens.spacing.lg }]}>
        <Text style={[styles.title, { color: tokens.colors.foreground }]}>Platform status</Text>
        <Text style={{ color: tokens.colors.mutedForeground, marginBottom: 16 }}>
          Production readiness checks for the mobile client and API.
        </Text>

        {error ? (
          <Text style={{ color: tokens.colors.foreground, marginBottom: 12 }}>{error}</Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <View style={[styles.card, { borderColor: tokens.colors.border, borderRadius: tokens.radius }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>Release</Text>
            <Text style={{ color: tokens.colors.mutedForeground, marginTop: 8 }}>
              App {appVersion} · API {version ?? "—"} · {environment ?? "—"}
            </Text>
            <Text style={{ color: tokens.colors.mutedForeground, marginTop: 4 }}>
              API health: {healthStatus ?? "unknown"}
            </Text>
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <SyncStatusPanel failedCount={failedCount} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={[
            styles.button,
            {
              backgroundColor: tokens.colors.muted,
              borderRadius: tokens.radius,
              marginTop: 16,
            },
          ]}
        >
          <Text style={{ color: tokens.colors.foreground }}>Refresh status</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
