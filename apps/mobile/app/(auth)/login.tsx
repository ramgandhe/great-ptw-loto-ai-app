import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.background, padding: tokens.spacing.lg }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground, fontSize: tokens.typography.title }]}>
        Sign in
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, fontSize: tokens.typography.body }}>
        Authenticate with Keycloak to continue.
      </Text>
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, borderRadius: tokens.radius }]}
        disabled={isLoading}
        onPress={() => signIn()}
      >
        {isLoading ? (
          <ActivityIndicator color={tokens.colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: tokens.colors.primaryForeground }]}>
            Continue with Keycloak
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 12 },
  title: { fontWeight: "600" },
  button: {
    marginTop: 8,
    padding: 12,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  buttonText: { fontWeight: "500" },
});
