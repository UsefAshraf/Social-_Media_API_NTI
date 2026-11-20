// Profile / people components. Kept out of the main barrel (like ./posts) so screens that only
// need the form primitives don't pull in FlashList and the users data layer.
export { ProfileHeader, formatJoined } from './ProfileHeader';
export { FollowButton } from './FollowButton';
export { UserRow, type UserRowProps } from './UserRow';
export { UserList } from './UserList';
