import { View } from "react-native";
import { CloudOff, RefreshCw } from "@/components/ui/icons";
import { AppText } from "@/components/ui/text";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

/** A strip at the top while offline or while saved changes wait for the server. */
export function ConnectivityBanner() {
  const { isOnline, pendingCount, isSyncing } = useOffline();
  const { tokens } = useTheme();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const message = !isOnline
    ? "Offline. Changes are saved on this phone and sent when the connection returns."
    : isSyncing
      ? "Sending saved changes…"
      : `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting for the server`;
  const Icon = isOnline ? RefreshCw : CloudOff;
  const color = isOnline ? tokens.colors.info : tokens.colors.warning;

  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[2], paddingHorizontal: tokens.space[4], paddingVertical: tokens.space[2], backgroundColor: isOnline ? tokens.colors.infoBg : tokens.colors.warningBg }}
    >
      <Icon size={16} color={color} />
      <AppText variant="caption" weight="semibold" style={{ color, flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}
