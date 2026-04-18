import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function ChildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.childTint } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
