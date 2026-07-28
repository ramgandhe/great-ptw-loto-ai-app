import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/auth-provider";

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Authenticate with Keycloak to continue.</Text>
      <Pressable style={styles.button} disabled={isLoading} onPress={() => signIn()}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue with Keycloak</Text>
        )}
      </Pressable>
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
    minHeight: 44,
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
  },
});
