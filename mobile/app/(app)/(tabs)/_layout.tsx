import { Tabs } from "expo-router";
import { House, Settings } from "@/components/ui/icons";
import { useTheme } from "@/providers/theme-provider";

export default function TabLayout() {
  const { tokens } = useTheme();

  return (
    <Tabs
      screenOptions={{
        // Each tab starts with its own page header, as on the web.
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: tokens.fonts.bodySemibold, fontSize: 12 },
        tabBarStyle: { backgroundColor: tokens.colors.card, borderTopColor: tokens.colors.borderSubtle },
        sceneStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
