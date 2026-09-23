import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, SlideInDown, SlideOutUp } from 'react-native-reanimated';
import * as Updates from 'expo-updates';

import { useColors } from '@core/theme';
import { Fonts } from '@core/theme/fonts';

/**
 * Aviso de que hay una actualización lista para aplicarse.
 *
 * POR QUÉ EXISTE. `expo-updates` no espera a la actualización al arrancar: la
 * app abre con el bundle que ya tenía y se descarga la nueva por detrás, que
 * se aplica en el arranque SIGUIENTE. O sea que hacen falta dos arranques en
 * frío, y nadie los hace a propósito: se puede ir días con una versión vieja
 * sin saberlo, y sin forma de saberlo. Nos pasó a nosotros probando.
 *
 * La alternativa era esperar a la descarga antes de pintar nada, pero eso
 * alarga CADA arranque y con mala cobertura se nota. Esto no toca el arranque:
 * cuando la actualización ya está descargada, aparece el aviso y decide quien
 * lo está usando.
 *
 * Se monta UNA vez, junto al banner de conexión. Si no hay nada pendiente no
 * pinta nada.
 */
export const UpdateBanner: React.FC = () => {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [reloading, setReloading] = useState(false);
  const [descartado, setDescartado] = useState(false);

  if (!isUpdatePending || descartado) return null;

  const aplicar = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Si el reinicio falla, la actualización se aplicará igualmente en el
      // próximo arranque: no es un callejón sin salida, así que solo se
      // esconde el aviso en vez de asustar con un error.
      setDescartado(true);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + 4 }]}
    >
      <Animated.View
        entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
        exiting={SlideOutUp.duration(180).easing(Easing.in(Easing.cubic))}
        accessibilityRole="alert"
        style={[
          styles.banner,
          { backgroundColor: 'rgba(0,223,130,0.12)', borderColor: c.accent40 },
        ]}
      >
        <Text style={[styles.label, { color: c.accent }]}>VERSIÓN NUEVA</Text>
        <Pressable
          onPress={aplicar}
          disabled={reloading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reiniciar para aplicar la actualización"
        >
          {reloading ? (
            <ActivityIndicator size="small" color={c.accent} />
          ) : (
            <Text style={[styles.action, { color: c.accent }]}>Reiniciar</Text>
          )}
        </Pressable>
        {/* Descartable: nadie debería quedarse atrapado bajo un aviso, y la
            actualización se aplicará sola en el próximo arranque. */}
        <Pressable
          onPress={() => setDescartado(true)}
          disabled={reloading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ahora no"
        >
          <Text style={[styles.dismiss, { color: c.textMuted }]}>Ahora no</Text>
        </Pressable>
      </Animated.View>
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
    gap: 10,
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
  action: { fontSize: 12.5, fontWeight: '700' },
  dismiss: { fontSize: 12, fontWeight: '500' },
});
