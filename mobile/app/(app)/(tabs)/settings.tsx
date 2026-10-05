import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Activity, LogOut } from "@/components/ui/icons";
import { SyncStatusPanel } from "@/components/offline/sync-status-panel";
import { ThemeSettings } from "@/components/theme/theme-settings";
import { Button, Card, PageHeader, Screen, SectionTitle } from "@/components/ui";
import { getFailedSyncCount } from "@/lib/offline";
import { useAuth } from "@/providers/auth-provider";

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const [failedCount, setFailedCount] = useState(0);

  const refreshFailedCount = useCallback(async () => {
    setFailedCount(await getFailedSyncCount());
  }, []);

  useEffect(() => {
    void refreshFailedCount();
  }, [refreshFailedCount]);

  return (
    <Screen>
      <PageHeader title="Settings" description="How the app looks on this phone, and the changes waiting to reach the server." />

      <SectionTitle title="Appearance" />
      <Card>
        <ThemeSettings />
      </Card>

      <SectionTitle title="Offline changes" />
      <SyncStatusPanel failedCount={failedCount} />

      {/* Versions, API health and storage live here, not on Home. */}
      <Button label="Platform status and diagnostics" variant="outline" icon={Activity} onPress={() => router.push("/platform")} full />
      <Button label="Sign out" variant="danger" icon={LogOut} onPress={() => void signOut()} full />
    </Screen>
  );
}
