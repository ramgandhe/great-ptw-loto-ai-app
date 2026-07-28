import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PLATFORM_VERSION } from "@ptw/shared";
import { getDatabaseStatus } from "@/lib/database";

export default function HomeScreen() {
  const [dbStatus, setDbStatus] = useState<"initialising" | "ready" | "error">("initialising");

  useEffect(() => {
    getDatabaseStatus()
      .then(({ ready }) => setDbStatus(ready ? "ready" : "error"))
      .catch(() => setDbStatus("error"));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permit-to-Work Platform</Text>
      <Text style={styles.subtitle}>Mobile foundation (SP-01.01)</Text>
      <Text style={styles.meta}>Version {PLATFORM_VERSION}</Text>
      <Text style={styles.meta}>SQLite: {dbStatus}</Text>
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
