import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { BarChart3, Bell, Building2, FilePlus2, FileText, Layers, Lock, Siren, Users, type LucideIcon } from "@/components/ui/icons";
import { PermitCard } from "@/components/permit/permit-card";
import { AppText, Banner, Button, EmptyState, PageHeader, Screen, SectionTitle } from "@/components/ui";
import { listPendingApprovals } from "@/lib/approval/api";
import { getProfile } from "@/lib/auth/api";
import { getFailedSyncCount } from "@/lib/offline";
import { listPermits } from "@/lib/permit/api";
import { useOrgNames } from "@/lib/permit/names";
import { buildWorkQueue, WORK_ACTIONS, type WorkAction, type WorkItem } from "@/lib/work-queue";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";
import { blend, readable, tint } from "@/theme/tokens";

const APPROVAL_READ = ["job-issuer", "hod", "tenant-owner", "tenant-admin", "platform-admin", "viewer"];
const CREATE = ["job-issuer", "tenant-owner", "tenant-admin"];
const MORE: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Permits", href: "/permits", icon: FileText },
  { label: "LOTOTO", href: "/lototo", icon: Lock },
  { label: "SIMOPS", href: "/simops", icon: Layers },
  { label: "Incidents", href: "/incidents", icon: Siren },
  { label: "Messages", href: "/notifications", icon: Bell },
  { label: "Site figures", href: "/dashboard", icon: BarChart3 },
  { label: "Organisation", href: "/organisation", icon: Building2 },
  { label: "Workforce", href: "/workforce", icon: Users },
];

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Home: what needs this person now, how their offline changes stand, and the way to everything else. */
export default function HomeScreen() {
  const { tokens } = useTheme();
  const { isOnline, pendingCount } = useOffline();
  const names = useOrgNames();
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [needsAttention, setNeedsAttention] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const missing: string[] = [];
    try {
      const profile = await getProfile();
      setRoles(profile.roles);
      setName(profile.firstName || profile.username);
      const [permits, approvals] = await Promise.all([
        listPermits().catch(() => (missing.push("permits"), [])),
        profile.roles.some((r) => APPROVAL_READ.includes(r)) ? listPendingApprovals().catch(() => (missing.push("approvals"), [])) : Promise.resolve([]),
      ]);
      setItems(buildWorkQueue(profile.roles, permits, approvals));
    } catch {
      missing.push("your profile");
      setItems([]);
    }
    setFailed(missing);
    setNeedsAttention(await getFailedSyncCount().catch(() => 0));
  }, []);

  // Refresh whenever Home comes back into view, so it reflects what was just done elsewhere.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    if (isOnline) void load();
  }, [isOnline, load]);

  const groups = (Object.keys(WORK_ACTIONS) as WorkAction[])
    .map((action) => ({ action, rows: (items ?? []).filter((item) => item.action === action) }))
    .filter((group) => group.rows.length > 0);
  const count = items?.length ?? 0;

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
        title={`${greeting()}${name ? `, ${name}` : ""}`}
        description={
          items === null ? (
            "Checking your work…"
          ) : count === 0 ? (
            failed.length ? "Some of your work could not be checked." : "You are all caught up."
          ) : (
            <>
              <AppText variant="title" tone="accent">{count}</AppText> {count === 1 ? "item needs" : "items need"} your action.
            </>
          )
        }
        actions={
          <>
            <Button label="Report incident" variant="outline" icon={Siren} onPress={() => router.push("/incidents/new")} />
            {roles.some((r) => CREATE.includes(r)) ? <Button label="Create permit" icon={FilePlus2} onPress={() => router.push("/permits/new")} /> : null}
          </>
        }
      />

      {/* Offline changes are not done until the server has them. */}
      {pendingCount > 0 || needsAttention > 0 ? (
        <Banner
          tone={needsAttention > 0 ? "danger" : "warning"}
          title={[
            pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting for the server` : "",
            needsAttention > 0 ? `${needsAttention} need${needsAttention === 1 ? "s" : ""} your attention` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          action={<Button label="Open sync status" variant="ghost" size="sm" onPress={() => router.push("/settings")} />}
        />
      ) : null}

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Needs you" description="Grouped by what you have to do. Urgent jobs come first in each group." />
        {failed.length > 0 ? (
          <Banner tone="warning" action={<Button label="Retry" variant="ghost" size="sm" onPress={() => void load()} />}>
            {`Could not check ${failed.join(", ")}${isOnline ? "" : " while offline"}. What needs you may be missing.`}
          </Banner>
        ) : null}
        {items === null ? (
          <AppText variant="caption">Checking what needs you…</AppText>
        ) : groups.length === 0 && failed.length === 0 ? (
          <EmptyState done title="Nothing needs you right now" body="New approvals, hand-offs and returned permits will appear here." />
        ) : (
          groups.map(({ action, rows }) => {
            const { group, verb, kind } = WORK_ACTIONS[action];
            const color = tokens.action[kind];
            return (
              <View key={action} style={{ gap: tokens.space[2] }} accessibilityLabel={`${group}, ${rows.length}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[2], marginTop: tokens.space[2] }}>
                  <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: color }} />
                  <AppText variant="label" weight="bold">{group}</AppText>
                  <View style={{ paddingHorizontal: 8, borderRadius: 999, backgroundColor: tint(color, 0.13), borderWidth: 1, borderColor: tint(color, 0.32) }}>
                    <AppText variant="label" weight="bold" style={{ color: readable(color, blend(color, 0.13, tokens.colors.background)), fontSize: tokens.text.xs }}>{rows.length}</AppText>
                  </View>
                </View>
                {[...rows].sort((a, b) => Number(b.urgent) - Number(a.urgent)).map((item) => (
                  <PermitCard
                    key={item.key}
                    permit={item.permit}
                    names={names}
                    accent={item.urgent ? color : tint(color, 0.45)}
                    onPress={() => router.push(item.href as never)}
                    action={{ label: verb, color, solid: item.urgent || kind === "decide", onPress: () => router.push(item.href as never) }}
                  />
                ))}
              </View>
            );
          })
        )}
      </View>

      <View style={{ gap: tokens.space[3] }}>
        <SectionTitle title="Everything else" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[3] }}>
          {MORE.map(({ label, href, icon: Icon }) => (
            <Pressable
              key={href}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => router.push(href as never)}
              style={({ pressed }) => ({
                flexBasis: "47%",
                flexGrow: 1,
                minHeight: 64,
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space[3],
                paddingHorizontal: tokens.space[4],
                borderRadius: tokens.radii.md,
                backgroundColor: tokens.colors.card,
                borderWidth: tokens.borderWidth,
                borderColor: tokens.colors.border,
                opacity: pressed ? 0.85 : 1,
                ...tokens.shadow,
              })}
            >
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: tint(tokens.colors.primary, 0.12) }}>
                <Icon size={18} color={tokens.colors.primary} />
              </View>
              <AppText variant="label" weight="semibold" style={{ flexShrink: 1 }}>{label}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
