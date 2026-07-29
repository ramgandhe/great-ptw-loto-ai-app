import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: "PTW Platform" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="permits/index" options={{ title: "Permits" }} />
        <Stack.Screen name="permits/new" options={{ title: "Create permit" }} />
        <Stack.Screen name="permits/[id]" options={{ title: "Permit" }} />
        <Stack.Screen name="permits/[id]/edit" options={{ title: "Edit draft" }} />
      </Stack>
    </>
  );
}
