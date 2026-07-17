import React from 'react';
import {
  Image,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { initialsOf } from '@core/utils/format';

/** Avatar de comunidad: foto si la hay, si no gradiente + iniciales. */
export const CommunityAvatar: React.FC<{
  name: string;
  avatarUrl?: string | null;
  size?: number;
}> = ({ name, avatarUrl, size = 44 }) => {
  const radius = Math.round(size * 0.28);
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: Colors.accent40,
        }}
      />
    );
  }
  return (
    <LinearGradient
      colors={[Colors.primary, Colors.bgCard2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.accent40,
      }}
    >
      <Text
        style={{
          color: Colors.accent,
          fontWeight: '700',
          fontSize: Math.round(size * 0.36),
          fontFamily: Fonts.mono,
        }}
      >
        {initialsOf(name)}
      </Text>
    </LinearGradient>
  );
};

/** Botón Seguir / Siguiendo (optimista lo gestiona el que lo usa). */
export const FollowButton: React.FC<{
  following: boolean;
  busy?: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
}> = ({ following, busy, onPress, size = 'md' }) => (
  <Pressable
    onPress={onPress}
    disabled={busy}
    accessibilityRole="button"
    accessibilityLabel={following ? 'Dejar de seguir' : 'Seguir'}
    style={({ pressed }) => [
      styles.btn,
      size === 'sm' && styles.btnSm,
      following ? styles.btnFollowing : styles.btnFollow,
      pressed && { opacity: 0.85 },
      busy && { opacity: 0.6 },
    ]}
  >
    {busy ? (
      <ActivityIndicator
        size="small"
        color={following ? Colors.textMuted : Colors.textInverse}
      />
    ) : (
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.labelSm,
          following ? styles.labelFollowing : styles.labelFollow,
        ]}
      >
        {following ? 'Siguiendo' : 'Seguir'}
      </Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    minWidth: 104,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnSm: { minWidth: 92, height: 34, borderRadius: 10, paddingHorizontal: 12 },
  btnFollow: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  btnFollowing: {
    backgroundColor: 'transparent',
    borderColor: Colors.hairStrong,
  },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  labelSm: { fontSize: 13 },
  labelFollow: { color: Colors.textInverse },
  labelFollowing: { color: Colors.textMuted },
});

/** Ver el módulo como componente vacío evita el warning de fast-refresh. */
export default {};
