import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, SlideInDown, SlideOutUp } from 'react-native-reanimated';
import * as Updates from 'expo-updates';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { BottomSheet } from './BottomSheet';

/**
 * Aviso de que hay una versión nueva YA DESCARGADA, lista para aplicarse.
 *
 * POR QUÉ EXISTE. `expo-updates` no espera a la actualización al arrancar: la
 * app abre con el bundle que ya tenía y se descarga la nueva por detrás, que
 * se aplica en el arranque SIGUIENTE. O sea que hacen falta dos arranques en
 * frío, y nadie los hace a propósito: se puede ir días con una versión vieja
 * sin saberlo.
 *
 * No es «actualizar la app» (no hay que ir a la tienda): es REINICIARLA para
 * que se vean los cambios. Por eso el texto lo dice así.
 *
 * Patrón (Mobbin): hoja inferior de novedades con icono, título y una sola
 * acción grande (Brink «Latest Changes», ChatGPT «Introducing…», eBay), y un
 * «Ahora no» que no castiga: deja una píldora discreta arriba para volver.
 *
 * Se monta UNA vez, junto al banner de conexión. Si no hay nada pendiente no
 * pinta nada.
 */
export const UpdateBanner: React.FC = () => {
  const c = useColors();
  const s = makeStyles(c);
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [reloading, setReloading] = useState(false);
  // 'sheet' la primera vez; 'pill' tras «Ahora no»; 'off' si se descarta.
  const [mode, setMode] = useState<'sheet' | 'pill' | 'off'>('sheet');

  // Una actualización nueva (otra distinta) vuelve a enseñar la hoja.
  useEffect(() => {
    if (isUpdatePending) setMode('sheet');
  }, [isUpdatePending]);

  if (!isUpdatePending || mode === 'off') return null;

  const aplicar = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Si el reinicio falla, se aplicará igualmente en el próximo arranque:
      // no es un callejón sin salida, así que solo se esconde el aviso.
      setMode('off');
    }
  };

  if (mode === 'pill') {
    return (
      <View pointerEvents="box-none" style={[s.host, { paddingTop: insets.top + 4 }]}>
        <Animated.View
          entering={SlideInDown.duration(220).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutUp.duration(180).easing(Easing.in(Easing.cubic))}
          style={s.pill}
        >
          <Pressable
            onPress={() => setMode('sheet')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ver la versión nueva"
            style={s.pillMain}
          >
            <View style={s.dot} />
            <Text style={s.pillLabel}>Novedades listas</Text>
            <Text style={s.pillAction}>Reiniciar</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('off')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cerrar aviso"
          >
            <Text style={s.pillClose}>×</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <BottomSheet
      open
      onClose={() => setMode('pill')}
      scrollable={false}
      variant="modal"
      footer={
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={aplicar}
            disabled={reloading}
            accessibilityRole="button"
            accessibilityLabel="Reiniciar la app para ver las novedades"
            style={({ pressed }) => [s.primary, (pressed || reloading) && { opacity: 0.85 }]}
          >
            {reloading ? (
              <ActivityIndicator color={c.textInverse} />
            ) : (
              <Text style={s.primaryText}>Reiniciar y ver novedades</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setMode('pill')}
            disabled={reloading}
            hitSlop={6}
            accessibilityRole="button"
            style={s.secondary}
          >
            <Text style={s.secondaryText}>Ahora no</Text>
          </Pressable>
        </View>
      }
    >
      <View style={s.body}>
        <View style={s.badge}>
          <TactiumMark size={44} />
        </View>
        <Text style={s.eyebrow}>VERSIÓN NUEVA LISTA</Text>
        <Text style={s.title}>Hay novedades en TACTIUM</Text>
        <Text style={s.text}>
          Ya está descargada. Reinicia la app para verlas: tarda un segundo y no tienes que
          pasar por la tienda.
        </Text>
        <View style={s.steps}>
          <Step c={c} n="1" t="Pulsa «Reiniciar y ver novedades»" />
          <Step c={c} n="2" t="La app se cierra y se abre sola" />
          <Step c={c} n="3" t="Te enseñamos qué ha cambiado" />
        </View>
      </View>
    </BottomSheet>
  );
};

const Step: React.FC<{ c: Palette; n: string; t: string }> = ({ c, n, t }) => {
  const s = makeStyles(c);
  return (
    <View style={s.step}>
      <View style={s.stepNum}>
        <Text style={s.stepNumText}>{n}</Text>
      </View>
      <Text style={s.stepText}>{t}</Text>
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
      zIndex: 999,
      elevation: 999,
      alignItems: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingLeft: 12,
      paddingRight: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.bgCard,
    },
    pillMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent },
    pillLabel: { color: c.text, fontSize: 12.5, fontWeight: '600' },
    pillAction: { color: c.accent, fontSize: 12.5, fontWeight: '800' },
    pillClose: { color: c.textMuted, fontSize: 18, lineHeight: 18, fontWeight: '500' },
    body: { alignItems: 'center', paddingTop: 6, paddingBottom: 4 },
    badge: {
      width: 76,
      height: 76,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      marginBottom: 16,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '600',
    },
    title: {
      color: c.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
      textAlign: 'center',
      marginTop: 6,
    },
    text: {
      color: c.textMuted,
      fontSize: 14.5,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 320,
    },
    steps: { alignSelf: 'stretch', gap: 10, marginTop: 20 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepNum: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    stepNumText: { fontFamily: Fonts.mono, color: c.text, fontSize: 12, fontWeight: '700' },
    stepText: { color: c.text, fontSize: 14, flex: 1 },
    primary: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
    secondary: { alignItems: 'center', paddingVertical: 6 },
    secondaryText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
  });
