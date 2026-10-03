import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { PermitCard } from "@/components/permit/permit-card";
import { Banner, Button, EmptyState, PageHeader, Screen } from "@/components/ui";
import { RefreshCw } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { countPendingExecutionItems, initExecutionOfflineStorage } from "@/lib/execution/offline";
import { syncExecutionQueue } from "@/lib/execution/api";
import { listPermits } from "@/lib/permit/api";
import { useOrgNames } from "@/lib/permit/names";
import type { PermitRecord } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

const EXECUTION_STATUSES = ["approved", "active", "suspended"] as const;
const VERB: Record<string, string> = { approved: "Start work", active: "Update", suspended: "Open" };

export default function ActivePermitsScreen() {
  const { tokens } = useTheme();
  const names = useOrgNames();
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await initExecutionOfflineStorage();
      const groups = await Promise.all(EXECUTION_STATUSES.map((status) => listPermits(status)));
      setPermits(groups.flat());
      setPendingCount(await countPendingExecutionItems());
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
    setSyncMessage(null);
    try {
      const result = await syncExecutionQueue();
      setSyncMessage(`Sent ${result.synced} update${result.synced === 1 ? "" : "s"}${result.failed ? `; ${result.failed} refused` : ""}.`);
      setPendingCount(await countPendingExecutionItems());
    } catch (err) {
      setSyncMessage(err instanceof ApiError ? err.message : "The updates could not be sent.");
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
      <PageHeader title="Work in progress" description="Approved permits to start, and work under way." back={{ label: "Home", href: "/" }} />

      {pendingCount > 0 ? (
        <Banner
          tone="warning"
          title={`${pendingCount} update${pendingCount === 1 ? "" : "s"} saved on this phone`}
          action={<Button label={syncing ? "Sending…" : "Send now"} variant="ghost" size="sm" icon={RefreshCw} loading={syncing} onPress={() => void handleSync()} />}
        >
          Not recorded until the server confirms them.
        </Banner>
      ) : null}
      {syncMessage ? <Banner tone="info">{syncMessage}</Banner> : null}
      {error ? <Banner tone="danger" title="Could not load permits" action={<Button label="Retry" variant="ghost" size="sm" onPress={() => void load()} />}>{error}</Banner> : null}

      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : permits.length === 0 ? (
        <EmptyState title="No work to start or update" body="Approved permits and work in progress appear here." />
      ) : (
        permits.map((item) => (
          <PermitCard
            key={item.id}
            permit={item}
            names={names}
            accent={tokens.status[item.status]}
            onPress={() => router.push(`/execution/${item.id}`)}
            action={{
              label: VERB[item.status] ?? "Open",
              color: item.status === "suspended" ? tokens.action.fix : tokens.action.do,
              solid: item.status !== "active",
              onPress: () => router.push(`/execution/${item.id}`),
            }}
          />
        ))
      )}
    </Screen>
  );
}
