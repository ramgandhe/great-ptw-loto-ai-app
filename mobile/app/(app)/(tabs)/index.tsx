import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ConnectivityBanner } from "@/components/offline/connectivity-banner";
import { listPendingApprovals } from "@/lib/approval/api";
import { getProfile } from "@/lib/auth/api";
import { getFailedSyncCount } from "@/lib/offline";
import { listPermits } from "@/lib/permit/api";
import { buildWorkQueue, WORK_ACTIONS, type WorkAction, type WorkItem } from "@/lib/work-queue";
import { useOffline } from "@/providers/offline-provider";
import { useTheme } from "@/providers/theme-provider";

const APPROVAL_READ = ["job-issuer", "hod", "tenant-owner", "tenant-admin", "platform-admin", "viewer"];
const CREATE = ["job-issuer", "tenant-owner", "tenant-admin"];
const MORE = [
  { label: "Permits", href: "/permits" },
  { label: "LOTOTO", href: "/lototo" },
  { label: "SIMOPS", href: "/simops" },
  { label: "Incidents", href: "/incidents" },
  { label: "Messages", href: "/notifications" },
  { label: "Site figures", href: "/dashboard" },
  { label: "Organisation", href: "/organisation" },
  { label: "Workforce", href: "/workforce" },
] as const;

/** Home: what needs this person now, how their offline changes stand, and the way to everything else. */
export default function HomeScreen() {
  const { tokens } = useTheme();
  const { isOnline, pendingCount } = useOffline();
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
  const text = { color: tokens.colors.foreground };
  const muted = { color: tokens.colors.mutedForeground };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <ConnectivityBanner />
      <ScrollView
        contentContainerStyle={[styles.container, { padding: tokens.spacing.lg }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Text style={[styles.title, text]}>{name ? `Hello, ${name}` : "Home"}</Text>

        {/* Offline changes are not done until the server has them. */}
        {pendingCount > 0 || needsAttention > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push("/settings")} style={[styles.card, { borderColor: tokens.colors.border }]}>
            <Text style={text}>
              {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} pending server confirmation` : ""}
              {pendingCount > 0 && needsAttention > 0 ? " · " : ""}
              {needsAttention > 0 ? `${needsAttention} need${needsAttention === 1 ? "s" : ""} your attention` : ""}
            </Text>
            <Text style={muted}>Open sync status</Text>
          </Pressable>
        ) : null}

        <View style={styles.row}>
          {roles.some((r) => CREATE.includes(r)) ? (
            <Pressable accessibilityRole="button" style={[styles.primary, { backgroundColor: tokens.colors.primary }]} onPress={() => router.push("/permits/new")}>
              <Text style={{ color: tokens.colors.primaryForeground, fontWeight: "600" }}>Create permit</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={[styles.secondary, { borderColor: tokens.colors.border }]} onPress={() => router.push("/incidents/new")}>
            <Text style={[text, { fontWeight: "500" }]}>Report incident</Text>
          </Pressable>
        </View>

        <Text style={[styles.section, text]}>Needs you</Text>
        {failed.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.card, { borderColor: "#d97706" }]}>
            <Text style={text}>{`Could not check ${failed.join(", ")}${isOnline ? "" : " while offline"}. What needs you may be missing.`}</Text>
            <Text style={{ color: tokens.colors.primary, fontWeight: "600" }}>Retry</Text>
          </Pressable>
        ) : null}
        {items === null ? (
          <Text style={muted}>Checking what needs you…</Text>
        ) : groups.length === 0 && failed.length === 0 ? (
          <Text style={muted}>Nothing needs you right now.</Text>
        ) : (
          groups.map(({ action, rows }) => (
            <View key={action} style={[styles.card, { borderColor: tokens.colors.border }]}>
              <Text style={[text, { fontWeight: "600" }]}>{`${WORK_ACTIONS[action].group} (${rows.length})`}</Text>
              {rows.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${WORK_ACTIONS[action].verb}: ${item.permit.title}`}
                  onPress={() => router.push(item.href as never)}
                  style={styles.item}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={text}>{item.permit.title}</Text>
                    {item.permit.reference ? <Text style={muted}>{item.permit.reference}</Text> : null}
                  </View>
                  <Text style={{ color: tokens.colors.primary, fontWeight: "600" }}>{WORK_ACTIONS[action].verb}</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}

        <Text style={[styles.section, text]}>Everything else</Text>
        <View style={styles.row}>
          {MORE.map((link) => (
            <Pressable key={link.href} accessibilityRole="button" style={[styles.secondary, { borderColor: tokens.colors.border }]} onPress={() => router.push(link.href)}>
              <Text style={[text, { fontWeight: "500" }]}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  section: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  item: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  primary: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 8 },
  secondary: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
});
