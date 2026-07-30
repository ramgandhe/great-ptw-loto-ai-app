import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.background, padding: tokens.spacing.lg }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground, fontSize: tokens.typography.title }]}>
        Settings
      </Text>
      <ThemeSettings />
      <Pressable
        style={[styles.button, { backgroundColor: tokens.colors.primary, borderRadius: tokens.radius }]}
        onPress={() => signOut()}
      >
        <Text style={[styles.buttonText, { color: tokens.colors.primaryForeground }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 16 },
  title: { fontWeight: "600" },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  buttonText: { fontWeight: "500" },
});
