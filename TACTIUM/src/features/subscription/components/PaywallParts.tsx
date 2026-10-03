import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconBall,
  IconBell,
  IconCalendar,
  IconCamera,
  IconChevron,
  IconClock,
  IconFile,
  IconTeam,
  IconTrophy,
} from '@components/ui';
import type { PlanDescriptor, BillingPeriod } from '@core/subscriptions/plans';
import type {
  PaywallReasonCopy,
  PaywallReasonIcon,
} from '@core/subscriptions/paywallReasons';

// Piezas del paywall. Todas las animaciones son de una sola pasada (sin
// bucles) y se apagan con «Reducir movimiento» del sistema.

// ── Bloque de contexto ──────────────────────────────────────────────────────

const REASON_ICON: Record<
  PaywallReasonIcon,
  React.ComponentType<{ size?: number; color?: string }>
> = {
  trophy: IconTrophy,
  team: IconTeam,
  camera: IconCamera,
  bell: IconBell,
  file: IconFile,
  ball: IconBall,
  calendar: IconCalendar,
  clock: IconClock,
};

/** Línea ámbar arriba del paywall: por qué estás aquí. */
export const PaywallReasonBanner = ({ reason }: { reason: PaywallReasonCopy }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const Icon = REASON_ICON[reason.icon];
  return (
    <View
      style={s.ctx}
      accessible
      accessibilityLabel={
        reason.subtitle ? `${reason.title}. ${reason.subtitle}` : reason.title
      }
    >
      <View style={s.ctxIcon}>
        <Icon size={16} color={c.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.ctxTitle}>{reason.title}</Text>
        {reason.subtitle ? (
          <Text style={s.ctxSub}>{reason.subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
};

// ── Selector Mensual / Anual con indicador que se desliza ──────────────────

export const BillingToggle = ({
  value,
  onChange,
  showYearlyChip,
}: {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
  /** «2 meses gratis» junto a Anual (solo si el anual sale más barato). */
  showYearlyChip: boolean;
}) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const pos = useSharedValue(value === 'yearly' ? 1 : 0);

  useEffect(() => {
    const target = value === 'yearly' ? 1 : 0;
    pos.value = reduced
      ? target
      : withSpring(target, { damping: 20, stiffness: 220, mass: 0.8 });
  }, [value, reduced, pos]);

  // Padding del contenedor: 4 por lado.
  const half = Math.max(0, (w - 8) / 2);
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * half }],
  }));

  return (
    <View
      style={s.toggle}
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {w > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[s.toggleIndicator, { width: half }, indicator]}
        />
      ) : null}
      {(['monthly', 'yearly'] as const).map((opt) => {
        const sel = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            style={s.toggleChip}
          >
            <Text style={[s.toggleText, sel && s.toggleTextOn]}>
              {opt === 'monthly' ? 'Mensual' : 'Anual'}
            </Text>
            {opt === 'yearly' && showYearlyChip ? (
              <Text style={s.toggleChipText}>2 meses gratis</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

// ── Tarjeta de plan: spring de escala al elegirla y borde animado ──────────

export const AnimatedPlanCard = ({
  selected,
  onPress,
  style,
  selectedStyle,
  accessibilityLabel,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  selectedStyle: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) => {
  const c = useColors();
  const reduced = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    const target = selected ? 1 : 0;
    if (reduced) {
      progress.value = target;
    } else {
      progress.value = withTiming(target, { duration: 220 });
      // Solo al ELEGIRLA (no al montar): un pequeño rebote.
      if (selected && mounted.current) {
        scale.value = withSequence(
          withTiming(0.975, { duration: 80 }),
          withSpring(1, { damping: 11, stiffness: 260 }),
        );
      }
    }
    mounted.current = true;
  }, [selected, reduced, progress, scale]);

  const from = c.hairStrong;
  const to = c.accent;
  const animated = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [from, to]),
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, selected && selectedStyle, animated]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ── «Comparar todo lo que incluye»: desplegable con animación de altura ────

export const ComparePlans = ({ plans }: { plans: PlanDescriptor[] }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [contentH, setContentH] = useState(0);
  const h = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    const target = open ? contentH : 0;
    h.value = reduced
      ? target
      : withTiming(target, { duration: 280, easing: Easing.out(Easing.cubic) });
    rot.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 220 });
  }, [open, contentH, reduced, h, rot]);

  const bodyStyle = useAnimatedStyle(() => ({ height: h.value }));
  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value * 90}deg` }],
  }));

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={s.compareToggle}
      >
        <Text style={s.compareToggleText}>Comparar todo lo que incluye</Text>
        <Animated.View style={chevStyle}>
          <IconChevron size={14} color={c.accent} />
        </Animated.View>
      </Pressable>
      <Animated.View style={[{ overflow: 'hidden' }, bodyStyle]}>
        {/* Se mide fuera del flujo para saber a qué altura abrir. */}
        <View
          style={s.compareMeasure}
          onLayout={(e) => setContentH(e.nativeEvent.layout.height)}
        >
          <View style={s.compareTable}>
            <View style={s.compareRow}>
              <Text style={[s.compareCell, s.compareHead, s.compareLabel]} />
              {plans.map((p) => (
                <Text key={p.tier} style={[s.compareCell, s.compareHead]}>
                  {p.shortLabel}
                </Text>
              ))}
            </View>
            <View style={s.compareRow}>
              <Text style={[s.compareCell, s.compareLabel]}>Equipos</Text>
              {plans.map((p) => (
                <Text key={p.tier} style={[s.compareCell, s.compareNum]}>
                  {p.teamQuota}
                </Text>
              ))}
            </View>
            <View style={[s.compareRow, { borderBottomWidth: 0 }]}>
              <Text style={[s.compareCell, s.compareLabel]}>Torneos (parejas)</Text>
              {plans.map((p) => (
                <Text key={p.tier} style={[s.compareCell, s.compareNum]}>
                  {p.tournamentPairCap ?? '—'}
                </Text>
              ))}
            </View>
          </View>
          {plans.map((p) => (
            <View key={p.tier} style={s.compareGroup}>
              <Text style={s.compareGroupTitle}>{p.displayName}</Text>
              {p.features.map((f) => (
                <Text key={f} style={s.compareFeat}>
                  ·  {f}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

// ── Bloque de la prueba SIN tarjeta (BD) ────────────────────────────────────

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «25 sep». */
export const fmtShortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

type Tone = 'past' | 'now' | 'next';
interface Milestone {
  key: string;
  label: string;
  desc?: string;
  tone: Tone;
  at: number;
}

/** Cuenta hacia arriba (0 → value) al aparecer. */
const CountUp = ({ value, style }: { value: number; style: StyleProp<any> }) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const v = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    v.value = reduced
      ? value
      : withDelay(
          180,
          withTiming(value, { duration: 650, easing: Easing.out(Easing.cubic) }),
        );
  }, [value, reduced, v]);
  useAnimatedReaction(
    () => Math.round(v.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setShown)(cur);
    },
  );
  return <Text style={style}>{shown}</Text>;
};

const TimelineRow = ({
  m,
  index,
  count,
  progress,
  s,
}: {
  m: Milestone;
  index: number;
  count: number;
  progress: SharedValue<number>;
  s: ReturnType<typeof makeStyles>;
}) => {
  // Cada hito aparece cuando la línea llega a él.
  const at = count <= 1 ? 0 : index / (count - 1);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [at - 0.12, at], [0, 1], 'clamp'),
  }));
  return (
    <Animated.View style={[s.tlRow, style]}>
      <View
        style={[
          s.tlDot,
          m.tone === 'now' && s.tlDotNow,
          m.tone === 'next' && s.tlDotNext,
        ]}
      />
      <Text style={s.tlWhen}>{m.label}</Text>
      {m.desc ? <Text style={s.tlDesc}>{m.desc}</Text> : null}
    </Animated.View>
  );
};

/**
 * Cabecera del paywall para quien está EN la prueba de BD: días que quedan,
 * la promesa honesta (sin tarjeta, sin cobro solo) y la línea de tiempo.
 * Las fechas salen de la suscripción; no hay cifras inventadas.
 */
export const DbTrialBlock = ({
  startIso,
  endIso,
  trialDays,
}: {
  startIso: string | null;
  endIso: string;
  trialDays: number;
}) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();

  const end = new Date(endIso);
  const start = startIso ? new Date(startIso) : new Date(end.getTime() - trialDays * DAY_MS);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  // Aviso 3 días antes: día 11 de 14.
  const reminder = new Date(start.getTime() + (trialDays - 4) * DAY_MS);

  const milestones = useMemo<Milestone[]>(() => {
    const base: Milestone[] = [
      {
        key: 'start',
        label: `Día 1 · ${fmtShortDate(start)}`,
        desc: 'Empezaste tu prueba. Pro completo.',
        tone: 'past',
        at: start.getTime(),
      },
      {
        key: 'reminder',
        label: `Día ${trialDays - 3} · ${fmtShortDate(reminder)}`,
        desc: 'Te avisamos con 3 días de margen',
        tone: now.getTime() >= reminder.getTime() ? 'past' : 'next',
        at: reminder.getTime(),
      },
      {
        key: 'end',
        label: `Día ${trialDays} · ${fmtShortDate(end)}`,
        desc: 'Pasas al plan gratis si no eliges',
        tone: 'next',
        at: end.getTime(),
      },
    ];
    // «Hoy» se coloca en su sitio. Si coincide con un hito, lo marca.
    const hit = base.find((m) => sameDay(new Date(m.at), now));
    if (hit) {
      hit.label = `Hoy · ${hit.label}`;
      hit.tone = 'now';
      return base;
    }
    return [
      ...base,
      {
        key: 'today',
        label: `Hoy · ${fmtShortDate(now)}`,
        tone: 'now' as const,
        at: now.getTime(),
      },
    ].sort((a, b) => a.at - b.at);
    // Las fechas solo cambian con la suscripción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startIso, endIso, trialDays]);

  // La línea se dibuja de arriba abajo.
  const [railH, setRailH] = useState(0);
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      260,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
    );
  }, [reduced, progress]);
  const railStyle = useAnimatedStyle(() => ({ height: progress.value * railH }));

  return (
    <View style={s.trialBlock}>
      <View style={s.daysRow}>
        <CountUp value={daysLeft} style={s.daysNum} />
        <Text style={s.daysLabel}>
          {daysLeft === 1 ? 'día de Pro gratis' : 'días de Pro gratis'}
        </Text>
      </View>
      <Text style={s.trialPromise}>
        Sin tarjeta. Cuando acabe no se cobra nada: eliges plan o sigues gratis.
      </Text>

      <View
        style={s.tl}
        onLayout={(e) => setRailH(Math.max(0, e.nativeEvent.layout.height - 22))}
      >
        <View style={s.tlTrack} />
        <Animated.View style={[s.tlRail, railStyle]} />
        {milestones.map((m, i) => (
          <TimelineRow
            key={m.key}
            m={m}
            index={i}
            count={milestones.length}
            progress={progress}
            s={s}
          />
        ))}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // Contexto
    ctx: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      backgroundColor: withAlpha(c.warning, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(c.warning, 0.4),
    },
    ctxIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: withAlpha(c.warning, 0.16),
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctxTitle: { color: c.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    ctxSub: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },

    // Selector
    toggle: {
      flexDirection: 'row',
      padding: 4,
      backgroundColor: c.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    toggleIndicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 10,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    toggleChip: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    toggleText: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    toggleTextOn: { color: c.text },
    toggleChipText: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    // Comparar
    compareToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    compareToggleText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    compareMeasure: { position: 'absolute', left: 0, right: 0, top: 0, paddingTop: 6 },
    compareTable: {
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      marginBottom: 12,
    },
    compareRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    compareCell: {
      flex: 1,
      paddingVertical: 9,
      paddingHorizontal: 8,
      color: c.text,
      fontSize: 13,
      textAlign: 'center',
    },
    compareLabel: { flex: 1.6, textAlign: 'left', color: c.textMuted },
    compareHead: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1,
      color: c.textFaint,
      textTransform: 'uppercase',
    },
    compareNum: { fontFamily: Fonts.mono, fontWeight: '700' },
    compareGroup: { marginBottom: 10 },
    compareGroupTitle: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 3 },
    compareFeat: { color: c.textMuted, fontSize: 13, lineHeight: 19 },

    // Prueba
    trialBlock: { gap: 10 },
    daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    daysNum: {
      fontFamily: Fonts.mono,
      color: c.text,
      fontSize: 52,
      fontWeight: '800',
      letterSpacing: -1.5,
      lineHeight: 56,
      minWidth: 34,
    },
    daysLabel: { color: c.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
    trialPromise: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    tl: { marginTop: 6, paddingLeft: 26 },
    tlTrack: {
      position: 'absolute',
      left: 8,
      top: 11,
      bottom: 11,
      width: 2,
      borderRadius: 1,
      backgroundColor: c.hairStrong,
    },
    tlRail: {
      position: 'absolute',
      left: 8,
      top: 11,
      width: 2,
      borderRadius: 1,
      backgroundColor: c.accent,
    },
    tlRow: { paddingTop: 3, paddingBottom: 12 },
    tlDot: {
      position: 'absolute',
      left: -23,
      top: 6,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.background,
      borderWidth: 2,
      borderColor: c.accent,
    },
    tlDotNow: { backgroundColor: c.accent },
    tlDotNext: { borderColor: c.textFaint },
    tlWhen: { color: c.text, fontSize: 14, fontWeight: '700' },
    tlDesc: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 1 },
  });
