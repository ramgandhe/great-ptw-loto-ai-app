import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

  return (
    <View
      style={[
        styles.panel,
        {
          borderColor: tokens.colors.border,
          backgroundColor: tokens.colors.card,
          borderRadius: tokens.radius,
        },
      ]}
    >
      <Text style={[styles.title, { color: tokens.colors.foreground }]}>Offline sync</Text>

      <Text style={{ color: tokens.colors.mutedForeground, marginTop: 8 }}>
        Database {isReady ? "ready" : "initialising"} · Network {isOnline ? "online" : "offline"}
      </Text>
      <Text style={{ color: tokens.colors.mutedForeground, marginTop: 4 }}>
        Pending: {pendingCount} · Failed: {failedCount} · Max attempts: {MAX_SYNC_ATTEMPTS}
      </Text>

      {lastSyncResult ? (
        <Text style={{ color: tokens.colors.mutedForeground, marginTop: 8 }}>
          Last sync — processed {lastSyncResult.processed}, failed {lastSyncResult.failed}
          {lastSyncResult.skipped ? " (skipped — offline)" : ""}
        </Text>
      ) : null}

      {/* Requests the server refused stay here with their reason; the input in them is not lost. */}
      {failedItems.map((item) => (
        <View key={item.id} style={[styles.failed, { borderColor: tokens.colors.border }]}>
          <Text style={{ color: tokens.colors.foreground, fontWeight: "500" }}>{describe(item)}</Text>
          <Text style={{ color: tokens.colors.mutedForeground }}>{item.lastError ?? "Did not sync."}</Text>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        disabled={!isOnline || isSyncing || pendingCount === 0}
        onPress={() => void syncNow()}
        style={[
          styles.button,
          {
            backgroundColor: tokens.colors.primary,
            borderRadius: tokens.radius,
            opacity: !isOnline || isSyncing || pendingCount === 0 ? 0.5 : 1,
          },
        ]}
      >
        <Text style={{ color: tokens.colors.primaryForeground, fontWeight: "500" }}>
          {isSyncing ? "Syncing…" : "Sync now"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
  },
  title: {
    fontWeight: "600",
    fontSize: 16,
  },
  failed: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 8,
    gap: 2,
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
