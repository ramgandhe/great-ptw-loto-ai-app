import { Tabs } from "expo-router";
import { useTheme } from "@/providers/theme-provider";

export default function TabLayout() {
  const { tokens } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.mutedForeground,
        tabBarStyle: { backgroundColor: tokens.colors.card, borderTopColor: tokens.colors.border },
        headerStyle: { backgroundColor: tokens.colors.card },
        headerTintColor: tokens.colors.foreground,
        sceneStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
