import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@core/theme/useColors';
import type { Palette } from '@core/theme/colors';
import { Spacing } from '@core/theme/spacing';
import { IconX } from '@components/ui/Icon';
import { LayoutMetrics, MODAL_ORIENTATIONS } from '@components/ui/ResponsiveFrame';

export type PanelVariant = 'side' | 'modal';

export interface PanelModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 'side' = panel a la derecha (420); 'modal' = centrado (560). */
  variant?: PanelVariant;
  /** Título opcional de la cabecera (a la izquierda del botón cerrar). */
  title?: string;
  /** Footer fijo abajo (CTA principal), fuera del scroll. */
  footer?: React.ReactNode;
  scrollable?: boolean;
  /** Ancho a medida (por defecto 420 en 'side' y 560 en 'modal'). */
  width?: number;
}

// En iOS los <Modal> se pintan fuera del árbol del SafeAreaProvider y los
// insets pueden llegar a 0: usamos un mínimo razonable de iPad.
const TOP_FALLBACK = Platform.OS === 'ios' ? 24 : 0;
const BOTTOM_FALLBACK = Platform.OS === 'ios' ? 20 : 0;

/**
 * Presentación de TABLET de hojas y paneles. La usan `SidePanel` y
 * `BottomSheet` (en tablet). No usar directamente desde pantallas.
 */
export const PanelModal: React.FC<PanelModalProps> = ({
  open,
  onClose,
  children,
  variant = 'side',
  title,
  footer,
  scrollable = true,
  width,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const isSide = variant === 'side';
  const panelWidth = Math.min(
    width ?? (isSide ? LayoutMetrics.sidePanel : LayoutMetrics.modal),
    win.width - (isSide ? 0 : 48),
  );

  // Montado mientras dura la animación de salida.
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (open) {
      setMounted(true);
      progress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
      closeTimer.current = setTimeout(() => setMounted(false), 210);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, progress]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panelStyle = useAnimatedStyle(() =>
    isSide
      ? { transform: [{ translateX: (1 - progress.value) * (panelWidth + 24) }] }
      : {
          opacity: progress.value,
          transform: [{ scale: 0.96 + progress.value * 0.04 }],
        },
  );

  const top = Math.max(insets.top, TOP_FALLBACK);
  const bottom = Math.max(insets.bottom, BOTTOM_FALLBACK);

  const header = (
    <View style={[styles.header, isSide && { paddingTop: top + 10 }]}>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
      >
        <IconX size={16} color={c.textMuted} />
      </Pressable>
    </View>
  );

  const contentPadBottom = footer ? 16 : bottom + 24;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      supportedOrientations={MODAL_ORIENTATIONS}
    >
      <View style={[styles.root, !isSide && styles.rootCentered]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={isSide ? styles.sideWrap : styles.modalWrap}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              isSide ? styles.side : styles.modal,
              { width: panelWidth },
              !isSide && { maxHeight: win.height - top - bottom - 48 },
              panelStyle,
            ]}
          >
            {header}
            {scrollable ? (
              <ScrollView
                style={isSide ? styles.flex : styles.shrink}
                contentContainerStyle={[styles.content, { paddingBottom: contentPadBottom }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.content,
                  isSide && styles.flex,
                  { paddingBottom: contentPadBottom },
                ]}
              >
                {children}
              </View>
            )}
            {footer ? (
              <View style={[styles.footer, { paddingBottom: bottom + 16 }]}>{footer}</View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    shrink: { flexShrink: 1 },
    root: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    rootCentered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrim: {
      backgroundColor: c.overlay,
    },
    sideWrap: {
      height: '100%',
    },
    modalWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    side: {
      flex: 1,
      backgroundColor: c.bgRaised,
      borderLeftWidth: 1,
      borderLeftColor: c.hairStrong,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: -6, height: 0 },
      elevation: 16,
    },
    modal: {
      backgroundColor: c.bgRaised,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.md + 4,
      paddingTop: 14,
      paddingBottom: 6,
    },
    title: {
      flex: 1,
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.hair,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    content: {
      paddingHorizontal: Spacing.md + 4,
      paddingTop: 8,
      gap: 14,
    },
    footer: {
      paddingHorizontal: Spacing.md + 4,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
  });
