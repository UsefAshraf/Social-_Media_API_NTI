/**
 * Every users query key. Profiles live under ['users', 'profile', id] — the viewer's own profile uses their
 * real id too (never 'me'), so it is cached once. Lists live under ['users', 'list', …].
 */
export const userKeys = {
  all: ['users'] as const,
  profiles: () => ['users', 'profile'] as const,
  profile: (userId: string) => ['users', 'profile', userId] as const,
  lists: () => ['users', 'list'] as const,
  followers: (userId: string) => ['users', 'list', 'followers', userId] as const,
  following: (userId: string) => ['users', 'list', 'following', userId] as const,
  blocked: () => ['users', 'list', 'blocked'] as const,
};
