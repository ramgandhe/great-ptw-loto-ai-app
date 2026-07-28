import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/providers/auth-provider";
import { OfflineProvider } from "@/providers/offline-provider";
import { ThemeProvider, useTheme } from "@/providers/theme-provider";

function RootNavigation() {
  const { preferences } = useTheme();

  return (
    <>
      <StatusBar style={preferences.mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
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
