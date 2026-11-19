// Test-only stand-in for @shopify/flash-list: jest-expo's default transformIgnorePatterns
// don't transpile its ESM build, and FlatList renders every row synchronously in tests.
// Usage: jest.mock('@shopify/flash-list', () => require('@/components/__testutils__/flashListMock'));
import { FlatList, type FlatListProps } from 'react-native';

type Props<T> = FlatListProps<T> & { getItemType?: unknown; drawDistance?: number; masonry?: boolean };

export function FlashList<T>({ getItemType: _g, drawDistance: _d, masonry: _m, ...props }: Props<T>) {
  return <FlatList {...props} />;
}

export type ListRenderItem<T> = NonNullable<FlatListProps<T>['renderItem']>;
