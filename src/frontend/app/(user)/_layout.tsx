import { Colors } from "@/constants/theme";
import { Stack } from "expo-router";

export default function UserLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.userTint },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="select-address" />
      <Stack.Screen name="authors" />
      <Stack.Screen name="publishers" />
    </Stack>
  );
}
