import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { useIsDark } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import { IconApple } from '@components/ui';

/**
 * «Continuar con Apple» con el estilo que pide Apple (HIG · Sign in with
 * Apple): logo + texto del sistema, blanco sobre fondo oscuro y negro sobre
 * fondo claro, sin otros colores. No usamos el botón nativo de
 * `expo-apple-authentication` porque se traduce con las localizaciones del
 * binario y la app no declara español: saldría «Continue with Apple».
 */
export const AppleSignInButton: React.FC<{
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
}> = ({ onPress, loading, disabled, height = 52 }) => {
  const dark = useIsDark();
  const bg = dark ? '#FFFFFF' : '#000000';
  const fg = dark ? '#000000' : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="Continuar con Apple"
      style={({ pressed }) => [
        styles.btn,
        { height, backgroundColor: bg },
        pressed && { opacity: 0.85 },
        disabled && !loading && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <IconApple size={19} color={fg} />
          <Text style={[styles.label, { color: fg }]}>Continuar con Apple</Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
