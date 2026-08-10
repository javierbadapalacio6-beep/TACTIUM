import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron } from '@components/ui';
import { fetchFcpTeamProfile, type FcpTeamProfile } from '@core/services/fcpProfiles';
import type { SeasonsStackScreenProps } from '@navigation/types';

export const FcpTeamScreen = ({ navigation, route }: SeasonsStackScreenProps<'FcpTeam'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { idEquipo, name } = route.params;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FcpTeamProfile | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFcpTeamProfile(idEquipo)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idEquipo]);

  const sd = data ? data.setsFavor - data.setsContra : 0;
  const winRate = data && data.pj > 0 ? Math.round((data.pg / data.pj) * 100) : null;
  const ptsPerMatch = data && data.pj > 0 ? (data.puntos / data.pj).toFixed(1) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.navBtnLabel}>Clasificación</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : !data ? (
        <Text style={styles.empty}>No se pudo cargar el equipo.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {data.equipo || name || 'Equipo'}
              </Text>
              {data.posicion != null ? (
                <View style={styles.posPill}>
                  <Text style={styles.posPillNum}>{data.posicion}º</Text>
                </View>
              ) : null}
            </View>
            {data.grupo ? <Text style={styles.subtitle}>{data.grupo}</Text> : null}
          </View>

          {/* Stats */}
          <View style={[styles.statStrip, { marginBottom: 10 }]}>
            <StatCell c={c} label="PUNTOS" value={String(data.puntos)} highlight />
            <View style={styles.statDivider} />
            <StatCell c={c} label="PJ" value={String(data.pj)} />
            <StatCell c={c} label="PG" value={String(data.pg)} color={c.accent} />
            <StatCell c={c} label="PP" value={String(data.pp)} color={c.error} />
            <View style={styles.statDivider} />
            <StatCell c={c} label="% VIC" value={winRate != null ? `${winRate}%` : '—'} color={c.warning} />
          </View>
          <View style={styles.statStrip}>
            <StatCell c={c} label="SETS +" value={String(data.setsFavor)} color={c.accent} />
            <StatCell c={c} label="SETS −" value={String(data.setsContra)} color={c.error} />
            <StatCell
              c={c}
              label="DIF"
              value={sd >= 0 ? `+${sd}` : String(sd)}
              color={sd > 0 ? c.accent : sd < 0 ? c.error : undefined}
            />
            <StatCell c={c} label="PTS/PART" value={ptsPerMatch ?? '—'} />
          </View>

          {/* Plantilla */}
          <Text style={styles.sectionEyebrow}>PLANTILLA · {data.roster.length}</Text>
          <Text style={styles.sectionHint}>Toca un jugador para ver sus estadísticas</Text>
          <View style={{ gap: 6 }}>
            {data.roster.map((p, i) => (
              <Pressable
                key={p.idJugador}
                onPress={() =>
                  navigation.navigate('FcpPlayer', { idJugador: p.idJugador, name: p.name })
                }
                style={({ pressed }) => [styles.playerRow, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                  {p.categoria ? <Text style={styles.playerCat}>{p.categoria}</Text> : null}
                </View>
                <Text style={styles.playerPts}>{p.puntos} pts</Text>
                <IconChevron size={14} color={c.textFaint} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const StatCell: React.FC<{
  c: Palette;
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}> = ({ c, label, value, highlight, color }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text
      style={{
        fontFamily: Fonts.mono,
        fontSize: 18,
        fontWeight: '800',
        color: color ?? (highlight ? c.accent : c.text),
      }}
    >
      {value}
    </Text>
    <Text
      style={{
        fontFamily: Fonts.mono,
        fontSize: 9,
        letterSpacing: 1.2,
        color: c.textFaint,
        marginTop: 3,
        fontWeight: '500',
      }}
    >
      {label}
    </Text>
  </View>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
    header: { marginTop: 8, marginBottom: 20, gap: 6 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    posPill: {
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    posPillNum: { fontFamily: Fonts.mono, color: c.accent, fontSize: 15, fontWeight: '800' },
    title: { flex: 1, minWidth: 0, color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
    subtitle: { color: c.textMuted, fontSize: 13.5 },
    statStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.lg,
      paddingVertical: 16,
      marginBottom: 26,
    },
    statDivider: { width: 1, height: 30, backgroundColor: c.hair },
    sectionEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.5,
      color: c.accent,
      fontWeight: '500',
    },
    sectionHint: { color: c.textFaint, fontSize: 11.5, marginTop: 4, marginBottom: 12 },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rank: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 13,
      fontWeight: '800',
      width: 18,
      textAlign: 'center',
    },
    playerName: { color: c.text, fontSize: 15, fontWeight: '700' },
    playerCat: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10.5, marginTop: 2, letterSpacing: 0.5 },
    playerPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13.5, fontWeight: '800' },
  });
