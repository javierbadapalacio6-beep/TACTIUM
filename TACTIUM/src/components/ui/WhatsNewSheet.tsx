import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { useAuthStore } from '@store/authStore';
import { BottomSheet } from './BottomSheet';

/**
 * «Novedades»: se enseña UNA vez después de reiniciar con una actualización
 * nueva (la que anuncia `UpdateBanner`). La lista vive en el propio bundle
 * nuevo, que es el único que sabe qué trae.
 *
 * Al publicar una OTA con cambios que se vean: cambia `NOVEDADES.id` y la
 * lista. Si el id no cambia, no vuelve a salir.
 *
 * Patrón (Mobbin): Brink «Latest Changes» — icono + título + descripción
 * corta por novedad y un único «Continuar».
 */
const NOVEDADES = {
  id: '2026-10-26',
  items: [
    {
      icon: '📊',
      title: 'Clasificación completa y estadísticas',
      text: 'La tabla del grupo con todas las columnas de la Federación, y una pestaña Stats con mejores parejas, jugadores, rendimiento por pista y proyección.',
    },
    {
      icon: '📸',
      title: 'Fotos por pareja',
      text: 'Sube una foto de cada pareja y compártela con su resultado, los nombres completos y el logo de tu club.',
    },
    {
      icon: '🎓',
      title: 'Tutoriales',
      text: 'Pequeñas guías al entrar a un equipo, crear una jornada o hacer la alineación. Las repites desde Ajustes.',
    },
    {
      icon: '🔔',
      title: 'Voy / No en cuanto sale la hora',
      text: 'Si juegas fuera, en cuanto la Federación publica la hora tus jugadores reciben el Voy, Duda o No al instante.',
    },
  ],
};

const KEY = 'whatsnew:seen';

export const WhatsNewSheet: React.FC = () => {
  const c = useColors();
  const s = makeStyles(c);
  const user = useAuthStore((st) => st.user);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Solo si este arranque viene de una OTA (no del bundle de la tienda ni de
    // desarrollo) y hay sesión: a quien acaba de instalar no le contamos
    // «novedades» de algo que nunca vio.
    if (__DEV__ || Updates.isEmbeddedLaunch || !user) return;
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((seen) => {
        if (alive && seen !== NOVEDADES.id) setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const close = () => {
    setOpen(false);
    AsyncStorage.setItem(KEY, NOVEDADES.id).catch(() => {});
  };

  if (!open) return null;

  return (
    <BottomSheet
      open
      onClose={close}
      variant="modal"
      footer={
        <Pressable
          onPress={close}
          accessibilityRole="button"
          style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.primaryText}>Continuar</Text>
        </Pressable>
      }
    >
      <Text style={s.eyebrow}>NOVEDADES</Text>
      <Text style={s.title}>Esto es lo nuevo</Text>
      <View style={s.list}>
        {NOVEDADES.items.map((it) => (
          <View key={it.title} style={s.row}>
            <View style={s.icon}>
              <Text style={s.iconText}>{it.icon}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.rowTitle}>{it.title}</Text>
              <Text style={s.rowText}>{it.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '600',
    },
    title: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
    list: { gap: 18, marginTop: 20, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    iconText: { color: c.accent, fontSize: 17, fontWeight: '800' },
    rowTitle: { color: c.text, fontSize: 15.5, fontWeight: '700' },
    rowText: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
    primary: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
  });
