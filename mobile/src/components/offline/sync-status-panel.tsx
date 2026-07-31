import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";
import { MAX_SYNC_ATTEMPTS } from "@/lib/offline";

type SyncStatusPanelProps = {
  failedCount: number;
};

export function SyncStatusPanel({ failedCount }: SyncStatusPanelProps) {
  const { isOnline, isReady, pendingCount, isSyncing, lastSyncResult, syncNow } = useOffline();
  const { tokens } = useTheme();

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
  button: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
