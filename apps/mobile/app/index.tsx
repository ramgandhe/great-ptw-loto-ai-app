import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/providers/auth-provider";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? "/(app)/(tabs)" : "/login"} />;
}
