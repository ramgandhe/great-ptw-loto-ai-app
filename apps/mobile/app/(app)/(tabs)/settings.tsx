import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Pressable style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  button: {
    alignSelf: "flex-start",
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
