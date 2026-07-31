import { Pressable, StyleSheet, Text, View } from "react-native";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

export function ConnectivityBanner() {
  const { isOnline, pendingCount, isSyncing } = useOffline();
  const { tokens } = useTheme();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const message = !isOnline
    ? "Offline — changes will sync when connectivity returns."
    : isSyncing
      ? "Syncing queued changes…"
      : `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync`;

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.banner,
        {
          backgroundColor: !isOnline ? "#fef2f2" : tokens.colors.muted,
          borderBottomColor: tokens.colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: tokens.colors.foreground,
          fontSize: tokens.typography.body - 1,
          fontWeight: !isOnline ? "600" : "400",
        }}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
