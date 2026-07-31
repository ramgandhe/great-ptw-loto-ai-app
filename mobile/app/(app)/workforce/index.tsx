import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/providers/theme-provider";

const links = [
  { href: "/workforce/profile", label: "My profile" },
  { href: "/workforce/directory", label: "Workforce directory" },
  { href: "/workforce/competencies", label: "Competencies" },
  { href: "/workforce/certifications", label: "Certifications" },
] as const;

export default function WorkforceScreen() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.background, padding: tokens.spacing.lg }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Workforce</Text>
      <FlatList
        data={links}
        keyExtractor={(item) => item.href}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { borderColor: tokens.colors.border }]}
            onPress={() => router.push(item.href)}
          >
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{item.label}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
});
