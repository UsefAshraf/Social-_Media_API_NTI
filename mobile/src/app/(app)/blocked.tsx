import { useCallback } from 'react';
import { Alert } from 'react-native';

import { toAppError } from '@/auth';
import { errorMessage } from '@/components';
import { UserList } from '@/components/users';
import { useBlockedUsers, useBlockUser } from '@/features/users';
import type { UserSummary } from '@/lib/users';

export default function BlockedScreen() {
  const result = useBlockedUsers();
  const { unblock } = useBlockUser();

  const confirmUnblock = useCallback(
    (user: UserSummary) =>
      Alert.alert(
        `Unblock @${user.username}?`,
        "They'll be able to see your profile and posts again. You won't automatically follow each other.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: () => {
              unblock(user.id).catch((e: unknown) => Alert.alert("Couldn't unblock", errorMessage(toAppError(e))));
            },
          },
        ],
      ),
    [unblock],
  );

  return (
    <UserList
      result={result}
      onUnblock={confirmUnblock}
      testID="blocked-list"
      emptyTitle="No blocked accounts"
      emptyMessage="People you block can't see your profile or posts, and you won't see theirs."
    />
  );
}
