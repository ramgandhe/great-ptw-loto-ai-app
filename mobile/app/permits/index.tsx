import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { PermitCard } from "@/components/permit/permit-card";
import { Banner, Button, EmptyState, PageHeader, Screen, SearchField, Tabs } from "@/components/ui";
import { Plus } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { listPermits } from "@/lib/permit/api";
import { useOrgNames } from "@/lib/permit/names";
import {
  initPermitOfflineStorage,
  listLocalPermitDrafts,
  isLocalPermitId,
  localDraftToPermitRecord,
} from "@/lib/permit/offline";
import { isEditablePermitStatus } from "@/lib/permit/status";
import type { PermitRecord } from "@/lib/permit/types";
import { useTheme } from "@/providers/theme-provider";

type Tab = "drafts" | "submitted";

const SUBMITTED_STATUSES = [
  "pending_approval",
  "approved",
  "rejected",
  "deferred",
] as const;

export default function PermitsScreen() {
  const { tokens } = useTheme();
  const names = useOrgNames();
  const [tab, setTab] = useState<Tab>("drafts");
  const [permits, setPermits] = useState<PermitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void initPermitOfflineStorage();
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (tab === "drafts") {
        const [remote, local] = await Promise.all([
          listPermits("draft").catch(() => [] as PermitRecord[]),
          listLocalPermitDrafts(),
        ]);
        const localRecords = local.map(localDraftToPermitRecord);
        setPermits([...localRecords, ...remote.filter((r) => !localRecords.some((l) => l.id === r.id))]);
        return;
      }
      const groups = await Promise.all(SUBMITTED_STATUSES.map((status) => listPermits(status).catch(() => [] as PermitRecord[])));
      setPermits(groups.flat().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Permits could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const term = query.trim().toLowerCase();
  const shown = term
    ? permits.filter((p) => [p.title, p.reference ?? "", p.locationId ? names.location(p.locationId) : ""].some((v) => v.toLowerCase().includes(term)))
    : permits;
  const open = (item: PermitRecord) => router.push((isEditablePermitStatus(item.status) ? `/permits/${item.id}/edit` : `/permits/${item.id}`) as never);

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
        title="Permits"
        description="Drafts you are preparing and permits sent for approval."
        back={{ label: "Home", href: "/" }}
        actions={<Button label="Create permit" icon={Plus} onPress={() => router.push("/permits/new")} />}
      >
        <Tabs
          options={[
            { key: "drafts", label: "Drafts" },
            { key: "submitted", label: "Submitted" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <SearchField value={query} onChangeText={setQuery} placeholder="Reference, title or place" />
      </PageHeader>

      {error ? <Banner tone="danger" title="Could not load permits" action={<Button label="Retry" variant="ghost" size="sm" onPress={() => void load()} />}>{error}</Banner> : null}
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} style={{ marginTop: tokens.space[6] }} />
      ) : error ? null : shown.length === 0 ? (
        <EmptyState
          title={term ? "No permits match" : tab === "drafts" ? "No drafts" : "Nothing submitted yet"}
          body={term ? "Try another reference, title or place." : tab === "drafts" ? "Permits you start and save appear here until you submit them." : "Permits you submit appear here while they are reviewed."}
          action={!term && tab === "drafts" ? <Button label="Create permit" variant="outline" onPress={() => router.push("/permits/new")} /> : undefined}
        />
      ) : (
        shown.map((item) => (
          <PermitCard
            key={item.id}
            permit={item}
            names={names}
            offline={isLocalPermitId(item.id)}
            accent={tokens.status[item.status]}
            onPress={() => open(item)}
            action={isEditablePermitStatus(item.status) ? { label: item.status === "draft" ? "Continue" : "Revise", color: item.status === "draft" ? tokens.action.do : tokens.action.fix, solid: item.status !== "draft", onPress: () => open(item) } : undefined}
          />
        ))
      )}
    </Screen>
  );
}
