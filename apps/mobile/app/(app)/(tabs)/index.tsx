import { Pressable, StyleSheet, Text, View } from "react-native";
import { PLATFORM_VERSION } from "@ptw/shared";
import { useAuth } from "@/providers/auth-provider";

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permit-to-Work Platform</Text>
      <Text style={styles.subtitle}>Mobile foundation (SP-01.01)</Text>
      <Text style={styles.meta}>Version {PLATFORM_VERSION}</Text>
      <Text style={styles.meta}>Auth: {isAuthenticated ? "signed in" : "signed out"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  meta: {
    fontSize: 12,
    color: "#888",
  },
});
