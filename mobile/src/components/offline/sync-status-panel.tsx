import { useEffect, useState } from "react";
import { View } from "react-native";
import { RefreshCw } from "@/components/ui/icons";
import { AppText } from "@/components/ui/text";
import { Card } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";
import { getFailedSyncItems, MAX_SYNC_ATTEMPTS, type SyncQueueItem } from "@/lib/offline";

/** What a queued request was, in the person's words. */
function describe(item: SyncQueueItem): string {
  const title = (() => {
    try {
      const body = JSON.parse(item.payload) as { title?: unknown };
      return typeof body.title === "string" ? `: ${body.title}` : "";
    } catch {
      return "";
    }
  })();
  if (item.path === "/permits" && item.method === "POST") return `New permit${title}`;
  if (item.path.endsWith("/submit")) return "Permit submission";
  if (item.path.startsWith("/permits/") && item.method === "PATCH") return `Permit changes${title}`;
  return `${item.method} ${item.path}`;
}

type SyncStatusPanelProps = {
  failedCount: number;
};

export function SyncStatusPanel({ failedCount }: SyncStatusPanelProps) {
  const { isOnline, isReady, pendingCount, isSyncing, lastSyncResult, syncNow } = useOffline();
  const { tokens } = useTheme();
  const [failedItems, setFailedItems] = useState<SyncQueueItem[]>([]);

  useEffect(() => {
    getFailedSyncItems().then(setFailedItems, () => setFailedItems([]));
  }, [lastSyncResult, failedCount]);

  const c = tokens.colors;
  return (
    <Card>
      <AppText variant="subheading">Changes waiting to send</AppText>
      <AppText variant="caption">
        {isOnline ? "Online" : "Offline"} · {pendingCount} waiting · {failedCount} refused{isReady ? "" : " · storage starting"}
      </AppText>
      {lastSyncResult ? (
        <AppText variant="caption">
          Last send: {lastSyncResult.processed} sent, {lastSyncResult.failed} refused
          {lastSyncResult.skipped ? " (skipped while offline)" : ""}. Each change is tried {MAX_SYNC_ATTEMPTS} times.
        </AppText>
      ) : null}

      {/* Requests the server refused stay here with their reason; the input in them is not lost. */}
      {failedItems.map((item) => (
        <View key={item.id} style={{ gap: 2, paddingTop: tokens.space[2], marginTop: tokens.space[1], borderTopWidth: 1, borderTopColor: c.borderSubtle }}>
          <AppText variant="body" weight="medium">{describe(item)}</AppText>
          <AppText variant="caption" tone="danger">{item.lastError ?? "Did not sync."}</AppText>
        </View>
      ))}

      <View style={{ marginTop: tokens.space[2], alignSelf: "flex-start" }}>
        <Button label={isSyncing ? "Sending…" : "Send now"} icon={RefreshCw} loading={isSyncing} disabled={!isOnline || pendingCount === 0} onPress={() => void syncNow()} />
      </View>
    </Card>
  );
}
