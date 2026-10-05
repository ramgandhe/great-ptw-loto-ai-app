import { View } from "react-native";
import { router } from "expo-router";
import { AppText, Card } from "@/components/ui";
import { ChevronRight, type LucideIcon } from "@/components/ui/icons";
import { useTheme } from "@/providers/theme-provider";
import { tint } from "@/theme/tokens";

/** The pages under a section (Organisation, Workforce): one row each, opening that page. */
export function HubLinks({ links }: { links: { href: string; label: string; description: string; icon: LucideIcon }[] }) {
  const { tokens } = useTheme();
  return (
    <Card padded={false} style={{ gap: 0, overflow: "hidden" }}>
      {links.map(({ href, label, description, icon: Icon }, index) => (
        <Card
          key={href}
          onPress={() => router.push(href as never)}
          accessibilityLabel={label}
          style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3], borderRadius: 0, borderWidth: 0, elevation: 0, shadowOpacity: 0, borderTopWidth: index ? 1 : 0, borderTopColor: tokens.colors.borderSubtle }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(tokens.colors.primary, 0.12) }}>
            <Icon size={18} color={tokens.colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="body" weight="semibold">{label}</AppText>
            <AppText variant="caption">{description}</AppText>
          </View>
          <ChevronRight size={18} color={tokens.colors.mutedForeground} />
        </Card>
      ))}
    </Card>
  );
}
