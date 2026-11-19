import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

interface AvatarProps {
  uri: string | null;
  username: string;
  size?: number;
}

/**
 * Round avatar. The initial is drawn underneath as the placeholder, so there's
 * no blank circle while the image loads (or when the user has none).
 */
export const Avatar = memo(function Avatar({ uri, username, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      style={[styles.box, box, { backgroundColor: colors.placeholder }]}
      accessible
      accessibilityLabel={`${username}'s avatar`}
      accessibilityRole="image"
    >
      <Text style={{ color: colors.textMuted, fontSize: size * 0.42, fontWeight: '600' }}>
        {(username[0] ?? '?').toUpperCase()}
      </Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, box]}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={120}
          recyclingKey={uri}
          accessible={false}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
