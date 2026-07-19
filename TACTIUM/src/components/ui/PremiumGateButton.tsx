import React, { useMemo } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  type ViewStyle,
} from 'react-native';
import { useColors, useTypography, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import { usePremiumGate } from '@core/hooks/usePremiumGate';

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'subtle';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  isLoading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  // Identificador del flow para tracking analítico futuro
  // (ej. "lineup_save", "matchday_close").
  intent?: string;
}

/**
 * Botón que envuelve una acción premium. Comportamiento:
 *
 *   - Si el user actual tiene acceso premium en el team activo → ejecuta
 *     `onPress` normal (UI idéntica al Button base).
 *   - Si NO tiene acceso → intercepta `onPress` y navega a PaywallScreen.
 *
 * Visualmente NO hay candado ni "PRO" badge — la idea es que el usuario
 * no perciba el muro hasta que intenta usar la función. Si quieres
 * mostrar el upsell de forma proactiva, usa otro componente (banner,
 * TrialExpiringBanner, etc.).
 *
 * Para los players siempre devuelve `true` en `isPremium` por diseño,
 * así que estos botones nunca bloquean a un player.
 */
export const PremiumGateButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  intent,
}) => {
  // Reutiliza el gate central (incluye la cobertura dura: si el equipo de club
  // no está cubierto, ofrece cubrirlo o mejorar el plan en vez de ir directo
  // al paywall).
  const gate = usePremiumGate();
  const handlePress = gate(onPress, intent);

  const c = useColors();
  const t = useTypography();
  const styles = useMemo(() => makeStyles(c, t), [c, t]);

  const isDisabled = disabled || isLoading;
  const labelColor =
    variant === 'primary'
      ? c.textInverse
      : variant === 'destructive'
        ? c.error
        : variant === 'secondary'
          ? c.accent
          : c.text;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <View style={styles.content}>
          {iconLeft}
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          {iconRight}
        </View>
      )}
    </Pressable>
  );
};

const makeStyles = (c: Palette, t: ReturnType<typeof useTypography>) =>
  StyleSheet.create({
    base: {
      height: 54,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    primary: {
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    secondary: {
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    destructive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(255,107,107,0.4)',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    subtle: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    disabled: { opacity: 0.4 },
    label: {
      ...t.headline,
      fontSize: 16,
      letterSpacing: -0.2,
    },
  });
