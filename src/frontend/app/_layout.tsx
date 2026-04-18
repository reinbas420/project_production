import { Colors } from "@/constants/theme";
import useChildTrackingStore from "@/store/useChildTrackingStore";
import useAppStore from "@/store/useAppStore";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";

export const unstable_settings = {
  anchor: "(auth)",
};

export default function RootLayout() {
  const { hydrate: hydrateTracking } = useChildTrackingStore();
  const { hydrate: hydrateApp, isLoading } = useAppStore();

  useEffect(() => {
    hydrateTracking();
    hydrateApp();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(select-profile)" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(child)" />
        <Stack.Screen name="(librarian)" />
        <Stack.Screen name="(admin)" />
        {/* keep legacy tabs accessible for now */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
      {isLoading && (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={Colors.accentSage} size="large" />
        </View>
      )}
      <StatusBar style="dark" backgroundColor={Colors.background} />
    </>
  );
}
