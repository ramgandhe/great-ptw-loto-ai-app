import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { OrgRecord } from "@/lib/organisation/types";
import { useTheme } from "@/providers/theme-provider";

type DirectoryListScreenProps = {
  title: string;
  loader: () => Promise<OrgRecord[]>;
};

export function DirectoryListScreen({ title, loader }: DirectoryListScreenProps) {
  const { tokens } = useTheme();
  const [items, setItems] = useState<OrgRecord[]>([]);
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
    <View style={[styles.container, { backgroundColor: tokens.colors.background, padding: tokens.spacing.lg }]}>
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>{title}</Text>
      {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: tokens.colors.mutedForeground }}>No records found.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={{ color: tokens.colors.foreground, fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: tokens.colors.mutedForeground, fontSize: 12 }}>
              {item.code ?? item.id.slice(0, 8)} · {item.status ?? "active"}
            </Text>
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
