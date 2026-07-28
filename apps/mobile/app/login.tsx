import { Pressable, StyleSheet, Text, View } from "react-native";

const KEYCLOAK_URL = process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080";
const REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? "ptw-platform";
const CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "ptw-mobile";

export default function LoginScreen() {
  const redirectUri = "ptw://callback";
  const loginUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Authenticate with Keycloak to continue.</Text>
      <Pressable style={styles.button} onPress={() => {}}>
        <Text style={styles.buttonText}>Continue with Keycloak</Text>
      </Pressable>
      <Text style={styles.hint}>{loginUrl}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  subtitle: {
    color: "#666",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
  },
  hint: {
    fontSize: 10,
    color: "#999",
  },
});
