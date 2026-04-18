import { Colors } from "@/constants/theme";
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.adminTint },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="manage-library" />
    </Stack>
  );
}
