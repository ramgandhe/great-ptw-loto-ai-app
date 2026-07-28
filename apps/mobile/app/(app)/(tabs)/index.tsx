import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PLATFORM_VERSION } from "@ptw/shared";
import { getHealth } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
  const { tokens } = useTheme();
  const [apiStatus, setApiStatus] = useState<string>("checking");

  useEffect(() => {
    getHealth()
      .then((health) => setApiStatus(health.status))
      .catch(() => setApiStatus("unreachable"));
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
        API: {apiStatus}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body - 2 }}>
        Auth: {isAuthenticated ? "signed in" : "signed out"}
      </Text>
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
});
