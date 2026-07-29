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
        <Stack.Screen name="permits/index" options={{ headerShown: true, title: "Permits" }} />
        <Stack.Screen name="permits/new" options={{ headerShown: true, title: "Create permit" }} />
        <Stack.Screen name="permits/[id]" options={{ headerShown: true, title: "Permit" }} />
        <Stack.Screen name="permits/[id]/edit" options={{ headerShown: true, title: "Edit draft" }} />
        <Stack.Screen name="approvals/index" options={{ headerShown: true, title: "Pending approvals" }} />
        <Stack.Screen name="approvals/[id]" options={{ headerShown: true, title: "Permit review" }} />
        <Stack.Screen name="approvals/[id]/history" options={{ headerShown: true, title: "Approval history" }} />
        <Stack.Screen name="execution/index" options={{ headerShown: true, title: "Active permits" }} />
        <Stack.Screen name="execution/[id]" options={{ headerShown: true, title: "Execute permit" }} />
        <Stack.Screen name="execution/[id]/progress" options={{ headerShown: true, title: "Progress updates" }} />
        <Stack.Screen name="execution/[id]/evidence" options={{ headerShown: true, title: "Evidence gallery" }} />
        <Stack.Screen name="closure/index" options={{ headerShown: true, title: "Permit closure" }} />
        <Stack.Screen name="closure/[id]" options={{ headerShown: true, title: "Verify permit" }} />
        <Stack.Screen name="closure/archive/index" options={{ headerShown: true, title: "Permit archive" }} />
        <Stack.Screen name="closure/archive/[id]" options={{ headerShown: true, title: "Historical permit" }} />
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
