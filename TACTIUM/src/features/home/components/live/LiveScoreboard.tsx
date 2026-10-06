import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconShare, NeonDot } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import { useLiveMatchday, useNow } from '@core/hooks/useLiveMatchday';
import {
  activeScorer,
  courtOutcome,
  createShareToken,
  isLiveNow,
  liveErrorMessage,
  liveShareText,
  liveTotals,
  type LiveCourt,
} from '@core/services/live';

/**
 * «EN DIRECTO» del equipo (Jornada › Resultado).
 *
 * Una fila por pista, al estilo de las listas de partidos en directo de
 * Sofascore (estado a la izquierda, dos líneas nosotros/rival, juegos por set
 * a la derecha con el set en curso resaltado) y arriba el total del encuentro
 * en pistas ganadas, como el marcador grande de Fixtured. Se mueve solo por
 * Realtime (`useLiveMatchday`).
 *
 * Tocar una pista abre el marcador (`onScoreCourt`, que el padre pasa por el
 * gate Pro `results_edit`). Si otro compañero la está marcando, se dice
 * («La marca Iván S.») y se puede tomar el relevo desde el marcador.
 */
export interface LiveScoreboardProps {
  matchdayId: string;
  /** Pistas que exige la liga (P1–P5 en la Cántabra masculina). */
  courts: number;
  teamName: string;
  opponent: string;
  jornadaNumber: number | null;
  /** El partido ya ha empezado (o es el día): se puede empezar a marcar. */
  matchStarted: boolean;
  /** Acta cerrada. */
  closed: boolean;
  onScoreCourt: (court: number) => void;
}

export const LiveScoreboard: React.FC<LiveScoreboardProps> = ({
  matchdayId,
  courts,
  teamName,
  opponent,
  jornadaNumber,
  matchStarted,
  closed,
  onScoreCourt,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const { state } = useLiveMatchday(matchdayId);
  const now = useNow();
  const [sharing, setSharing] = useState(false);

  const hasAnyLive = !!state?.courts.some((ct) => ct.live);
  // Antes del partido y sin directo, no se pinta nada (la Previa manda).
  if (!state || (!matchStarted && !hasAnyLive)) return null;

  const live = isLiveNow(state);
  const totals = liveTotals(state);
  const finished = closed || (hasAnyLive && !live);
  const canScore = state.can_score && !closed;

  const byCourt = new Map<number, LiveCourt>(state.courts.map((ct) => [ct.court_number, ct]));
  const rows = Array.from(
    { length: Math.max(courts, ...state.courts.map((ct) => ct.court_number)) },
    (_, i) => i + 1,
  );

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const token = state.share_token ?? (await createShareToken(matchdayId));
      await Share.share({
        message: liveShareText({ teamName, opponent, jornada: jornadaNumber, token }),
      });
    } catch (e) {
      toast.error('No se ha podido compartir', liveErrorMessage(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.pill, live ? styles.pillLive : styles.pillDone]}>
          {live ? <NeonDot size={6} color={c.error} /> : null}
          <Text style={[styles.pillTxt, { color: live ? c.error : c.textMuted }]}>
            {live ? 'EN DIRECTO' : finished ? 'TERMINADO' : 'MARCADOR'}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {state.is_admin && !closed ? (
          <Pressable
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel="Compartir el directo"
            hitSlop={8}
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <IconShare size={14} color={c.accent} />
            )}
            <Text style={styles.shareTxt}>Compartir directo</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.total}>
        <Text style={styles.totalNum}>
          {totals.won}
          <Text style={styles.totalDash}> – </Text>
          {totals.lost}
        </Text>
        <Text style={styles.totalSub}>
          {totals.live > 0
            ? `Pistas ganadas · ${totals.live} en juego`
            : 'Pistas ganadas'}
        </Text>
      </View>

      {rows.map((n) => (
        <CourtRow
          key={n}
          n={n}
          court={byCourt.get(n)}
          opponent={opponent}
          scorer={activeScorer(byCourt.get(n)?.live ?? null, myUserId, now)}
          canScore={canScore}
          onPress={() => onScoreCourt(n)}
          styles={styles}
          c={c}
        />
      ))}

      {canScore ? (
        <Text style={styles.foot}>
          Cualquiera del equipo puede llevar una pista. Toca la que estés viendo.
        </Text>
      ) : null}
    </View>
  );
};

const CourtRow: React.FC<{
  n: number;
  court: LiveCourt | undefined;
  opponent: string;
  scorer: string | null;
  canScore: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}> = ({ n, court, opponent, scorer, canScore, onPress, styles, c }) => {
  const outcome = courtOutcome(court);
  const live = court?.live ?? null;
  const pair =
    [court?.player_a?.name, court?.player_b?.name].filter(Boolean).join(' / ') || 'Sin pareja';
  const sets = court?.forfeit ? [] : live?.sets ?? [];
  const lastIdx = live && live.status === 'live' ? sets.length - 1 : -1;
  const statusTxt = court?.forfeit
    ? 'W.O.'
    : outcome === 'live'
    ? 'En juego'
    : outcome === 'won' || outcome === 'lost'
    ? 'Final'
    : '—';
  const statusColor =
    outcome === 'live' ? c.error : outcome === 'won' ? c.accent : outcome === 'lost' ? c.textMuted : c.textFaint;
  const disabled = !canScore || !!court?.forfeit;
  const action = disabled
    ? null
    : scorer
    ? `La marca ${scorer}`
    : live?.status === 'finished'
    ? 'Corregir'
    : live
    ? 'Marcar esta pista'
    : 'Empezar a marcar';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Pista ${n}. ${pair}. ${statusTxt}`}
      style={({ pressed }) => [styles.row, pressed && !disabled && { opacity: 0.85 }]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.courtNum}>P{n}</Text>
        <Text style={[styles.rowStatus, { color: statusColor }]} numberOfLines={1}>
          {statusTxt}
        </Text>
      </View>
      <View style={styles.rowMid}>
        <Text
          style={[styles.rowName, outcome === 'won' && { color: c.accent }]}
          numberOfLines={1}
        >
          {pair}
        </Text>
        <Text style={[styles.rowName, styles.rowRival]} numberOfLines={1}>
          {opponent}
        </Text>
        {action ? (
          <Text style={[styles.rowAction, scorer && { color: c.warning }]} numberOfLines={1}>
            {action} ›
          </Text>
        ) : null}
      </View>
      <View style={styles.rowSets}>
        {sets.map((s, i) => {
          const cur = i === lastIdx;
          return (
            <View key={i} style={[styles.setCol, cur && styles.setColCur]}>
              <Text style={[styles.setNum, cur && styles.setNumCur, !cur && s.us > s.them && styles.setWin]}>
                {s.us}
              </Text>
              <Text style={[styles.setNum, cur && styles.setNumCur, !cur && s.them > s.us && styles.setWin]}>
                {s.them}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 16,
      marginBottom: 16,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    pillLive: { backgroundColor: withAlpha(c.error, 0.12) },
    pillDone: { backgroundColor: withAlpha(c.text, 0.06) },
    pillTxt: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(c.accent, 0.4),
      minHeight: 32,
    },
    shareTxt: { color: c.accent, fontSize: 12.5, fontWeight: '600' },
    total: { alignItems: 'center', marginTop: 12, marginBottom: 8 },
    totalNum: { fontFamily: Fonts.mono, fontSize: 40, fontWeight: '700', color: c.text },
    totalDash: { color: c.textFaint },
    totalSub: { fontSize: 12.5, color: c.textMuted, marginTop: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairStrong,
      gap: 12,
      minHeight: 64,
    },
    rowLeft: { width: 58 },
    courtNum: { fontFamily: Fonts.mono, fontSize: 15, fontWeight: '700', color: c.text },
    rowStatus: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
    rowMid: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 14, fontWeight: '600', color: c.text },
    rowRival: { color: c.textMuted, fontWeight: '500', marginTop: 3 },
    rowAction: { fontSize: 12, fontWeight: '600', color: c.accent, marginTop: 5 },
    rowSets: { flexDirection: 'row', gap: 4 },
    setCol: {
      width: 26,
      alignItems: 'center',
      paddingVertical: 2,
      borderRadius: 6,
    },
    setColCur: { backgroundColor: withAlpha(c.error, 0.12) },
    setNum: { fontFamily: Fonts.mono, fontSize: 15, color: c.textMuted, lineHeight: 21 },
    setNumCur: { color: c.error, fontWeight: '700' },
    setWin: { color: c.text, fontWeight: '700' },
    foot: { fontSize: 12, color: c.textFaint, marginTop: 10 },
  });
