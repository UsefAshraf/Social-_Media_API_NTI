import { Stack, useLocalSearchParams } from 'expo-router';

import { firstParam } from '@/components';
import { UserList } from '@/components/users';
import { useFollowing } from '@/features/users';

export default function FollowingScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id) ?? '';
  const result = useFollowing(id);
  return (
    <>
      <Stack.Screen options={{ title: result.total != null ? `${result.total} Following` : 'Following' }} />
      <UserList result={result} testID="following-list" emptyTitle="Not following anyone yet" />
    </>
  );
}
