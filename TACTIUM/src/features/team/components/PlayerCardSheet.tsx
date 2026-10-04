import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconX, Toggle } from '@components/ui';
import { SidePanel } from '@components/layout';
import type { Player } from '@store/teamStore';
import { displayName, initialsOf, photoOf } from '@core/utils/playerName';
import {
  computePlayerLeagueStats,
  type LeagueStatsBundle,
} from '@core/services/playerStats';
import { sharedGames } from '@features/team/teamData';
import { CountUp } from './TeamMotion';

/**
 * Ficha de un jugador en una hoja. Sustituye al menú del sistema que salía al
 * tocar una fila. Los números son `computePlayerLeagueStats` (el mismo
 * cálculo de «Mis estadísticas») sobre todas las temporadas del equipo.
 *
 *  · Capitán: disponible, editar, ver perfil y quitar (abajo, en rojo).
 *  · Jugador: solo lectura, y «Vosotros dos» si mira a un compañero.
 *
 * Contenedor: en móvil, hoja inferior; en tablet, `SidePanel` de 420. Con
 * `inline` (tablet horizontal) se pinta como columna fija a la derecha de
 * la tabla, sin velo: se cambia de jugador sin cerrarla.
 */
export const PlayerCardSheet: React.FC<{
  player: Player | null;
  teamName: string;
  canManage: boolean;
  isCaptainRow: boolean;
  /** Ficha del que mira (jugador), para «Vosotros dos». */
  myPlayerId: string | null;
  bundle: LeagueStatsBundle | null;
  bundleLoading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleAvailable: (v: boolean) => void;
  onRemove: () => void;
  onOpenProfile: (userId: string) => void;
  /** Tablet horizontal: columna fija (sin modal). */
  inline?: boolean;
}> = ({
  player,
  teamName,
  canManage,
  isCaptainRow,
  myPlayerId,
  bundle,
  bundleLoading,
  onClose,
  onEdit,
  onToggleAvailable,
  onRemove,
  onOpenProfile,
  inline = false,
}) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  // La hoja conserva al último jugador mientras se cierra (si no, el
  // contenido se vacía durante la animación de salida).
  const [shown, setShown] = useState<Player | null>(player);
  useEffect(() => {
    if (player) setShown(player);
  }, [player]);
  const p = player ?? shown;

  const stats = useMemo(
    () => (p && bundle ? computePlayerLeagueStats(p.id, bundle) : null),
    [p, bundle],
  );
  const topCourt = useMemo(() => {
    if (!stats?.byCourt.length) return null;
    return [...stats.byCourt].sort((a, b) => b.played - a.played)[0];
  }, [stats]);
  const together = useMemo(
    () =>
      p && bundle && myPlayerId && myPlayerId !== p.id
        ? sharedGames(bundle, myPlayerId, p.id)
        : [],
    [p, bundle, myPlayerId],
  );
  const togetherWon = together.filter((g) => g.won === true).length;

  if (!p) return null;
  const photo = photoOf(p);
  const isMe = myPlayerId === p.id;
  const meta = [
    p.position,
    isCaptainRow ? 'capitán' : null,
    p.user_id
      ? p.profile_username
        ? `en TACTIUM como @${p.profile_username}`
        : 'en TACTIUM'
      : 'sin cuenta',
  ]
    .filter(Boolean)
    .join(' · ');

  const content = (
    <>
      <Text style={s.eyebrow}>{teamName.toUpperCase()}</Text>
      <View style={s.head}>
        <View style={s.avatar}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.avatarImg} />
          ) : (
            <Text style={s.avatarText}>{initialsOf(p)}</Text>
          )}
          {p.user_id ? <View style={s.onlineDot} /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={2}>
            {displayName(p)}
            {isMe ? ' (tú)' : ''}
          </Text>
          <Text style={s.meta}>{meta}</Text>
        </View>
        <View style={s.ptsBox}>
          <Text style={s.ptsValue}>{p.pts}</Text>
          <Text style={s.ptsLabel}>pts</Text>
        </View>
      </View>

      <Text style={s.section}>Liga · todas las temporadas</Text>
      {bundleLoading && !bundle ? (
        <View style={s.loader}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : stats && stats.played > 0 ? (
        <>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <CountUp value={stats.played} style={s.statValue} />
              <Text style={s.statLabel}>partidos</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.stat}>
              <CountUp value={stats.won} style={[s.statValue, { color: c.accent }]} />
              <Text style={s.statLabel}>ganados</Text>
            </View>
            <View style={s.statSep} />
            <View style={s.stat}>
              <CountUp value={stats.winRate ?? 0} suffix="%" style={s.statValue} />
              <Text style={s.statLabel}>victorias</Text>
            </View>
          </View>
          <View style={s.list}>
            <View style={[s.line, s.lineDivider]}>
              <Text style={s.lineLabel}>Mejor pareja</Text>
              <Text style={s.lineValue} numberOfLines={1}>
                {stats.bestPartner
                  ? `con ${stats.bestPartner.name} · ${stats.bestPartner.won} de ${stats.bestPartner.played}`
                  : 'Aún sin pareja fija'}
              </Text>
            </View>
            <View style={s.line}>
              <Text style={s.lineLabel}>Pista más jugada</Text>
              <Text style={s.lineValue}>
                {topCourt
                  ? `Pista ${topCourt.court} · ${topCourt.played} ${topCourt.played === 1 ? 'vez' : 'veces'}`
                  : '—'}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={s.emptyStats}>
          Todavía no ha jugado partidos de liga con acta cerrada.
        </Text>
      )}

      {together.length > 0 ? (
        <>
          <Text style={s.section}>Vosotros dos</Text>
          <View style={s.list}>
            <View style={[s.line, s.lineDivider]}>
              <Text style={s.lineValue}>
                {together.length} {together.length === 1 ? 'partido juntos' : 'partidos juntos'} ·{' '}
                {togetherWon} {togetherWon === 1 ? 'ganado' : 'ganados'}
              </Text>
            </View>
            {together.slice(-4).map((g, i, arr) => (
              <View
                key={`${g.matchdayId}-${g.court}`}
                style={[s.line, i < arr.length - 1 && s.lineDivider]}
              >
                <Text style={s.lineLabel} numberOfLines={1}>
                  J{g.jornada} vs {g.opponent} · Pista {g.court}
                </Text>
                <Text
                  style={[
                    s.score,
                    { color: g.won === true ? c.accent : g.won === false ? c.error : c.textMuted },
                  ]}
                >
                  {g.sets || '—'}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {canManage ? (
        <View style={[s.list, { marginTop: 16 }]}>
          <View style={s.line}>
            <Text style={s.lineValue}>
              {p.available ? 'Disponible' : 'De baja'}
            </Text>
            <Toggle value={p.available} onChange={onToggleAvailable} />
          </View>
        </View>
      ) : null}

      <View style={s.actions}>
        {canManage ? (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            style={({ pressed }) => [s.btn, s.btnGhost, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.btnGhostText}>Editar</Text>
          </Pressable>
        ) : null}
        {p.user_id ? (
          <Pressable
            onPress={() => onOpenProfile(p.user_id as string)}
            accessibilityRole="button"
            style={({ pressed }) => [s.btn, s.btnAccent, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.btnAccentText}>Ver perfil</Text>
          </Pressable>
        ) : null}
      </View>

      {canManage ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [s.remove, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.removeText}>Quitar de la plantilla</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (inline) {
    if (!player) return null;
    return (
      <View style={s.inline}>
        <View style={s.inlineHead}>
          <Text style={s.inlineTitle}>FICHA</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cerrar la ficha"
          >
            <IconX size={14} color={c.textMuted} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={s.inlineScroll}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <SidePanel open={player != null} onClose={onClose} title="Ficha">
      {content}
    </SidePanel>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    inline: {
      width: 420,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: c.hairStrong,
      backgroundColor: c.bgRaised,
    },
    inlineHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 6,
    },
    inlineTitle: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.8,
      color: c.textFaint,
    },
    inlineScroll: { paddingHorizontal: 20, paddingBottom: 32 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: 56, height: 56, borderRadius: 28 },
    avatarText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 18, fontWeight: '700' },
    onlineDot: {
      position: 'absolute',
      right: 1,
      bottom: 1,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: c.accent,
      borderWidth: 2,
      borderColor: c.bgRaised,
    },
    name: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
    meta: { color: c.textMuted, fontSize: 12.5, marginTop: 3 },
    ptsBox: { alignItems: 'flex-end' },
    ptsValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 20, fontWeight: '700' },
    ptsLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10, letterSpacing: 1 },
    section: {
      color: c.textFaint,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 8,
    },
    loader: { paddingVertical: 18, alignItems: 'center' },
    statsRow: {
      flexDirection: 'row',
      paddingVertical: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    stat: { flex: 1, alignItems: 'center' },
    statSep: { width: 1, backgroundColor: c.hair },
    statValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 22, fontWeight: '700' },
    statLabel: { color: c.textFaint, fontSize: 11.5, marginTop: 4 },
    list: {
      marginTop: 8,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    lineDivider: { borderBottomWidth: 1, borderColor: c.hair },
    lineLabel: { flexShrink: 1, color: c.textMuted, fontSize: 13 },
    lineValue: { flexShrink: 1, color: c.text, fontSize: 13.5, fontWeight: '600' },
    score: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
    emptyStats: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
    btn: {
      flex: 1,
      height: 48,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnGhost: { borderWidth: 1, borderColor: c.hairStrong, backgroundColor: c.bgCard },
    btnGhostText: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    btnAccent: { backgroundColor: c.accent },
    btnAccentText: { color: c.textInverse, fontSize: 14.5, fontWeight: '700' },
    remove: { alignSelf: 'center', marginTop: 20, paddingVertical: 6 },
    removeText: { color: c.error, fontSize: 14, fontWeight: '700' },
  });
