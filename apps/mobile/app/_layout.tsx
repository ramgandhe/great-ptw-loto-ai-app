import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
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
