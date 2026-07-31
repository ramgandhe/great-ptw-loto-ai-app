import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { CompetencyRecord } from "@/lib/workforce/types";
import { useTheme } from "@/providers/theme-provider";

export function CompetencyListScreen({
  title,
  loader,
  showExpiry = false,
}: {
  title: string;
  loader: () => Promise<CompetencyRecord[]>;
  showExpiry?: boolean;
}) {
  const { tokens } = useTheme();
  const [items, setItems] = useState<CompetencyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loader()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [loader]);

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 24 }} />;
  }

  return (
    <View style={[styles.container, { padding: tokens.spacing.lg, backgroundColor: tokens.colors.background }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>{title}</Text>
      {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: tokens.colors.mutedForeground }}>No records.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ fontWeight: "600", color: tokens.colors.foreground }}>{item.name}</Text>
            {showExpiry && item.expiryDate ? (
              <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>Expires: {item.expiryDate}</Text>
            ) : null}
            {item.description ? (
              <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>{item.description}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
});
