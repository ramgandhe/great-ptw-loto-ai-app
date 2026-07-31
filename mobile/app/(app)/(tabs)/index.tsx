import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PLATFORM_VERSION } from "@ptw/shared";
import { ApiError } from "@/lib/api";
import { getHealth } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
  const { isOnline, isReady, pendingCount, isSyncing } = useOffline();
  const { tokens } = useTheme();
  const [apiStatus, setApiStatus] = useState<string>("checking");

  useEffect(() => {
    getHealth()
      .then((health) => setApiStatus(health.status))
      .catch((error) => {
        if (error instanceof ApiError && error.code === "OFFLINE_CACHE_MISS") {
          setApiStatus("offline (no cache)");
          return;
        }
        setApiStatus("unreachable");
      });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.background, padding: tokens.spacing.lg }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground, fontSize: tokens.typography.title + 2 }]}>
        Permit-to-Work Platform
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body }}>
        Mobile foundation (SP-01.01)
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        Version {PLATFORM_VERSION}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        Network: {isOnline ? "online" : "offline"}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        Storage: {isReady ? "ready" : "initialising"}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        Sync queue: {pendingCount} pending{isSyncing ? " (syncing)" : ""}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        API: {apiStatus}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        Auth: {isAuthenticated ? "signed in" : "signed out"}
      </Text>
      <Pressable
        style={[styles.linkButton, { borderColor: tokens.colors.border }]}
        onPress={() => router.push("/organisation")}
      >
        <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>Organisation</Text>
      </Pressable>
      <Pressable
        style={[styles.linkButton, { borderColor: tokens.colors.border }]}
        onPress={() => router.push("/lototo")}
      >
        <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>LOTOTO</Text>
      </Pressable>
      <Pressable
        style={[styles.linkButton, { borderColor: tokens.colors.border }]}
        onPress={() => router.push("/simops")}
      >
        <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>SIMOPS</Text>
      </Pressable>
      <Pressable
        style={[styles.linkButton, { borderColor: tokens.colors.border }]}
        onPress={() => router.push("/workforce")}
      >
        <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>Workforce</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
