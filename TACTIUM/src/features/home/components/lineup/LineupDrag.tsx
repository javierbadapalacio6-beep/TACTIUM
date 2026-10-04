import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors } from '@core/theme';
import { Radius } from '@core/theme/spacing';

import type { SlotIdx } from './lineupLogic';

/**
 * TABLET · arrastrar del banquillo a una pista (además de tocar y colocar).
 *
 * Aislado a propósito: si el arrastre da guerra, basta con no montar
 * `LineupDragLayer` (o pasar `enabled={false}`) y la alineación sigue
 * funcionando solo con toques, como en el móvil.
 *
 *  · `LineupDragLayer` envuelve la pantalla: guarda las zonas (pistas) y
 *    pinta el «fantasma» que sigue al dedo, por encima de los ScrollView
 *    (si no, el chip se recortaría al salir de la columna del banquillo).
 *  · `CourtDropZone` envuelve cada pista. La mitad izquierda es el hueco 1
 *    y la derecha el hueco 2.
 *  · `DraggableBenchItem` envuelve cada jugador del banquillo. El arrastre
 *    empieza con una pulsación corta (180 ms) para no pelear con el scroll
 *    ni con el toque normal.
 */

interface Rect {
  court: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Lo estable (no cambia durante el arrastre: el gesto no se rehace). */
interface DragApi {
  enabled: boolean;
  registerZone: (court: number, view: View | null) => void;
  start: (id: string, ghost: React.ReactNode) => void;
  x: SharedValue<number>;
  y: SharedValue<number>;
  rects: SharedValue<Rect[]>;
  setHover: (court: number | null) => void;
  finish: (absX: number, absY: number) => void;
}

const Ctx = createContext<DragApi | null>(null);
/** Lo que cambia mientras se arrastra (solo lo leen las pistas). */
const StateCtx = createContext<{ hoverCourt: number | null; draggingId: string | null }>({
  hoverCourt: null,
  draggingId: null,
});

export const LineupDragLayer: React.FC<{
  enabled: boolean;
  onDrop: (playerId: string, court: number, slot: SlotIdx) => void;
  children: React.ReactNode;
}> = ({ enabled, onDrop, children }) => {
  const zones = useRef(new Map<number, View>());
  const rootRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const rects = useSharedValue<Rect[]>([]);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const [hoverCourt, setHoverCourt] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: string; ghost: React.ReactNode } | null>(null);
  const rectsJs = useRef<Rect[]>([]);
  const dragIdRef = useRef<string | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const registerZone = useCallback((court: number, view: View | null) => {
    if (view) zones.current.set(court, view);
    else zones.current.delete(court);
  }, []);

  const start = useCallback(
    (id: string, ghost: React.ReactNode) => {
      dragIdRef.current = id;
      setDrag({ id, ghost });
      // Medimos al empezar: durante el arrastre no hay scroll.
      rootRef.current?.measureInWindow((rx, ry) => {
        origin.current = { x: rx, y: ry };
        ox.value = rx;
        oy.value = ry;
      });
      const acc: Rect[] = [];
      const entries = Array.from(zones.current.entries());
      let pending = entries.length;
      entries.forEach(([court, view]) => {
        view.measureInWindow((zx, zy, w, h) => {
          acc.push({ court, x: zx, y: zy, w, h });
          pending -= 1;
          if (pending === 0) {
            rectsJs.current = acc;
            rects.value = acc;
          }
        });
      });
    },
    [rects, ox, oy],
  );

  const finish = useCallback(
    (absX: number, absY: number) => {
      const id = dragIdRef.current;
      dragIdRef.current = null;
      setDrag(null);
      setHoverCourt(null);
      if (!id) return;
      const hit = rectsJs.current.find(
        (r) => absX >= r.x && absX <= r.x + r.w && absY >= r.y && absY <= r.y + r.h,
      );
      if (!hit) return;
      const slot: SlotIdx = absX < hit.x + hit.w / 2 ? 0 : 1;
      onDropRef.current(id, hit.court, slot);
    },
    [],
  );

  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - ox.value - 70 }, { translateY: y.value - oy.value - 22 }],
  }));

  const api = useMemo<DragApi>(
    () => ({
      enabled,
      registerZone,
      start,
      x,
      y,
      rects,
      setHover: setHoverCourt,
      finish,
    }),
    [enabled, registerZone, start, x, y, rects, finish],
  );
  const state = useMemo(
    () => ({ hoverCourt, draggingId: drag?.id ?? null }),
    [hoverCourt, drag],
  );

  return (
    <Ctx.Provider value={api}>
      <StateCtx.Provider value={state}>
      <View ref={rootRef} style={styles.fill} collapsable={false}>
        {children}
        {drag ? (
          <Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
            {drag.ghost}
          </Animated.View>
        ) : null}
      </View>
      </StateCtx.Provider>
    </Ctx.Provider>
  );
};

/** Pista sobre la que se puede soltar. Se ilumina cuando el dedo está encima. */
export const CourtDropZone: React.FC<{ court: number; children: React.ReactNode }> = ({
  court,
  children,
}) => {
  const api = useContext(Ctx);
  const st = useContext(StateCtx);
  const c = useColors();
  const ref = useCallback(
    (v: View | null) => {
      api?.registerZone(court, v);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [court, api?.registerZone],
  );
  if (!api || !api.enabled) return <>{children}</>;
  const hovered = st.draggingId != null && st.hoverCourt === court;
  return (
    <View ref={ref} collapsable={false}>
      {children}
      {hovered ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: Radius.lg,
              borderWidth: 2,
              borderColor: c.accent,
              backgroundColor: c.accent10,
            },
          ]}
        />
      ) : null}
    </View>
  );
};

/** Jugador del banquillo que se puede arrastrar. `ghost` es lo que sigue al dedo. */
export const DraggableBenchItem: React.FC<{
  id: string;
  ghost: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, ghost, children }) => {
  const api = useContext(Ctx);
  const reduced = useReducedMotion();
  const lift = useSharedValue(1);
  const lastHover = useSharedValue(-1);
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;

  const enabled = !!api?.enabled;
  const gesture = useMemo(() => {
    if (!api) return Gesture.Pan().enabled(false);
    const { x, y, rects, setHover, finish, start } = api;
    // El nodo `ghost` no puede viajar al hilo de UI: se pasa por una
    // función JS que el worklet llama con runOnJS.
    const begin = () => start(id, ghostRef.current);
    return Gesture.Pan()
      .enabled(enabled)
      .activateAfterLongPress(180)
      .onStart((e) => {
        x.value = e.absoluteX;
        y.value = e.absoluteY;
        lastHover.value = -1;
        lift.value = reduced ? 0.4 : withTiming(0.4, { duration: 120 });
        runOnJS(begin)();
      })
      .onUpdate((e) => {
        x.value = e.absoluteX;
        y.value = e.absoluteY;
        let hit = -1;
        const rs = rects.value;
        for (let i = 0; i < rs.length; i++) {
          const r = rs[i];
          if (
            e.absoluteX >= r.x &&
            e.absoluteX <= r.x + r.w &&
            e.absoluteY >= r.y &&
            e.absoluteY <= r.y + r.h
          ) {
            hit = r.court;
            break;
          }
        }
        if (hit !== lastHover.value) {
          lastHover.value = hit;
          runOnJS(setHover)(hit === -1 ? null : hit);
        }
      })
      .onEnd((e) => {
        runOnJS(finish)(e.absoluteX, e.absoluteY);
      })
      .onFinalize(() => {
        lift.value = reduced ? 1 : withTiming(1, { duration: 120 });
      });
  }, [api, enabled, id, lift, lastHover, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: lift.value }));

  if (!api || !enabled) return <>{children}</>;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 50,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});
