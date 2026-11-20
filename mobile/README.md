# Social — mobile app

Expo (SDK 58) + TypeScript client for the Social Media API in the repo root.

## Run it

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:5000 npx expo start
```

The API URL comes from `EXPO_PUBLIC_API_URL`, falling back to `expo.extra.apiUrl` in `app.json`.
A phone can't reach `localhost` on your computer — use your LAN IP (Android emulator: `http://10.0.2.2:5000`).

| Command | |
|---|---|
| `npm test` | Jest (jest-expo) |
| `npm run typecheck` | `tsc --noEmit` |

## Structure

```
src/
├── app/                  # Expo Router routes (no tests in here — every file is a route)
│   ├── (auth)/           # login, register, forgot-password
│   ├── (app)/(tabs)/     # Home feed, Discover (latest/trending), Profile (my posts / saved)
│   ├── (app)/            # post/[id], compose (modal, ?postId= edits), hashtag/[tag],
│   │                     # users/[id] (+ /followers, /following), edit-profile (modal),
│   │                     # settings (account, blocked accounts, log out), blocked
│   └── reset-password, verify-email   # deep-link targets, reachable signed in or out
├── api/                  # axios client, token storage, errors, auth + posts endpoints and mapping
├── auth/                 # zustand session store (useAuth) — import from '@/auth'
├── features/posts/       # TanStack Query hooks: lists, optimistic likes/bookmarks/comments, pickImage
├── features/users/       # profiles, followers/following/blocked lists, optimistic follow, edit, block
├── components/           # UI kit + PostCard, PostList (FlashList), RichText, CommentItem,
│                         # ProfileHeader, FollowButton, UserList/UserRow
├── theme/                # light/dark tokens
└── lib/                  # config (API_URL), queryClient, shared types (contracts.ts, posts.ts, users.ts)
```

On Windows, run Jest from PowerShell (or any shell whose working directory starts with an
uppercase `C:\`). Under Git Bash the lowercase `c:\` makes expo-router's test renderer load
React twice and the routing tests fail with "Invalid hook call".

## Auth

- The access token lives in memory; the refresh token in `expo-secure-store`.
- On a 401 the client refreshes once and retries. Refresh is single-flight because the backend
  rotates refresh tokens — two parallel refreshes would invalidate each other.
- Only a rejected refresh token signs the user out; being offline keeps the session.

## Email links

Reset and verification emails link to `${FRONTEND_URL}/reset-password?token=…` and `/verify-email?token=…`.
Set the backend's `FRONTEND_URL` to the API's own public URL: the API serves those pages, which open
`socialapp://reset-password?token=…` (or `verify-email`) and fall back to a web form.
The `socialapp://` scheme only works in a development or store build, not in Expo Go.
