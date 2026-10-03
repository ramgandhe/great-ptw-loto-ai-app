import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { PermitCard } from "@/components/permit/permit-card";
import { Banner, Button, EmptyState, PageHeader, Screen } from "@/components/ui";
import { Archive, RefreshCw } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { countPendingClosureItems, initClosureOfflineStorage } from "@/lib/closure/offline";
import { syncClosureQueue } from "@/lib/closure/api";
import { listPermits } from "@/lib/permit/api";
import { useOrgNames } from "@/lib/permit/names";
import type { PermitRecord } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

export default function ClosureQueueScreen() {
  const { tokens } = useTheme();
  const names = useOrgNames();
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await initClosureOfflineStorage();
      setPermits(await listPermits("active"));
      setPendingCount(await countPendingClosureItems());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Permits could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncClosureQueue();
      setPendingCount(await countPendingClosureItems());
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <PageHeader
        title="Closure"
        description="Verify finished work on site and close the permit."
        back={{ label: "Home", href: "/" }}
        actions={<Button label="Archive" variant="outline" icon={Archive} onPress={() => router.push("/closure/archive")} />}
      />

      {pendingCount > 0 ? (
        <Banner
          tone="warning"
          title={`${pendingCount} inspection${pendingCount === 1 ? "" : "s"} saved on this phone`}
          action={<Button label={syncing ? "Sending…" : "Send now"} variant="ghost" size="sm" icon={RefreshCw} loading={syncing} onPress={() => void handleSync()} />}
        >
          Not closed until the server confirms them.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger" title="Could not load permits" action={<Button label="Retry" variant="ghost" size="sm" onPress={() => void load()} />}>{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : permits.length === 0 ? (
        <EmptyState done title="Nothing to close" body="Permits with work in progress appear here when they are ready to verify." />
      ) : (
        permits.map((item) => (
          <PermitCard
            key={item.id}
            permit={item}
            names={names}
            accent={tokens.status[item.status]}
            onPress={() => router.push(`/closure/${item.id}`)}
            action={{ label: "Verify", color: tokens.action.decide, onPress: () => router.push(`/closure/${item.id}`) }}
          />
        ))
      )}
    </Screen>
  );
}
