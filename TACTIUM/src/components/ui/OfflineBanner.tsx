import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutUp,
} from 'react-native-reanimated';

import { useColors } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { useConnectionStore } from '@store/connectionStore';
import { IconAlert, IconCheck } from './Icon';

// Banner global de conexión. Se monta UNA vez en App.tsx, sobre el
// NavigationContainer. Estados:
//   - online → no renderiza nada (return null).
//   - offline → banner amarillo persistente "Sin conexión".
//   - reconectado tras estar offline → banner verde "Conexión restaurada"
//     durante ~1.8s y luego se oculta.
//
// Posición: top, justo bajo el status bar. Usa SlideInDown / SlideOutUp
// para que entre y salga de forma "decreasing in importance" (Reanimated).
export const OfflineBanner: React.FC = () => {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const isOnline = useConnectionStore((s) => s.isOnline);
  const changedAt = useConnectionStore((s) => s.changedAt);

  // Tras volver online, mantenemos el banner verde 1.8s para que el
  // usuario perciba el cambio (en vez de quitar el banner sin más).
  const [showReconnected, setShowReconnected] = useState(false);
  useEffect(() => {
    if (isOnline && changedAt > 0) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 1800);
      return () => clearTimeout(t);
    }
  }, [isOnline, changedAt]);

  const visible = !isOnline || showReconnected;
  const palette = isOnline
    ? {
        bg: 'rgba(0,223,130,0.12)',
        border: 'rgba(0,223,130,0.55)',
        text: c.accent,
        Icon: IconCheck,
        label: 'Conexión restaurada',
      }
    : {
        bg: 'rgba(242,201,76,0.14)',
        border: 'rgba(242,201,76,0.55)',
        text: c.warning,
        Icon: IconAlert,
        label: 'Sin conexión',
      };
  const Icon = palette.Icon;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + 4 }]}
    >
      {visible ? (
        <Animated.View
          key={isOnline ? 'online' : 'offline'}
          entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutUp.duration(180).easing(Easing.in(Easing.cubic))}
          accessibilityRole="alert"
          accessibilityLabel={palette.label}
          style={[
            styles.banner,
            { backgroundColor: palette.bg, borderColor: palette.border },
          ]}
        >
          <Icon size={12} color={palette.text} />
          <Text style={[styles.label, { color: palette.text }]}>
            {palette.label}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 999,
    elevation: 999,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '600',
  },
});
