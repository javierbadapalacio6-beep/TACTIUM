import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet } from './BottomSheet';

/**
 * Tutoriales dentro de la app. Hoja inferior con pasos (patrón Mobbin: Binance / Posh / Deepstash): barra
 * de progreso arriba, un icono, título, texto corto y un único botón «Siguiente» → «Entendido». Cada tutorial
 * sale UNA vez (se recuerda en el móvil) y se puede volver a ver desde Ajustes.
 */
export type TutorialId = 'team-welcome' | 'create-matchday' | 'lineup';

export interface TutorialStep {
  icon: string;
  title: string;
  text: string;
}

export const TUTORIALS: Record<TutorialId, { name: string; steps: TutorialStep[] }> = {
  'team-welcome': {
    name: 'Cómo moverte por tu equipo',
    steps: [
      {
        icon: '🏠',
        title: 'Inicio: lo que viene',
        text: 'Aquí ves siempre la próxima jornada, quién ha dicho que va y lo que te falta por hacer. Es lo primero que se actualiza.',
      },
      {
        icon: '📅',
        title: 'Jornadas',
        text: 'Cada jornada tiene su previa, su alineación, el resultado en directo y las fotos. La hora y la sede se copian solas de la Federación.',
      },
      {
        icon: '✅',
        title: 'Disponibilidad en un toque',
        text: 'Tu equipo responde Voy, Duda o No desde la notificación o desde un enlace, sin tener la app. Tú ves el cupo al momento.',
      },
      {
        icon: '🏛',
        title: 'Federación',
        text: 'La clasificación, los partidos y las actas de tu grupo. Si la Federación todavía no ha subido algo, lo calculamos con tus actas.',
      },
    ],
  },
  'create-matchday': {
    name: 'Crear una jornada',
    steps: [
      {
        icon: '🆚',
        title: 'Rival y número de jornada',
        text: 'Pon contra quién juegas y el número de jornada. Es lo único obligatorio.',
      },
      {
        icon: '🏠',
        title: 'Casa o fuera',
        text: 'Marca si juegas de local o de visitante. Fuera, la hora la fija el otro club: te avisamos en cuanto la suba a la Federación.',
      },
      {
        icon: '🗓',
        title: 'Fecha, hora y tandas',
        text: 'Si ya las sabes, ponlas. Si no, déjalas en blanco: la Federación las rellena sola cuando las publica.',
      },
      {
        icon: '⚡',
        title: '¿Muchas jornadas?',
        text: 'Importa todo el calendario de una vez (escaneando la foto o desde la Federación) en lugar de crearlas una a una.',
      },
    ],
  },
  lineup: {
    name: 'Hacer la alineación',
    steps: [
      {
        icon: '👥',
        title: 'Primero, quién puede jugar',
        text: 'La alineación parte de las respuestas de disponibilidad. Quien dijo que no, no aparece como opción.',
      },
      {
        icon: '🎾',
        title: 'Parejas por pista',
        text: 'Toca una pista y elige a los dos jugadores. Las pistas se ordenan solas por la suma de puntos de cada pareja.',
      },
      {
        icon: '📋',
        title: 'Varias opciones',
        text: 'Puedes guardar variantes y elegir cuál es la oficial. Los jugadores solo ven la que publiques.',
      },
      {
        icon: '📤',
        title: 'Publicar y subir a la Federación',
        text: 'Publícala para avisar al equipo. Después súbela a la Federación y márcalo: si no, te avisamos 24 h, 3 h y 1 h antes.',
      },
    ],
  },
};

const key = (id: TutorialId, scope?: string) => `tutorial:${id}${scope ? `:${scope}` : ''}`;

export async function resetTutorials(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('tutorial:')));
  } catch {
    // sin almacenamiento: nada que borrar
  }
}

/**
 * Controla un tutorial. `show(then)`: si ya se vio, ejecuta `then` al momento; si no, abre la hoja y
 * `then` se ejecuta al cerrarla (para encadenar, p. ej., la hoja de «Añadir jornada» después del tutorial).
 * `auto(delayMs)`: lo abre solo la primera vez (entrar a un equipo, a la alineación).
 */
export function useTutorial(id: TutorialId, scope?: string) {
  const [visible, setVisible] = useState(false);
  const thenRef = useRef<(() => void) | null>(null);

  const markSeen = useCallback(() => {
    AsyncStorage.setItem(key(id, scope), '1').catch(() => {});
  }, [id, scope]);

  const show = useCallback(
    (then?: () => void) => {
      AsyncStorage.getItem(key(id, scope))
        .then((seen) => {
          if (seen) {
            then?.();
            return;
          }
          thenRef.current = then ?? null;
          setVisible(true);
        })
        .catch(() => then?.());
    },
    [id, scope],
  );

  const showAgain = useCallback(() => {
    thenRef.current = null;
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    markSeen();
    const then = thenRef.current;
    thenRef.current = null;
    if (then) setTimeout(then, 250);
  }, [markSeen]);

  return { visible, show, showAgain, close };
}

/** Abre un tutorial solo la primera vez, a los `delayMs` de montar la pantalla (si `enabled`). */
export function useAutoTutorial(id: TutorialId, scope: string | undefined, enabled: boolean, delayMs = 1200) {
  const tut = useTutorial(id, scope);
  const showRef = useRef(tut.show);
  showRef.current = tut.show;
  useEffect(() => {
    if (!enabled || __DEV__) return;
    const t = setTimeout(() => showRef.current(), delayMs);
    return () => clearTimeout(t);
  }, [enabled, delayMs, scope]);
  return tut;
}

export const TutorialSheet: React.FC<{ id: TutorialId; visible: boolean; onClose: () => void }> = ({
  id,
  visible,
  onClose,
}) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [i, setI] = useState(0);
  const tut = TUTORIALS[id];

  useEffect(() => {
    if (visible) setI(0);
  }, [visible]);

  if (!visible) return null;
  const step = tut.steps[i];
  const last = i === tut.steps.length - 1;
  return (
    <BottomSheet
      open
      onClose={onClose}
      variant="modal"
      footer={
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => (last ? onClose() : setI(i + 1))}
            accessibilityRole="button"
            style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.primaryText}>{last ? 'Entendido' : 'Siguiente'}</Text>
          </Pressable>
          {!last ? (
            <Pressable onPress={onClose} accessibilityRole="button" style={s.skip}>
              <Text style={s.skipText}>Saltar tutorial</Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View style={s.progress}>
        {tut.steps.map((_, n) => (
          <View key={n} style={[s.seg, n <= i && { backgroundColor: c.accent }]} />
        ))}
      </View>
      <Text style={s.eyebrow}>
        {tut.name.toUpperCase()} · {i + 1}/{tut.steps.length}
      </Text>
      <View style={s.iconWrap}>
        <Text style={s.icon}>{step.icon}</Text>
      </View>
      <Text style={s.title}>{step.title}</Text>
      <Text style={s.text}>{step.text}</Text>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    progress: { flexDirection: 'row', gap: 6, marginBottom: 14 },
    seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.hair },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1.6, color: c.accent, fontWeight: '600' },
    iconWrap: {
      alignSelf: 'center',
      width: 84,
      height: 84,
      borderRadius: 42,
      marginTop: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
    },
    icon: { fontSize: 40 },
    title: { marginTop: 16, color: c.text, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
    text: { marginTop: 8, marginBottom: 6, color: c.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    primary: { height: 50, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
    primaryText: { color: '#04110B', fontSize: 16, fontWeight: '800' },
    skip: { alignItems: 'center', paddingVertical: 6 },
    skipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  });
