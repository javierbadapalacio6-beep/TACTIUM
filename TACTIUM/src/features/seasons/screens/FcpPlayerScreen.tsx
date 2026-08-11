import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconStar, IconStarFilled } from '@components/ui';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';
import {
  fetchFcpPlayerProfile,
  fetchFcpPlayerYears,
  fetchFcpPlayerYearMatches,
  type FcpPlayerProfile,
  type FcpPlayerYearTeam,
  type FcpPlayerYearMatches,
} from '@core/services/fcpProfiles';
import type { SeasonsStackScreenProps } from '@navigation/types';

const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const FcpPlayerScreen = ({ navigation, route }: SeasonsStackScreenProps<'FcpPlayer'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { idJugador, name } = route.params;
  const isFav = useFavoritesStore((s) =>
    s.items.some((f) => f.kind === 'player' && f.refId === idJugador),
  );

  const [profile, setProfile] = useState<FcpPlayerProfile | null>(null);
  const [years, setYears] = useState<FcpPlayerYearTeam[]>([]);
  const [selLiga, setSelLiga] = useState<number | null>(null);
  const [yearData, setYearData] = useState<FcpPlayerYearMatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingYear, setLoadingYear] = useState(false);

  // Carga base: perfil (nombre) + años (con equipo/categoría/puntos).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchFcpPlayerProfile(idJugador), fetchFcpPlayerYears(idJugador)])
      .then(([p, ys]) => {
        if (!alive) return;
        setProfile(p);
        setYears(ys);
        setSelLiga(ys[0]?.idLiga ?? null); // por defecto el año más reciente
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idJugador]);

  // Al cambiar de año → partidos + stats de ese año.
  useEffect(() => {
    if (selLiga == null) return;
    let alive = true;
    setLoadingYear(true);
    fetchFcpPlayerYearMatches(idJugador, selLiga)
      .then((d) => alive && setYearData(d))
      .catch(() => alive && setYearData(null))
      .finally(() => alive && setLoadingYear(false));
    return () => {
      alive = false;
    };
  }, [idJugador, selLiga]);

  const selYear = years.find((y) => y.idLiga === selLiga) ?? null;
  const wr = yearData && yearData.pj > 0 ? Math.round((yearData.pg / yearData.pj) * 100) : null;
  const sd = yearData ? yearData.setsFor - yearData.setsAgainst : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.navBtnLabel}>Atrás</Text>
        </Pressable>

        {/* Favorito: funciona sin cuenta y sube al registrarse. */}
        <Pressable
          onPress={() =>
            toggleFavorite({
              kind: 'player',
              refId: idJugador,
              label: profile?.name ?? name ?? 'Jugador',
            })
          }
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          style={({ pressed }) => [{ marginLeft: 'auto' }, pressed && { opacity: 0.6 }]}
        >
          {isFav ? (
            <IconStarFilled size={19} color={c.accent} />
          ) : (
            <IconStar size={19} color={c.textFaint} />
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.name || name || '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.title}>{profile?.name || name || 'Jugador'}</Text>
          </View>

          {/* Selector de año */}
          {years.length > 0 ? (
            <>
              <Text style={styles.label}>TEMPORADA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
              >
                {years.map((y) => {
                  const on = y.idLiga === selLiga;
                  return (
                    <Pressable
                      key={y.idLiga}
                      onPress={() => setSelLiga(y.idLiga)}
                      style={[styles.yChip, on && styles.yChipOn]}
                    >
                      <Text style={[styles.yChipText, on && styles.yChipTextOn]}>{y.anio}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {/* Sub-info del año: equipo · categoría · puntos */}
          {selYear ? (
            <View style={styles.yearInfo}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.yearTeam} numberOfLines={1}>{selYear.equipo || '—'}</Text>
                {selYear.categoria ? <Text style={styles.yearCat}>{selYear.categoria}</Text> : null}
              </View>
              <Text style={styles.yearPts}>{fmtN(selYear.puntos)} pts</Text>
            </View>
          ) : null}

          {/* Stats del año */}
          <View style={styles.statStrip}>
            <StatCell c={c} label="PJ" value={String(yearData?.pj ?? 0)} />
            <StatCell c={c} label="PG" value={String(yearData?.pg ?? 0)} color={c.accent} />
            <StatCell c={c} label="PP" value={String(yearData?.pp ?? 0)} color={c.error} />
            <StatCell c={c} label="% VIC" value={wr != null ? `${wr}%` : '—'} color={c.warning} />
            <StatCell c={c} label="SETS" value={sd >= 0 ? `+${sd}` : String(sd)} />
          </View>

          {/* Partidos del año */}
          <Text style={styles.sectionEyebrow}>PARTIDOS · {yearData?.matches.length ?? 0}</Text>
          {loadingYear ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 20 }} />
          ) : !yearData || (yearData.matches.length === 0 && !yearData.hasData) ? (
            <Text style={styles.note}>
              Las actas de {selYear?.anio ?? 'esta temporada'} aún se están sincronizando con la
              Federación.
            </Text>
          ) : yearData.matches.length === 0 ? (
            <Text style={styles.note}>Sin partidos disputados esta temporada.</Text>
          ) : (
            <View style={{ gap: 6, marginTop: 10 }}>
              {yearData.matches.map((m, i) => (
                <View key={i} style={styles.matchRow}>
                  <View
                    style={[
                      styles.wl,
                      {
                        backgroundColor: (m.won ? c.accent : c.error) + '26',
                        borderColor: (m.won ? c.accent : c.error) + '4D',
                      },
                    ]}
                  >
                    <Text style={[styles.wlText, { color: m.won ? c.accent : c.error }]}>
                      {m.won ? 'V' : 'D'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.matchRival} numberOfLines={1}>vs {m.rivalPair}</Text>
                    <Text style={styles.matchPair} numberOfLines={1}>
                      {m.esPlayoff ? 'Playoff' : m.jornada != null ? `J${m.jornada}` : ''}
                      {m.esPlayoff || m.jornada != null ? ' · ' : ''}
                      con {m.partner ?? m.myPair}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.matchSets}>{m.sets}</Text>
                    {m.parciales ? <Text style={styles.matchParciales}>{m.parciales}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
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
    header: { marginTop: 8, marginBottom: 18, alignItems: 'center', gap: 8 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 999,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.accent, fontSize: 26, fontWeight: '800' },
    title: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.6,
      color: c.textFaint,
      fontWeight: '500',
      marginBottom: 10,
    },
    yChip: {
      minWidth: 62,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 16,
      paddingVertical: 9,
      alignItems: 'center',
    },
    yChipOn: { backgroundColor: c.accent, borderColor: c.accent },
    yChipText: { fontFamily: Fonts.mono, color: c.text, fontSize: 14, fontWeight: '800' },
    yChipTextOn: { color: c.textInverse },
    yearInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
    },
    yearTeam: { color: c.text, fontSize: 16, fontWeight: '800' },
    yearCat: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2, letterSpacing: 0.5 },
    yearPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 15, fontWeight: '800' },
    statStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.lg,
      paddingVertical: 16,
      marginTop: 16,
      marginBottom: 26,
    },
    sectionEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.5,
      color: c.accent,
      fontWeight: '500',
    },
    note: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
    matchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    wl: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wlText: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: '800' },
    matchRival: { color: c.text, fontSize: 14, fontWeight: '700' },
    matchPair: { color: c.textFaint, fontSize: 11.5, marginTop: 2 },
    matchSets: { fontFamily: Fonts.mono, color: c.text, fontSize: 14, fontWeight: '800' },
    matchParciales: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10.5, marginTop: 1 },
  });
