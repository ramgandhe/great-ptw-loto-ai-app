import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { AppText, Banner, Card, EmptyState, PageHeader, Screen, SearchField } from "@/components/ui";
import { useTheme } from "@/providers/theme-provider";

/**
 * A read-only list of reference records (plants, people, certificates…), searchable by its text.
 * Loaders read the offline cache, so the list also works without a connection.
 */
export function RecordListScreen<T extends { id: string; name: string }>({
  title,
  description,
  back,
  loader,
  details,
}: {
  title: string;
  description?: string;
  back: { label: string; href: string };
  loader: () => Promise<T[]>;
  /** The lines under each record's name. */
  details: (item: T) => (string | null | undefined)[];
}) {
  const { tokens } = useTheme();
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loader()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "The list could not be loaded."))
      .finally(() => setLoading(false));
  }, [loader]);

  const term = query.trim().toLowerCase();
  const shown = term ? items.filter((item) => [item.name, ...details(item)].some((v) => v?.toLowerCase().includes(term))) : items;

  return (
    <Screen>
      <PageHeader title={title} description={description} back={back}>
        {items.length > 6 ? <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${title.toLowerCase()}`} /> : null}
      </PageHeader>
      {/* A failed load is shown as the error, never as "no records". */}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : shown.length === 0 ? (
        <EmptyState title={term ? "Nothing matches" : "Nothing here yet"} body={term ? "Try another name." : undefined} />
      ) : (
        shown.map((item) => (
          <Card key={item.id} style={{ gap: 2 }}>
            <AppText variant="subheading">{item.name}</AppText>
            {details(item)
              .filter(Boolean)
              .map((line) => (
                <AppText key={line} variant="caption">{line}</AppText>
              ))}
          </Card>
        ))
      )}
    </Screen>
  );
}
