import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initOfflineStorage } from "@/lib/storage";

export default function RootLayout() {
  useEffect(() => {
    initOfflineStorage().catch((error) => {
      console.error("Failed to initialise SQLite", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "PTW Platform" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
