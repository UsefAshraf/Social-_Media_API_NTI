import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export const unstable_settings = {
  anchor: 'login',
};

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false, title: 'Log in' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot password' }} />
    </Stack>
  );
}
