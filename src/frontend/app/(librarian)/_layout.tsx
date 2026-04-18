import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function LibrarianLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.librarianTint } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="inventory" />
    </Stack>
  );
}
