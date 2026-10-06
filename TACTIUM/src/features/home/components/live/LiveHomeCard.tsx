import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { NeonDot } from '@components/ui';
import { useLiveMatchday } from '@core/hooks/useLiveMatchday';
import { isLiveNow, liveTotals } from '@core/services/live';

/**
 * Inicio: la jornada que se está jugando AHORA, con el marcador global
 * (pistas ganadas – perdidas) moviéndose por Realtime. Solo se pinta con
 * alguna pista en directo; si no, no ocupa sitio.
 */
export const LiveHomeCard: React.FC<{
  matchdayId: string | null | undefined;
  teamName: string;
  opponent: string;
  jornadaNumber: number | null;
  onOpen: () => void;
}> = ({ matchdayId, teamName, opponent, jornadaNumber, onOpen }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { state } = useLiveMatchday(matchdayId, !!matchdayId);
  if (!matchdayId || !isLiveNow(state)) return null;
  const t = liveTotals(state);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`En directo: ${teamName} ${t.won}, ${opponent} ${t.lost}. Abrir la jornada`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.top}>
        <NeonDot size={6} color={c.error} />
        <Text style={styles.live}>EN DIRECTO</Text>
        <Text style={styles.meta}>
          {jornadaNumber != null ? `J${jornadaNumber} · ` : ''}
          {t.live} {t.live === 1 ? 'pista en juego' : 'pistas en juego'}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.team} numberOfLines={2}>
          {teamName}
        </Text>
        <Text style={styles.score}>
          {t.won}–{t.lost}
        </Text>
        <Text style={[styles.team, styles.rival]} numberOfLines={2}>
          {opponent}
        </Text>
      </View>
      <Text style={styles.cta}>Ver pista a pista ›</Text>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(c.error, 0.35),
      padding: 16,
      marginBottom: 16,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    live: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 1, color: c.error },
    meta: { fontSize: 12, color: c.textMuted, marginLeft: 4 },
    row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
    team: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
    rival: { textAlign: 'right', color: c.textMuted, fontWeight: '600' },
    score: { fontFamily: Fonts.mono, fontSize: 34, fontWeight: '700', color: c.text },
    cta: { fontSize: 12.5, fontWeight: '600', color: c.accent, marginTop: 10 },
  });
