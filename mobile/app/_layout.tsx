import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/providers/auth-provider";
import { OfflineProvider } from "@/providers/offline-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";

function RootNavigation() {
  const { preferences, tokens } = useTheme();

  return (
    <>
      <StatusBar style={preferences.mode === "dark" ? "light" : "dark"} />
      {/* Every screen and header on the theme's colours, so dark mode is dark everywhere. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.colors.background },
          // Screens not yet on <PageHeader> keep a native header in the theme's look.
          headerStyle: { backgroundColor: tokens.colors.background },
          headerShadowVisible: false,
          headerTintColor: tokens.colors.foreground,
          headerTitleStyle: { fontFamily: tokens.fonts.display, fontSize: tokens.text.md },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OfflineProvider>
          <AuthProvider>
            <RootNavigation />
          </AuthProvider>
        </OfflineProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
