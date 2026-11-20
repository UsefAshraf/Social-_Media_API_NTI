import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import type { ColorValue } from 'react-native';

import { HeaderButton } from '@/components';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName, focusedName: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color as string} />;
  };
}

const HomeIcon = tabIcon('home-outline', 'home');
const DiscoverIcon = tabIcon('compass-outline', 'compass');
const ProfileIcon = tabIcon('person-outline', 'person');

export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.primary,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: HomeIcon,
          tabBarButtonTestID: 'tab-home',
          headerRight: () => (
            <HeaderButton title="New post" onPress={() => router.push('/compose')} testID="new-post-button" />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: DiscoverIcon, tabBarButtonTestID: 'tab-discover' }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ProfileIcon,
          tabBarButtonTestID: 'tab-profile',
          headerRight: () => (
            <HeaderButton title="Settings" icon="settings-outline" onPress={() => router.push('/settings')} testID="settings-button" />
          ),
        }}
      />
    </Tabs>
  );
}
