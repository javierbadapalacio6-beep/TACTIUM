import React, { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { isUpdateRequired, STORE_URL } from '@core/services/appVersion';

/**
 * Pantalla de «actualiza para seguir» que tapa toda la app.
 *
 * Se activa cuando el build instalado es menor que el mínimo de `app_config`
 * (ver migración 20261024d). Se comprueba al arrancar y cada vez que la app
 * vuelve a primer plano, así que se aplica sin que nadie tenga que reiniciar.
 *
 * Solo funciona en builds que ya lleven este componente: a las versiones
 * anteriores no se las puede obligar desde aquí.
 */
export const ForceUpdateGate: React.FC = () => {
  const c = useColors();
  const s = makeStyles(c);
  const [required, setRequired] = useState(false);

  useEffect(() => {
    if (__DEV__) return;
    let alive = true;
    const check = () => {
      isUpdateRequired().then((r) => {
        if (alive) setRequired(r);
      });
    };
    check();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (!required) return null;

  return (
    <View style={s.root} accessibilityViewIsModal>
      <TactiumMark size={56} />
      <Text style={s.title}>Hay una versión nueva</Text>
      <Text style={s.text}>
        Para seguir usando TACTIUM tienes que actualizar la app. Son unos segundos y no pierdes nada.
      </Text>
      <Pressable
        onPress={() => Linking.openURL(STORE_URL).catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel="Abrir la tienda para actualizar TACTIUM"
        style={({ pressed }) => [s.button, pressed && { opacity: 0.85 }]}
      >
        <Text style={s.buttonText}>Actualizar</Text>
      </Pressable>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      elevation: 9999,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 14,
    },
    title: { color: c.text, fontSize: 22, fontWeight: '800', fontFamily: Fonts.sans, textAlign: 'center', marginTop: 10 },
    text: { color: c.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
    button: {
      marginTop: 12,
      alignSelf: 'stretch',
      maxWidth: 340,
      width: '100%',
      alignItems: 'center',
      paddingVertical: 15,
      borderRadius: 14,
      backgroundColor: c.accent,
    },
    buttonText: { color: c.textInverse, fontSize: 16, fontWeight: '800' },
  });
