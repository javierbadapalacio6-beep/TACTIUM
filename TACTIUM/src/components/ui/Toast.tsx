import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { useToastStore, type ToastKind } from '@store/toastStore';
import { useConnectionStore } from '@store/connectionStore';
import { IconCheck, IconAlert, IconX } from './Icon';

// Token visual por tipo. Mantiene consistencia con el sistema de color.
// El `tint` es un overlay translúcido que se pinta SOBRE el bgRaised
// sólido para dar color al toast sin sacrificar opacidad. El antiguo
// `bg` translúcido dejaba pasar el negro del status bar / dynamic island.
const makeKindStyle = (
  c: Palette,
): Record<
  ToastKind,
  { tint: string; border: string; iconColor: string; Icon: React.FC<{ size?: number; color?: string }> }
> => ({
  success: {
    tint: 'rgba(0,223,130,0.14)',
    border: 'rgba(0,223,130,0.55)',
    iconColor: c.accent,
    Icon: IconCheck,
  },
  error: {
    tint: 'rgba(255,107,107,0.14)',
    border: 'rgba(255,107,107,0.55)',
    iconColor: c.error,
    Icon: IconAlert,
  },
  warn: {
    tint: 'rgba(242,201,76,0.14)',
    border: 'rgba(242,201,76,0.55)',
    iconColor: c.warning,
    Icon: IconAlert,
  },
  info: {
    tint: 'rgba(232,245,239,0.06)',
    border: 'rgba(232,245,239,0.20)',
    iconColor: c.text,
    Icon: IconAlert,
  },
});

// Host del sistema de toasts. Se monta UNA vez en App.tsx, fuera del
// NavigationContainer pero dentro de SafeAreaProvider, para flotar
// siempre encima de cualquier pantalla.
//
// Diseño:
//   - Se renderiza desde arriba (debajo del notch/Dynamic Island).
//   - Entrada FadeInDown 240ms ease-out, salida FadeOutUp 180ms.
//   - Auto-dismiss según `durationMs` del toast actual.
//   - Tap → dismiss inmediato (anula el timer).
export const ToastHost: React.FC = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const KIND_STYLE = useMemo(() => makeKindStyle(c), [c]);
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  // Si hay banner offline arriba, empujamos el toast un poco más abajo
  // para que no se solapen visualmente (el banner mide ~30px alto).
  const isOnline = useConnectionStore((s) => s.isOnline);
  const bannerOffset = isOnline ? 0 : 38;

  // Cada toast nuevo resetea el timer (depende de id).
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismiss, current.durationMs);
    return () => clearTimeout(t);
  }, [current?.id, current?.durationMs, dismiss, current]);

  const style = current ? KIND_STYLE[current.kind] : null;
  const Icon = style?.Icon;

  // El host se mantiene SIEMPRE montado para que el `exiting` animation
  // del Animated.View interno se reproduzca cuando un toast desaparece.
  // Si retornáramos null aquí, Reanimated no tendría tiempo de animar
  // la salida (parent unmount = exit cancelado).
  return (
    <View
      pointerEvents="box-none"
      // +14 (era +6) para que el toast respire del status bar y dynamic
      // island en iPhones modernos.
      style={[styles.host, { paddingTop: insets.top + 14 + bannerOffset }]}
    >
      {current && style && Icon ? (
        <Animated.View
          key={current.id}
          entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic))}
          exiting={FadeOutUp.duration(180).easing(Easing.in(Easing.cubic))}
          style={styles.toastWrap}
        >
          <Pressable
            onPress={dismiss}
            accessibilityRole="alert"
            accessibilityLabel={`${current.title}${current.description ? '. ' + current.description : ''}`}
            style={({ pressed }) => [
              styles.toast,
              { borderColor: style.border },
              pressed && { opacity: 0.92 },
            ]}
          >
            {/* Overlay translúcido con el tint del kind. Pinta sobre el
                bgRaised sólido del toast, así el color del estado se nota
                sin perder opacidad de fondo. */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: style.tint, borderRadius: 14 },
              ]}
            />
            <View
              style={[styles.iconWrap, { backgroundColor: style.border + '22' }]}
            >
              <Icon size={14} color={style.iconColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={2}>
                {current.title}
              </Text>
              {current.description ? (
                <Text style={styles.description} numberOfLines={3}>
                  {current.description}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={dismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso"
              style={styles.closeBtn}
            >
              <IconX size={14} color={c.textMuted} />
            </Pressable>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    host: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      zIndex: 1000,
      elevation: 1000,
    },
    toastWrap: {
      width: '100%',
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      // Fondo SÓLIDO (bgRaised). El tint del kind va como overlay encima
      // — así el toast nunca es translúcido frente al status bar.
      backgroundColor: c.bgRaised,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 14,
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    title: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    description: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    closeBtn: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
