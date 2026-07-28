import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PLATFORM_VERSION } from "@ptw/shared";
import { initOfflineStorage } from "@/lib/storage";

export default function HomeScreen() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initOfflineStorage().finally(() => setReady(true));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permit-to-Work Platform</Text>
      <Text style={styles.subtitle}>Mobile foundation (SP-01.01)</Text>
      <Text style={styles.meta}>Version {PLATFORM_VERSION}</Text>
      <Text style={styles.meta}>Offline storage: {ready ? "ready" : "initialising"}</Text>
      <Pressable style={styles.button} onPress={() => router.push("/login")}>
        <Text style={styles.buttonText}>Sign in</Text>
      </Pressable>
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
  button: {
    marginTop: 16,
    backgroundColor: "#1f2937",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
  },
});
