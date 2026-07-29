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
        <Stack.Screen name="approvals/index" options={{ title: "Pending approvals" }} />
        <Stack.Screen name="approvals/[id]" options={{ title: "Permit review" }} />
        <Stack.Screen name="approvals/[id]/history" options={{ title: "Approval history" }} />
        <Stack.Screen name="execution/index" options={{ title: "Active permits" }} />
        <Stack.Screen name="execution/[id]" options={{ title: "Execute permit" }} />
        <Stack.Screen name="execution/[id]/progress" options={{ title: "Progress updates" }} />
        <Stack.Screen name="execution/[id]/evidence" options={{ title: "Evidence gallery" }} />
        <Stack.Screen name="closure/index" options={{ title: "Permit closure" }} />
        <Stack.Screen name="closure/[id]" options={{ title: "Verify permit" }} />
        <Stack.Screen name="closure/archive/index" options={{ title: "Permit archive" }} />
        <Stack.Screen name="closure/archive/[id]" options={{ title: "Historical permit" }} />
      </Stack>
    </>
  );
}
