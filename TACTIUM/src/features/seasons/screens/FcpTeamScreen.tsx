import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconChevron, IconStar, IconStarFilled } from '@components/ui';
import { StatCell, FormChips, ListHeader } from '../components/fcpUi';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';
import { fetchFcpTeamProfile, type FcpTeamProfile } from '@core/services/fcpProfiles';
import type { SeasonsStackScreenProps } from '@navigation/types';

const fmtN = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Iniciales de un nombre ("Central Padel A" → "CP", "Nuria Hernández" → "NH").
const initials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

type Sort = 'puntos' | 'nombre';

export const FcpTeamScreen = ({ navigation, route }: SeasonsStackScreenProps<'FcpTeam'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { idEquipo, name } = route.params;
  const isFav = useFavoritesStore((s) =>
    s.items.some((f) => f.kind === 'team' && f.refId === String(idEquipo)),
  );

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FcpTeamProfile | null>(null);
  const [sort, setSort] = useState<Sort>('puntos');

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

  const roster = useMemo(() => {
    if (!data) return [];
    const r = [...data.roster];
    if (sort === 'nombre') r.sort((a, b) => a.name.localeCompare(b.name));
    else r.sort((a, b) => b.puntos - a.puntos);
    return r;
  }, [data, sort]);

  return (
    <View style={styles.root}>
      <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={16} color={c.textMuted} />
          <Text style={styles.navBtnLabel}>Clasificación</Text>
        </Pressable>

        <Pressable
          onPress={() => toggleFavorite({ kind: 'team', refId: String(idEquipo), label: name ?? 'Equipo' })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          style={({ pressed }) => [styles.favBtn, isFav && styles.favBtnOn, pressed && { opacity: 0.7 }]}
        >
          {isFav ? <IconStarFilled size={16} color={c.accent} /> : <IconStar size={16} color={c.textFaint} />}
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
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroTile}>
              <Text style={styles.heroTileText}>{initials(data.equipo || name || '?')}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={styles.heroName} numberOfLines={2}>{data.equipo || name || 'Equipo'}</Text>
              {data.grupo ? <Text style={styles.heroMeta} numberOfLines={1}>{data.grupo.toUpperCase()}</Text> : null}
            </View>
            {data.posicion != null ? (
              <View style={styles.posBadge}>
                <Text style={styles.posBadgeNum}>{data.posicion}º</Text>
                <Text style={styles.posBadgeLabel}>GRUPO</Text>
              </View>
            ) : null}
          </View>

          {/* Bloque de estadística */}
          <View style={styles.statBlock}>
            <View style={styles.ptsCol}>
              <Text style={styles.ptsBig}>{data.puntos}</Text>
              <Text style={styles.ptsLabel}>PUNTOS</Text>
            </View>
            <View style={styles.statGrid}>
              {([
                { k: 'PJ', v: String(data.pj) },
                { k: 'PG', v: String(data.pg), color: c.accent },
                { k: 'PP', v: String(data.pp), color: c.error },
                { k: 'SETS', v: `${data.setsFavor}·${data.setsContra}` },
                { k: 'DIF', v: sd >= 0 ? `+${sd}` : String(sd), color: sd > 0 ? c.accent : sd < 0 ? c.error : undefined },
                { k: '% VIC', v: winRate != null ? String(winRate) : '—' },
              ] as { k: string; v: string; color?: string }[]).map((s) => (
                <View key={s.k} style={styles.gridCell}>
                  <StatCell label={s.k} value={s.v} color={s.color} align="flex-start" />
                </View>
              ))}
            </View>
          </View>

          {/* Racha de temporada · scroll horizontal (una temporada puede tener
              10-14 partidos y no caben en una línea) */}
          {data.form.length > 0 ? (
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>TEMPORADA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center' }}
              >
                <FormChips form={data.form} box={16} />
              </ScrollView>
            </View>
          ) : null}

          {/* Plantilla */}
          <View style={{ marginTop: 26 }}>
            <ListHeader
              title={`PLANTILLA · ${data.roster.length}`}
              action={sort === 'puntos' ? 'POR PUNTOS ▾' : 'POR NOMBRE ▾'}
              onAction={() => setSort((s) => (s === 'puntos' ? 'nombre' : 'puntos'))}
            />
          </View>
          <View style={{ gap: 6, marginTop: 10 }}>
            {roster.map((p, i) => (
              <Pressable
                key={p.idJugador}
                onPress={() => navigation.navigate('FcpPlayer', { idJugador: p.idJugador, name: p.name })}
                style={({ pressed }) => [styles.playerRow, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(p.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                  {p.categoria ? <Text style={styles.playerMeta} numberOfLines={1}>{p.categoria.toUpperCase()}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={styles.playerPts}>{fmtN(p.puntos)}</Text>
                  <Text style={styles.playerPtsLabel}>PTS FCP</Text>
                </View>
                <IconChevron size={14} color={c.textFaint} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    favBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favBtnOn: { borderColor: c.accent40, backgroundColor: c.accent10 },
    empty: { color: c.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },

    // Hero
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
    heroTile: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTileText: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '700', color: c.accent },
    heroName: { color: c.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 27 },
    heroMeta: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.4, color: c.textFaint },
    posBadge: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posBadgeNum: { fontFamily: Fonts.mono, fontSize: 18, fontWeight: '700', color: c.accent, lineHeight: 20 },
    posBadgeLabel: { fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 1.2, color: c.accent, marginTop: 2 },

    // Bloque de estadística
    statBlock: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 12,
      marginTop: 18,
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    ptsCol: { justifyContent: 'center', paddingRight: 14, borderRightWidth: 1, borderRightColor: c.hair, gap: 4 },
    ptsBig: { fontFamily: Fonts.mono, fontSize: 38, fontWeight: '800', color: c.accent, lineHeight: 38 },
    ptsLabel: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.8, color: c.textFaint },
    statGrid: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'center',
    },
    gridCell: { width: '33.33%', paddingVertical: 6 },

    // Racha temporada
    formCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    formLabel: { fontFamily: Fonts.mono, fontSize: 9.5, letterSpacing: 1.6, color: c.textFaint },

    // Plantilla
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    rank: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 12, fontWeight: '700', width: 16, textAlign: 'center' },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 12, fontWeight: '700' },
    playerName: { color: c.text, fontSize: 14, fontWeight: '600' },
    playerMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 1, marginTop: 2 },
    playerPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 14, fontWeight: '700' },
    playerPtsLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 8.5, letterSpacing: 1 },
  });
