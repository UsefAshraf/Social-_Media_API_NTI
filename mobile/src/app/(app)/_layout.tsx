import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// Deep links straight to e.g. /post/123 still get the tabs underneath to go back to.
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
      <Stack.Screen name="compose" options={{ presentation: 'modal', title: 'New post' }} />
      <Stack.Screen name="hashtag/[tag]" options={{ title: 'Hashtag' }} />
      <Stack.Screen name="users/[id]" options={{ title: 'Profile' }} />
    </Stack>
  );
}
