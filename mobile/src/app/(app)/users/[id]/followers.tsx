import { Stack, useLocalSearchParams } from 'expo-router';

import { firstParam } from '@/components';
import { UserList } from '@/components/users';
import { useFollowers } from '@/features/users';

export default function FollowersScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id) ?? '';
  const result = useFollowers(id);
  return (
    <>
      <Stack.Screen options={{ title: result.total != null ? `${result.total} Followers` : 'Followers' }} />
      <UserList result={result} testID="followers-list" emptyTitle="No followers yet" />
    </>
  );
}
