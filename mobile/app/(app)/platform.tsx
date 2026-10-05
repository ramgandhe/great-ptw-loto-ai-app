import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { Banner, Button, Card, Chip, InfoList, PageHeader, Screen, SectionTitle } from "@/components/ui";
import { RefreshCw } from "@/components/ui/icons";
import { SyncStatusPanel } from "@/components/offline/sync-status-panel";
import { getFailedSyncCount } from "@/lib/offline";
import { getHealth, getSystemVersion } from "@/lib/api/system";
import { useTheme } from "@/providers/theme-provider";

export default function PlatformScreen() {
  const { tokens } = useTheme();
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [health, systemVersion, failed] = await Promise.all([
        getHealth(),
        getSystemVersion(),
        getFailedSyncCount(),
      ]);
      setHealthStatus(health.status);
      setVersion(systemVersion.version);
      setEnvironment(systemVersion.environment);
      setFailedCount(failed);
    } catch (err) {
      setHealthStatus(null);
      setVersion(null);
      setEnvironment(null);
      setError(err instanceof Error ? err.message : "The server could not be reached.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const appVersion = Constants.expoConfig?.version ?? "unknown";

  const healthy = healthStatus === "healthy" || healthStatus === "ok";

  return (
    <Screen>
      <PageHeader
        title="Platform status"
        description="Versions, server health and the changes waiting on this phone."
        back={{ label: "Settings", href: "/settings" }}
        actions={<Button label="Refresh" variant="outline" icon={RefreshCw} loading={isLoading} onPress={() => void load()} />}
      />
      {error ? <Banner tone="danger" title="Server not reachable">{error}</Banner> : null}

      <SectionTitle title="Release" />
      {isLoading ? (
        <ActivityIndicator color={tokens.colors.primary} />
      ) : (
        <Card>
          <InfoList
            rows={[
              ["Server", healthStatus ? <Chip label={healthy ? "Healthy" : healthStatus} color={healthy ? tokens.colors.success : tokens.colors.warning} dot /> : "Unknown"],
              ["App version", appVersion],
              ["API version", version ?? "Unknown"],
              ["Environment", environment ?? "Unknown"],
            ]}
          />
        </Card>
      )}

      <SectionTitle title="Offline changes" />
      <SyncStatusPanel failedCount={failedCount} />
    </Screen>
  );
}
