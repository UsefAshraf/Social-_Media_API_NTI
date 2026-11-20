import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth';
import { Button, Screen, VerifyEmailBanner } from '@/components';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  function confirmLogout() {
    Alert.alert('Log out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setLoggingOut(true);
          // logout() never throws; the root guard redirects to /login once status flips.
          void logout();
        },
      },
    ]);
  }

  const section = [styles.section, { backgroundColor: colors.surface, borderRadius: radius.md }];

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.textMuted }]} role="heading">
          Account
        </Text>
        <View style={section}>
          <View style={[styles.row, { padding: spacing.md, gap: spacing.md }]}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <View style={styles.flex}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Email</Text>
              <Text style={[typography.body, { color: colors.text }]} testID="settings-email">
                {user?.email ?? ''}
              </Text>
            </View>
            {user ? (
              <View style={[styles.row, { gap: spacing.xs }]} testID="email-status">
                <Ionicons
                  name={user.emailVerified ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={user.emailVerified ? colors.success : colors.warning}
                />
                <Text style={[typography.caption, { color: user.emailVerified ? colors.success : colors.warning }]}>
                  {user.emailVerified ? 'Verified' : 'Not verified'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {user && !user.emailVerified ? <VerifyEmailBanner email={user.email} /> : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={[typography.label, { color: colors.textMuted }]} role="heading">
          Privacy
        </Text>
        <View style={section}>
          <SettingsLink icon="ban-outline" title="Blocked accounts" onPress={() => router.push('/blocked')} testID="blocked-link" />
        </View>
      </View>

      <Button title="Log out" variant="secondary" onPress={confirmLogout} loading={loggingOut} testID="logout-button" />
    </Screen>
  );
}

interface SettingsLinkProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  onPress: () => void;
  testID?: string;
}

function SettingsLink({ icon, title, onPress, testID }: SettingsLinkProps) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => [styles.row, { padding: spacing.md, gap: spacing.md, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <Text style={[typography.body, styles.flex, { color: colors.text }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
