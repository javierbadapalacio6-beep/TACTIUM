import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { initialsOf as initialsOfName } from '@core/utils/format';
import { initialsOf, photoOf, shortName } from '@core/utils/playerName';
import type { Player } from '@store/teamStore';
import type { AvailabilityStatus } from '@core/services/availability';

import { LineupAvatar } from './LineupCourt';
import { fmtPts } from './lineupLogic';

// ── Tira de la jornada (misma que la Jornada) ──────────────────────
export const LineupStrip: React.FC<{
  teamName: string;
  title: string;
  sub?: string | null;
  pill?: string | null;
}> = ({ teamName, title, sub, pill }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.strip}>
      <View style={styles.crest}>
        <Text style={styles.crestText}>{initialsOfName(teamName)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.stripTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.stripSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {pill ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{pill}</Text>
        </View>
      ) : null}
    </View>
  );
};

// ── Tarjeta «Tu pareja» ────────────────────────────────────────────
export const MyPairCard: React.FC<{
  court: number;
  me: Player | null;
  partner: Player | null;
  partnerName: string;
  pairPts: number | null;
  stats: { wins: number; played: number } | null;
}> = ({ court, me, partner, partnerName, pairPts, stats }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const roles =
    me && partner
      ? me.position === 'Drive' && partner.position === 'Revés'
        ? `Tú de drive y ${shortName(partner)} de revés`
        : me.position === 'Revés' && partner.position === 'Drive'
          ? `Tú de revés y ${shortName(partner)} de drive`
          : `Tú: ${me.position.toLowerCase()} · ${shortName(partner)}: ${partner.position.toLowerCase()}`
      : null;
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.myPair}>
      <Text style={styles.eyebrow}>TU PAREJA · PISTA {court}</Text>
      <View style={styles.duo}>
        <View style={{ flexDirection: 'row' }}>
          <LineupAvatar
            initials={me ? initialsOf(me) : 'TÚ'}
            photoUrl={me ? photoOf(me) : null}
            size={40}
            ring={c.accent}
          />
          <View style={{ marginLeft: -14 }}>
            <LineupAvatar
              initials={partner ? initialsOf(partner) : partnerName.slice(0, 2).toUpperCase()}
              photoUrl={partner ? photoOf(partner) : null}
              size={40}
              ring={c.background}
            />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.duoTitle} numberOfLines={1}>
            Con {partner?.name ?? partnerName}
          </Text>
          <Text style={styles.duoSub} numberOfLines={2}>
            {[roles, pairPts ? `${fmtPts(pairPts)} pts` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      {stats && stats.played > 0 ? (
        <Text style={styles.duoSub}>
          Habéis jugado {stats.played} {stats.played === 1 ? 'partido' : 'partidos'} juntos y
          ganado {stats.wins}
        </Text>
      ) : null}
    </Animated.View>
  );
};

// ── Sin alineación publicada (jugador) ─────────────────────────────
export const NoLineupYet: React.FC<{
  myStatus: AvailabilityStatus | null;
  canRespond: boolean;
  busy: boolean;
  onRespond: (s: AvailabilityStatus) => void;
}> = ({ myStatus, canRespond, busy, onRespond }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const opts: { s: AvailabilityStatus; label: string; color: string }[] = [
    { s: 'yes', label: 'Voy', color: c.accent },
    { s: 'maybe', label: 'Duda', color: c.warning },
    { s: 'no', label: 'No puedo', color: c.error },
  ];
  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ gap: 14 }}>
      <View style={styles.empty}>
        <View style={styles.emptyIc}>
          <Text style={{ fontSize: 18 }}>⏳</Text>
        </View>
        <Text style={styles.emptyTitle}>Aún no hay alineación</Text>
        <Text style={styles.emptyBody}>
          El capitán la publica cuando cierre la convocatoria. Te llegará un aviso.
        </Text>
      </View>
      {canRespond ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.eyebrowFaint}>TU RESPUESTA</Text>
          <View style={styles.rsvp}>
            {opts.map((o) => {
              const on = myStatus === o.s;
              return (
                <Pressable
                  key={o.s}
                  onPress={() => !busy && onRespond(o.s)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.rsvpBtn,
                    on && { backgroundColor: withAlpha(o.color, 0.16), borderColor: o.color },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.rsvpText, on && { color: o.color }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
};

// ── Aviso del club ─────────────────────────────────────────────────
export const InfoBanner: React.FC<{ children: React.ReactNode; tone?: 'muted' | 'warn' }> = ({
  children,
  tone = 'muted',
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View
      style={[
        styles.banner,
        tone === 'warn' && {
          backgroundColor: 'rgba(242,201,76,0.12)',
          borderColor: 'rgba(242,201,76,0.45)',
        },
      ]}
    >
      <Text style={styles.bannerText}>{children}</Text>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    crest: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crestText: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', color: c.accent },
    stripTitle: { color: c.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
    stripSub: { color: c.textFaint, fontSize: 12, marginTop: 1 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
    },
    pillText: { color: c.accent, fontSize: 11.5, fontWeight: '700' },
    myPair: {
      borderRadius: Radius.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: c.accent40,
      backgroundColor: c.accent10,
      gap: 10,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '500',
    },
    eyebrowFaint: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.textFaint,
      fontWeight: '500',
    },
    duo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    duoTitle: { color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
    duoSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
    empty: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.hairStrong,
      borderRadius: Radius.lg,
      paddingVertical: 22,
      paddingHorizontal: 16,
      alignItems: 'center',
      gap: 8,
    },
    emptyIc: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyBody: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
    rsvp: { flexDirection: 'row', gap: 8 },
    rsvpBtn: {
      flex: 1,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rsvpText: { color: c.textMuted, fontSize: 13.5, fontWeight: '700' },
    banner: {
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    bannerText: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  });
