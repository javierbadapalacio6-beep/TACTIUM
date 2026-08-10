import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconLink } from '@components/ui';
import { getMyFcpLink, setMyFcpLink } from '@core/services/fcpLink';
import { resolveFcpPlayer } from '@core/services/fcpSearch';
import {
  fetchFcpPlayerYears,
  fetchFcpPlayerYearMatches,
  type FcpPlayerYearTeam,
  type FcpPlayerYearMatches,
} from '@core/services/fcpProfiles';

interface Props {
  userId: string;
  userName: string | null; // para buscar la ficha por nombre al vincular
}

/** Ficha de la Federación del usuario en su pantalla de Stats: si vincula su
 *  ficha FCP (por nombre), ve sus números federativos de la temporada. */
export const FederacionStatsCard: React.FC<Props> = ({ userId, userName }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [link, setLink] = useState<string | null | undefined>(undefined); // undefined = cargando
  const [year, setYear] = useState<FcpPlayerYearTeam | null>(null);
  const [stats, setStats] = useState<FcpPlayerYearMatches | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyFcpLink(userId)
      .then((id) => alive && setLink(id))
      .catch(() => alive && setLink(null));
    return () => {
      alive = false;
    };
  }, [userId]);

  // Al tener vínculo, cargamos su temporada más reciente + stats.
  useEffect(() => {
    if (!link) {
      setYear(null);
      setStats(null);
      return;
    }
    let alive = true;
    setLoadingStats(true);
    fetchFcpPlayerYears(link)
      .then(async (years) => {
        if (!alive) return;
        const y = years[0] ?? null;
        setYear(y);
        if (y) {
          const s = await fetchFcpPlayerYearMatches(link, y.idLiga);
          if (alive) setStats(s);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoadingStats(false));
    return () => {
      alive = false;
    };
  }, [link]);

  const doLink = async () => {
    const name = (userName ?? '').trim();
    if (name.length < 3) {
      Alert.alert('Necesito tu nombre', 'Completa tu nombre para buscar tu ficha en la Federación.');
      return;
    }
    setLinking(true);
    try {
      const cands = await resolveFcpPlayer(name);
      if (cands.length === 0) {
        Alert.alert(
          'No te encontramos',
          'No hay ninguna ficha en la Federación Cántabra que coincida con tu nombre. Solo aparece si juegas liga federada.',
        );
        return;
      }
      Alert.alert('¿Cuál es tu ficha?', 'Elige tu jugador en la Federación:', [
        ...cands.slice(0, 4).map((m) => ({
          text: `${m.name}${m.equipo ? ` · ${m.equipo}` : ''}`,
          onPress: async () => {
            try {
              await setMyFcpLink(userId, m.idJugador);
              setLink(m.idJugador);
            } catch {
              Alert.alert('No se pudo vincular', 'Inténtalo de nuevo.');
            }
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    } catch {
      Alert.alert('Error', 'No se pudo buscar en la Federación ahora mismo.');
    } finally {
      setLinking(false);
    }
  };

  const unlink = () => {
    Alert.alert('Desvincular ficha', '¿Quitar el vínculo con tu ficha de la Federación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: async () => {
          try {
            await setMyFcpLink(userId, null);
            setLink(null);
          } catch {
            Alert.alert('No se pudo', 'Inténtalo de nuevo.');
          }
        },
      },
    ]);
  };

  if (link === undefined) return null; // cargando el vínculo: no parpadeamos

  // Sin vincular → invitación discreta.
  if (!link) {
    return (
      <Pressable
        onPress={linking ? undefined : doLink}
        style={({ pressed }) => [styles.linkPrompt, pressed && { opacity: 0.85 }]}
      >
        <IconLink size={16} color={c.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.linkTitle}>Vincula tu ficha de la Federación</Text>
          <Text style={styles.linkSub}>Verás aquí tus puntos, nivel y partidos federados.</Text>
        </View>
        {linking ? <ActivityIndicator color={c.accent} /> : null}
      </Pressable>
    );
  }

  const wr = stats && stats.pj > 0 ? Math.round((stats.pg / stats.pj) * 100) : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.eyebrow}>MI FICHA EN LA FEDERACIÓN</Text>
        <Pressable onPress={unlink} hitSlop={8}>
          <Text style={styles.unlink}>Desvincular</Text>
        </Pressable>
      </View>

      {loadingStats && !year ? (
        <ActivityIndicator color={c.accent} style={{ marginVertical: 10 }} />
      ) : !year ? (
        <Text style={styles.sub}>Ficha vinculada, pero aún no hay datos federativos.</Text>
      ) : (
        <>
          <View style={styles.teamRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.team} numberOfLines={1}>{year.equipo ?? '—'}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[year.categoria, `Temporada ${year.anio}`].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pts}>{year.puntos}</Text>
              <Text style={styles.ptsLabel}>PUNTOS</Text>
            </View>
          </View>

          <View style={styles.grid}>
            <Cell c={c} label="PJ" value={String(stats?.pj ?? 0)} />
            <Cell c={c} label="PG" value={String(stats?.pg ?? 0)} color={c.accent} />
            <Cell c={c} label="PP" value={String(stats?.pp ?? 0)} color={c.error} />
            <Cell c={c} label="% VIC" value={wr != null ? `${wr}%` : '—'} color={c.warning} />
          </View>
        </>
      )}
    </View>
  );
};

const Cell: React.FC<{ c: Palette; label: string; value: string; color?: string }> = ({
  c,
  label,
  value,
  color,
}) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={{ fontFamily: Fonts.mono, fontSize: 16, fontWeight: '800', color: color ?? c.text }}>
      {value}
    </Text>
    <Text
      style={{ fontFamily: Fonts.mono, fontSize: 8.5, letterSpacing: 1, color: c.textFaint, marginTop: 4 }}
    >
      {label}
    </Text>
  </View>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    linkPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: Radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    linkTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    linkSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    card: {
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: Radius.lg,
      padding: 16,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.accent, fontWeight: '700' },
    unlink: { color: c.textFaint, fontSize: 11.5, fontWeight: '600' },
    sub: { color: c.textMuted, fontSize: 13, marginTop: 10 },
    teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    team: { color: c.text, fontSize: 16, fontWeight: '800' },
    meta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 3 },
    pts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 20, fontWeight: '800' },
    ptsLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 8, letterSpacing: 1, marginTop: 1 },
    grid: {
      flexDirection: 'row',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
  });
