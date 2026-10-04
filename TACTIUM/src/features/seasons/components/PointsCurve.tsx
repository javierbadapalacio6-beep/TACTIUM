// Curva de puntos de la federación de un jugador en una temporada: la suma de
// `puntosVar` partido a partido. Cada partido es un punto (verde si ganó, rojo
// si perdió); tocar la gráfica muestra ese partido. Debajo, inicio, máximo y
// el mejor y el peor partido. Se dibuja en 1,1 s al cambiar de temporada; con
// «reducir movimiento», aparece sin más.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@core/theme';
import { Fonts } from '@core/theme/fonts';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Un partido de la curva: lo que sumó o restó y contra quién. */
export interface CurvePoint {
  delta: number;
  won: boolean;
  /** «J3 · Noja Pádel» (o «Playoff · …»). */
  label: string;
  /** «3 oct». */
  date: string;
}

const fmt = (n: number) => n.toLocaleString('es-ES');
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

export const PointsCurve: React.FC<{
  /** Puntos antes del primer partido y tras cada uno (points.length + 1). */
  values: number[];
  /** Detalle de cada partido, alineado con values[1..]. */
  points?: CurvePoint[];
  /** Etiquetas de los extremos (mes del primer y del último partido). */
  startLabel?: string;
  endLabel?: string;
  height?: number;
}> = ({ values, points, startLabel, endLabel, height = 96 }) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const padX = 6;
  const padY = 10;

  const min = Math.min(...values);
  const max = Math.max(...values);

  const geo = useMemo(() => {
    if (w <= 0 || values.length < 2) return null;
    const span = max - min || 1;
    const pts = values.map((v, i) => [
      padX + (i / (values.length - 1)) * (w - padX * 2),
      padY + (1 - (v - min) / span) * (height - padY * 2),
    ] as [number, number]);
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
    return { pts, d, area, len: L, baseY: pts[0][1] };
  }, [values, w, height, min, max]);

  // La selección se reinicia al cambiar de temporada.
  useEffect(() => setSel(null), [values]);

  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [geo?.d, reduced, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: (geo?.len ?? 0) * (1 - progress.value),
  }));

  // Resumen: inicio, máximo, mejor y peor partido.
  const summary = useMemo(() => {
    const deltas = (points ?? []).map((p) => p.delta);
    return {
      start: values[0],
      max,
      best: deltas.length ? Math.max(...deltas) : null,
      worst: deltas.length ? Math.min(...deltas) : null,
    };
  }, [points, values, max]);

  const selected = sel != null && points ? points[sel - 1] : null;

  const onPress = (x: number) => {
    if (!geo || !points?.length) return;
    // Punto más cercano (sin contar el inicial, que no es un partido).
    let best = 1;
    for (let i = 1; i < geo.pts.length; i++) {
      if (Math.abs(geo.pts[i][0] - x) < Math.abs(geo.pts[best][0] - x)) best = i;
    }
    setSel((s) => (s === best ? null : best));
  };

  const mono = { fontFamily: Fonts.mono, fontSize: 9.5, color: c.textFaint, letterSpacing: 1 } as const;

  return (
    <View>
      {/* Partido seleccionado (o pista de que se puede tocar) */}
      <View style={{ minHeight: 30, marginBottom: 6, justifyContent: 'center' }}>
        {selected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 13,
                fontWeight: '800',
                color: selected.won ? c.accent : c.error,
              }}
            >
              {signed(selected.delta)}
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: c.text, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>
                {selected.won ? 'Victoria' : 'Derrota'} · {selected.label}
              </Text>
              <Text style={mono}>
                {selected.date.toUpperCase()} · QUEDÓ EN {fmt(values[sel!])}
              </Text>
            </View>
          </View>
        ) : points?.length ? (
          <Text style={mono}>TOCA UN PARTIDO PARA VER EL DETALLE</Text>
        ) : null}
      </View>

      <Pressable
        onPress={(e) => onPress(e.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityLabel={`Evolución de puntos: de ${fmt(values[0])} a ${fmt(values[values.length - 1])}`}
      >
        <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {geo ? (
            <Svg width={w} height={height}>
              {/* Línea de referencia: los puntos con los que empezó */}
              <Line
                x1={padX}
                x2={w - padX}
                y1={geo.baseY}
                y2={geo.baseY}
                stroke={c.textFaint}
                strokeOpacity={0.35}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
              <Path d={geo.area} fill={c.accent} fillOpacity={0.07} />
              <AnimatedPath
                d={geo.d}
                stroke={c.accent}
                strokeWidth={2.2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${geo.len} ${geo.len}`}
                animatedProps={animatedProps}
              />
              {sel != null ? (
                <Line
                  x1={geo.pts[sel][0]}
                  x2={geo.pts[sel][0]}
                  y1={0}
                  y2={height}
                  stroke={c.textFaint}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
              ) : null}
              {geo.pts.slice(1).map(([x, y], i) => {
                const p = points?.[i];
                const on = sel === i + 1;
                return (
                  <Circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={on ? 5 : 3}
                    fill={p ? (p.won ? c.accent : c.error) : c.accent}
                    stroke={on ? c.text : 'none'}
                    strokeWidth={on ? 1.5 : 0}
                  />
                );
              })}
            </Svg>
          ) : null}
          {/* Máximo y mínimo de la temporada, a la derecha */}
          {geo && max !== min ? (
            <>
              <Text style={[mono, { position: 'absolute', right: 0, top: -2 }]}>{fmt(max)}</Text>
              <Text style={[mono, { position: 'absolute', right: 0, bottom: -2 }]}>{fmt(min)}</Text>
            </>
          ) : null}
        </View>
      </Pressable>

      {startLabel || endLabel ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={mono}>{startLabel ?? ''}</Text>
          <Text style={mono}>{endLabel ?? ''}</Text>
        </View>
      ) : null}

      {/* Resumen de la temporada */}
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        {[
          { k: 'INICIO', v: fmt(summary.start), color: c.text },
          { k: 'MÁXIMO', v: fmt(summary.max), color: c.text },
          summary.best != null
            ? { k: 'MEJOR', v: signed(summary.best), color: summary.best >= 0 ? c.accent : c.error }
            : null,
          summary.worst != null
            ? { k: 'PEOR', v: signed(summary.worst), color: summary.worst < 0 ? c.error : c.textMuted }
            : null,
        ]
          .filter(Boolean)
          .map((s) => (
            <View key={s!.k} style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 13.5, fontWeight: '800', color: s!.color }}>
                {s!.v}
              </Text>
              <Text style={[mono, { marginTop: 2 }]}>{s!.k}</Text>
            </View>
          ))}
      </View>
    </View>
  );
};
