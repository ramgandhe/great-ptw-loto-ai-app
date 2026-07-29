import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "@/providers/theme-provider";

const links = [
  { href: "/organisation/profile", label: "Organisation profile", description: "Read-only tenant details" },
  { href: "/organisation/plants", label: "Plant directory", description: "Cached plant list" },
  { href: "/organisation/departments", label: "Department directory", description: "Cached department list" },
  { href: "/organisation/locations", label: "Location directory", description: "Cached location list" },
] as const;

export default function OrganisationScreen() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: tokens.colors.background, padding: tokens.spacing.lg }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Organisation</Text>
      <Text style={{ color: tokens.colors.mutedForeground, marginBottom: 12 }}>
        Reference data for SP-01.02 (offline cached)
      </Text>
      <FlatList
        data={links}
        keyExtractor={(item) => item.href}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { borderColor: tokens.colors.border }]}
            onPress={() => router.push(item.href)}
          >
            <Text style={[styles.cardTitle, { color: tokens.colors.foreground }]}>{item.label}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 13 }}>{item.description}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
});
