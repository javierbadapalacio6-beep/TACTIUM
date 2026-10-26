import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
// El velo es un recuadro enorme con un borde gigante: lo de dentro (el hueco) queda transparente y se anima
// de un elemento al siguiente, con las esquinas redondeadas.
const BIG = 2400;
const MOVE = { duration: 340, easing: Easing.out(Easing.cubic) };

export const CoachTour: React.FC<{ coach: Coach; steps: CoachStep[] }> = ({ coach, steps }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width: W, height: H } = useWindowDimensions();
  const [i, setI] = useState(0);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [measured, setMeasured] = useState(false);
  const step = steps[i];

  // Posición animada del hueco, del globo y de la flecha.
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const ringO = useSharedValue(0);
  const bTop = useSharedValue(0);
  const caretX = useSharedValue(0);
  const caretUp = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (coach.visible) {
      setI(0);
      placed.current = false;
    }
  }, [coach.visible]);

  useEffect(() => {
    if (!coach.visible || !step) return;
    let alive = true;
    setMeasured(false);
    if (!step.target) {
      setBox(null);
      setMeasured(true);
      return;
    }
    // Pequeña espera: que la pantalla termine de pintarse antes de medir.
    const t = setTimeout(() => {
      coach.measure(step.target!).then((b) => {
        if (!alive) return;
        // Fuera de pantalla: se explica sin señalar.
        setBox(b && b.y >= 0 && b.y + b.h <= H + 4 && b.x + b.w <= W + 4 ? b : null);
        setMeasured(true);
      });
    }, placed.current ? 0 : 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.visible, i, step?.target, H, W]);

  // Cuando se sabe dónde está el elemento, se mueve todo hasta allí (la primera vez, sin animar).
  useEffect(() => {
    if (!coach.visible || !step || !measured) return;
    const hole = box
      ? {
          x: Math.max(box.x - PAD, 0),
          y: Math.max(box.y - PAD, 0),
          w: Math.min(box.w + PAD * 2, W),
          h: box.h + PAD * 2,
        }
      : null;
    const bubbleH = step.chips ? 280 : 210;
    const below = hole ? hole.y + hole.h + 12 + bubbleH <= H : false;
    const top = hole
      ? below
        ? hole.y + hole.h + 12
        : Math.max(hole.y - 12 - bubbleH, 40)
      : H / 2 - bubbleH / 2;
    const target = hole ?? { x: W / 2, y: H / 2, w: 0, h: 0 };
    const caret = hole ? Math.min(Math.max(hole.x + hole.w / 2 - 16 - 8, 20), W - 32 - 36) : 20;
    const go = (sv: { value: number }, v: number) => {
      sv.value = placed.current ? withTiming(v, MOVE) : v;
    };
    go(hx, target.x);
    go(hy, target.y);
    go(hw, target.w);
    go(hh, target.h);
    go(ringO, hole ? 1 : 0);
    go(bTop, top);
    go(caretX, caret);
    go(caretUp, hole ? (below ? 1 : -1) : 0);
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.visible, measured, box, i, W, H]);

  const dimStyle = useAnimatedStyle(() => ({
    left: hx.value - BIG,
    top: hy.value - BIG,
    width: hw.value + BIG * 2,
    height: hh.value + BIG * 2,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    left: hx.value,
    top: hy.value,
    width: hw.value,
    height: hh.value,
    opacity: ringO.value,
  }));
  const bubbleStyle = useAnimatedStyle(() => ({ top: bTop.value }));
  const caretUpStyle = useAnimatedStyle(() => ({ left: caretX.value, opacity: caretUp.value > 0 ? 1 : 0 }));
  const caretDownStyle = useAnimatedStyle(() => ({ left: caretX.value, opacity: caretUp.value < 0 ? 1 : 0 }));

  if (!coach.visible || !step) return null;
  const last = i === steps.length - 1;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={coach.finish}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View pointerEvents="none" style={[s.dim, dimStyle]} />
        <Animated.View pointerEvents="none" style={[s.ring, ringStyle]} />
        {/* Toques fuera del globo: no pasan a la pantalla de debajo */}
        <View style={StyleSheet.absoluteFill} />

        <Animated.View style={[s.bubble, bubbleStyle]}>
          {/* Flecha hacia el elemento (patrón de monday.com / Mesh en Mobbin) */}
          <Animated.View pointerEvents="none" style={[s.caret, { top: -7 }, caretUpStyle]} />
          <Animated.View
            pointerEvents="none"
            style={[s.caret, s.caretDown, { bottom: -7 }, caretDownStyle]}
          />
          <Animated.View key={i} entering={FadeIn.duration(260)} style={{ gap: 6 }}>
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
                  <Animated.View key={ch} entering={FadeInDown.delay(120 + n * 90).duration(260)} style={s.chip}>
                    <View style={s.chipNum}>
                      <Text style={s.chipNumText}>{n + 1}</Text>
                    </View>
                    <Text style={s.chipText}>{ch}</Text>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </Animated.View>
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
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    dim: {
      position: 'absolute',
      borderWidth: BIG,
      borderRadius: BIG + 14,
      borderColor: 'rgba(4,10,8,0.72)',
    },
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
    caretDown: { transform: [{ rotate: '225deg' }] },
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
