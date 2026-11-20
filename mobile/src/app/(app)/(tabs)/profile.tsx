import { useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/auth';
import { Banner, Button, errorMessage, SegmentedControl, VerifyEmailBanner } from '@/components';
import { PostList } from '@/components/posts';
import { ProfileHeader } from '@/components/users';
import { useBookmarks, useUserPosts } from '@/features/posts';
import { useProfile } from '@/features/users';
import type { PostListResult } from '@/lib/posts';
import { useTheme } from '@/theme';

type Segment = 'posts' | 'saved';

const SEGMENTS = [
  { value: 'posts', label: 'Posts' },
  { value: 'saved', label: 'Saved' },
] as const;

// The settings gear is in the tab's header (see (tabs)/_layout.tsx).
export default function ProfileScreen() {
  const user = useAuth((s) => s.user);
  const myId = user?.id ?? '';
  const { profile, isLoading, error, refetch } = useProfile(myId);
  const { colors, spacing } = useTheme();
  const [segment, setSegment] = useState<Segment>('posts');

  const header = (
    <View>
      {user && user.emailVerified === false ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <VerifyEmailBanner email={user.email} />
        </View>
      ) : null}
      {profile ? (
        <ProfileHeader profile={profile} />
      ) : isLoading ? (
        <View style={{ padding: spacing.xl }}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading profile" />
        </View>
      ) : error ? (
        <View style={{ padding: spacing.lg }}>
          <Banner tone="error" title="Couldn't load your profile" message={errorMessage(error)}>
            <Button title="Try again" variant="link" onPress={() => refetch()} />
          </Banner>
        </View>
      ) : null}
      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
    </View>
  );

  // Only the visible segment's hook is mounted, so only it fetches.
  return segment === 'posts' ? (
    <MyPosts userId={myId} header={header} refetchProfile={refetch} />
  ) : (
    <Saved header={header} refetchProfile={refetch} />
  );
}

interface ListProps {
  header: ReactElement;
  refetchProfile: () => unknown;
}

/** Pull-to-refresh refreshes the profile (counts) as well as the list. */
function useWithProfileRefetch(result: PostListResult, refetchProfile: () => unknown): PostListResult {
  return useMemo(
    () => ({ ...result, refetch: () => Promise.all([result.refetch(), refetchProfile()]) }),
    [result, refetchProfile],
  );
}

function MyPosts({ userId, header, refetchProfile }: ListProps & { userId: string }) {
  const result = useWithProfileRefetch(useUserPosts(userId), refetchProfile);
  return (
    <PostList
      result={result}
      header={header}
      testID="my-posts"
      emptyTitle="No posts yet"
      emptyMessage="Your posts will show up here."
    />
  );
}

function Saved({ header, refetchProfile }: ListProps) {
  const result = useWithProfileRefetch(useBookmarks(), refetchProfile);
  return (
    <PostList
      result={result}
      header={header}
      testID="saved-posts"
      emptyTitle="No saved posts"
      emptyMessage="Tap the bookmark icon on a post to save it here."
    />
  );
}
