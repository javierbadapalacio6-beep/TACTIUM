import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';

/**
 * Guía sobre la propia pantalla («coach marks»): un velo oscuro con un hueco iluminado sobre el elemento que
 * se explica y un globo con el texto, paso a paso. Se usa DENTRO de la pantalla donde está la mecánica
 * (alineación, plantilla, temporada). Sale una vez (se recuerda en el móvil) y se repite desde Ajustes.
 *
 * Uso: `const coach = useCoach('lineup', undefined, enabled)`; `ref={coach.ref('bench')}` y
 * `collapsable={false}` en cada elemento explicado; `<CoachTour coach={coach} steps={[…]} />` en la pantalla.
 * Un paso sin elemento (o con el elemento fuera de pantalla) se muestra como tarjeta centrada.
 */
export interface CoachStep {
  /** Clave del elemento (la de `coach.ref`). Sin ella, tarjeta centrada. */
  target?: string;
  title: string;
  text: string;
  /** Pasos de la mecánica, en chips numerados («Toca un jugador», «Toca el hueco»). */
  chips?: string[];
}

export interface Coach {
  visible: boolean;
  ref: (key: string) => (node: View | null) => void;
  measure: (key: string) => Promise<{ x: number; y: number; w: number; h: number } | null>;
  start: () => void;
  finish: () => void;
}

const storageKey = (id: string, scope?: string) => `tutorial:coach:${id}${scope ? `:${scope}` : ''}`;

export function useCoach(id: string, scope: string | undefined, enabled: boolean, delayMs = 1100): Coach {
  const nodes = useRef<Record<string, View | null>>({});
  const [visible, setVisible] = useState(false);
  const refCache = useRef<Record<string, (node: View | null) => void>>({});

  const ref = useCallback((key: string) => {
    if (!refCache.current[key]) {
      refCache.current[key] = (node: View | null) => {
        nodes.current[key] = node;
      };
    }
    return refCache.current[key];
  }, []);

  const measure = useCallback(
    (key: string) =>
      new Promise<{ x: number; y: number; w: number; h: number } | null>((resolve) => {
        const n = nodes.current[key];
        if (!n) return resolve(null);
        n.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
      }),
    [],
  );

  useEffect(() => {
    if (!enabled || __DEV__) return;
    let alive = true;
    const t = setTimeout(() => {
      AsyncStorage.getItem(storageKey(id, scope))
        .then((seen) => {
          if (alive && !seen) setVisible(true);
        })
        .catch(() => {});
    }, delayMs);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [id, scope, enabled, delayMs]);

  const finish = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey(id, scope), '1').catch(() => {});
  }, [id, scope]);

  const start = useCallback(() => setVisible(true), []);

  return { visible, ref, measure, start, finish };
}

/** Borra la memoria de todas las guías (Ajustes → «Ver los tutoriales otra vez»). */
export async function resetCoachTours(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('tutorial:coach:')));
  } catch {
    // sin almacenamiento: nada que borrar
  }
}

const PAD = 6;

export const CoachTour: React.FC<{ coach: Coach; steps: CoachStep[] }> = ({ coach, steps }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width: W, height: H } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const step = steps[i];

  useEffect(() => {
    if (coach.visible) setI(0);
  }, [coach.visible]);

  useEffect(() => {
    if (!coach.visible || !step) return;
    let alive = true;
    setBox(null);
    if (!step.target) return;
    // Pequeña espera: que la pantalla termine de pintarse antes de medir.
    const t = setTimeout(() => {
      coach.measure(step.target!).then((b) => {
        if (!alive) return;
        // Fuera de pantalla: se explica sin señalar.
        setBox(b && b.y >= 0 && b.y + b.h <= H + 4 && b.x + b.w <= W + 4 ? b : null);
      });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.visible, i, step?.target, H, W]);

  if (!coach.visible || !step) return null;
  const last = i === steps.length - 1;

  const hole = box
    ? {
        x: Math.max(box.x - PAD, 0),
        y: Math.max(box.y - PAD, 0),
        w: Math.min(box.w + PAD * 2, W),
        h: box.h + PAD * 2,
      }
    : null;
  // El globo va debajo del elemento si cabe; si no, encima. Si el elemento es muy alto, abajo del todo.
  const bubbleH = step.chips ? 280 : 210;
  const below = hole ? hole.y + hole.h + 12 + bubbleH <= H : false;
  const bubbleTop = hole
    ? below
      ? hole.y + hole.h + 12
      : Math.max(hole.y - 12 - bubbleH, 40)
    : undefined;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={coach.finish}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {hole ? (
          <>
            {/* Velo con hueco: cuatro rectángulos alrededor del elemento */}
            <View style={[s.dim, { left: 0, top: 0, width: W, height: hole.y }]} />
            <View style={[s.dim, { left: 0, top: hole.y + hole.h, width: W, height: H - hole.y - hole.h }]} />
            <View style={[s.dim, { left: 0, top: hole.y, width: hole.x, height: hole.h }]} />
            <View style={[s.dim, { left: hole.x + hole.w, top: hole.y, width: W - hole.x - hole.w, height: hole.h }]} />
            <View
              pointerEvents="none"
              style={[s.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]}
            />
          </>
        ) : (
          <View style={[s.dim, StyleSheet.absoluteFillObject]} />
        )}

        <View
          style={[
            s.bubble,
            hole ? { top: bubbleTop } : { top: H / 2 - bubbleH / 2 },
          ]}
        >
          {/* Flecha hacia el elemento (patrón de monday.com / Mesh en Mobbin) */}
          {hole ? (
            <View
              pointerEvents="none"
              style={[
                s.caret,
                below ? { top: -7 } : { bottom: -7 },
                { left: Math.min(Math.max(hole.x + hole.w / 2 - 16 - 8, 20), W - 32 - 36) },
              ]}
            />
          ) : null}
          <View style={s.head}>
            <Text style={s.counter}>
              {i + 1}/{steps.length}
            </Text>
            {!last ? (
              <Pressable onPress={coach.finish} hitSlop={10} accessibilityLabel="Saltar la guía" style={s.skipPill}>
                <Text style={s.skip}>SALTAR</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.text}>{step.text}</Text>
          {step.chips ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {step.chips.map((ch, n) => (
                <View key={ch} style={s.chip}>
                  <View style={s.chipNum}>
                    <Text style={s.chipNumText}>{n + 1}</Text>
                  </View>
                  <Text style={s.chipText}>{ch}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={s.row}>
            <View style={s.dots}>
              {steps.map((_, n) => (
                <View key={n} style={[s.dot, n === i && { backgroundColor: c.accent, width: 18 }]} />
              ))}
            </View>
            <Pressable
              onPress={() => (last ? coach.finish() : setI(i + 1))}
              accessibilityRole="button"
              style={({ pressed }) => [s.next, pressed && { opacity: 0.85 }]}
            >
              <Text style={s.nextText}>{last ? 'Entendido' : 'Siguiente'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    dim: { position: 'absolute', backgroundColor: 'rgba(4,10,8,0.72)' },
    ring: {
      position: 'absolute',
      borderRadius: 14,
      borderWidth: 2,
      borderColor: c.accent,
    },
    bubble: {
      position: 'absolute',
      left: 16,
      right: 16,
      padding: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 6,
    },
    dots: { flexDirection: 'row', gap: 5 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    counter: { color: c.textFaint, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
    skipPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: c.accent10 },
    caret: {
      position: 'absolute',
      width: 14,
      height: 14,
      backgroundColor: c.bgCard,
      borderColor: c.hair,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      transform: [{ rotate: '45deg' }],
    },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, backgroundColor: c.accent10 },
    chipNum: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
    chipNumText: { color: '#04110B', fontSize: 11.5, fontWeight: '800' },
    chipText: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: '600' },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.hair },
    title: { color: c.text, fontSize: 17, fontWeight: '800' },
    text: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    skip: { color: c.accent, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
    next: { paddingHorizontal: 18, height: 40, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
    nextText: { color: '#04110B', fontSize: 14.5, fontWeight: '800' },
  });
