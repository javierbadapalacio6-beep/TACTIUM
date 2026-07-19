import React, { useMemo } from 'react';
import {
  Image,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, darkColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { initialsOf } from '@core/utils/format';

/** Avatar de comunidad: foto si la hay, si no gradiente + iniciales. */
export const CommunityAvatar: React.FC<{
  name: string;
  avatarUrl?: string | null;
  size?: number;
}> = ({ name, avatarUrl, size = 44 }) => {
  const c = useColors();
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
          borderColor: c.accent40,
        }}
      />
    );
  }
  // Avatar sin foto: chip de degradado verde con iniciales. Paleta oscura
  // fija para que las iniciales (verde neón) se lean sobre el verde también
  // en modo claro (con la paleta clara quedaban verde sobre verde).
  return (
    <LinearGradient
      colors={[darkColors.primary, darkColors.bgCard2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: darkColors.accent40,
      }}
    >
      <Text
        style={{
          color: darkColors.accent,
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
}> = ({ following, busy, onPress, size = 'md' }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
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
          color={following ? c.textMuted : c.textInverse}
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
};

const makeStyles = (c: Palette) => StyleSheet.create({
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
  btnFollow: { backgroundColor: c.accent, borderColor: c.accent },
  btnFollowing: {
    backgroundColor: 'transparent',
    borderColor: c.hairStrong,
  },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  labelSm: { fontSize: 13 },
  labelFollow: { color: c.textInverse },
  labelFollowing: { color: c.textMuted },
});

/** Ver el módulo como componente vacío evita el warning de fast-refresh. */
export default {};
