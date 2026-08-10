import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconChevron } from '@components/ui';
import { toast } from '@store/toastStore';
import {
  getFcpIdEquipo,
  fetchFcpGroupStandings,
  fetchFcpRivalRoster,
  type FcpStandingRow,
  type FcpRivalPlayer,
} from '@core/services/fcpSeason';

/**
 * Clasificación del grupo federativo (Federación Cántabra) de un equipo, con
 * ficha read-only de la plantilla de cada rival al tocar. Se auto-carga por
 * `teamId`. Si el equipo no está vinculado a la Federación o no hay datos, no
 * pinta nada (para poder montarlo sin condicionar desde fuera).
 */
// Colores de medalla para el podio (top 3).
const MEDAL: Record<number, string> = { 1: '#E7B93E', 2: '#AEB7C2', 3: '#CD7F45' };

export const FcpStandings: React.FC<{
  teamId: string;
  /** Si se pasa, tocar un rival navega a su pantalla en vez de desplegar la
   * plantilla en línea (para el contexto de pantalla, no de bottom-sheet). */
  onTeamPress?: (idEquipo: number, name: string) => void;
}> = ({ teamId, onTeamPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [rows, setRows] = useState<FcpStandingRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rosters, setRosters] = useState<Record<number, FcpRivalPlayer[]>>({});
  const [loadingRoster, setLoadingRoster] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setExpanded(null);
    setRosters({});
    (async () => {
      try {
        const id = await getFcpIdEquipo(teamId);
        if (id == null) {
          if (alive) {
            setRows([]);
            setGrupo(null);
          }
          return;
        }
        const { grupo: g, rows: r } = await fetchFcpGroupStandings(id);
        if (alive) {
          setGrupo(g);
          setRows(r);
        }
      } catch (e: any) {
        if (alive) toast.error('No se pudo cargar la clasificación', e?.message ?? '');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [teamId]);

  const toggleRival = async (idEquipo: number | null) => {
    if (idEquipo == null) return;
    if (expanded === idEquipo) {
      setExpanded(null);
      return;
    }
    setExpanded(idEquipo);
    if (!rosters[idEquipo]) {
      setLoadingRoster(idEquipo);
      try {
        const roster = await fetchFcpRivalRoster(idEquipo);
        setRosters((prev) => ({ ...prev, [idEquipo]: roster }));
      } catch {
        setRosters((prev) => ({ ...prev, [idEquipo]: [] }));
      } finally {
        setLoadingRoster(null);
      }
    }
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 28, alignItems: 'center' }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          La clasificación de este grupo aún no está disponible en la Federación.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {grupo ? <Text style={styles.groupName} numberOfLines={2}>{grupo}</Text> : null}
      <Text style={styles.hint}>Toca un rival para ver su plantilla</Text>
      <View style={{ gap: 6 }}>
        {rows.map((t) => {
          const sd = (t.sets_favor ?? 0) - (t.sets_contra ?? 0);
          const isOpen = expanded === t.id_equipo;
          const medal = t.posicion ? MEDAL[t.posicion] : undefined;
          const handle = () => {
            if (t.id_equipo == null) return;
            if (onTeamPress) onTeamPress(t.id_equipo, t.equipo);
            else if (!t.isMe) toggleRival(t.id_equipo);
          };
          return (
            <View key={`${t.id_equipo}-${t.equipo}`}>
              <Pressable
                onPress={handle}
                style={({ pressed }) => [
                  styles.row,
                  t.isMe && { borderColor: c.accent, backgroundColor: c.accent10 },
                  pressed && !t.isMe && { opacity: 0.85 },
                ]}
              >
                <View
                  style={[
                    styles.posBadge,
                    medal
                      ? { backgroundColor: medal + '22', borderColor: medal + '66' }
                      : t.isMe
                      ? { borderColor: c.accent }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.posText,
                      medal ? { color: medal } : t.isMe ? { color: c.accent } : null,
                    ]}
                  >
                    {t.posicion ?? '–'}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, t.isMe && { color: c.accent }]} numberOfLines={1}>
                    {t.equipo}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {t.pj} PJ · {t.pg} PG · sets {sd >= 0 ? `+${sd}` : sd}
                  </Text>
                </View>
                <View style={styles.ptsCol}>
                  <Text style={styles.ptsNum}>{t.puntos ?? 0}</Text>
                  <Text style={styles.ptsLabel}>PTS</Text>
                </View>
                {onTeamPress || !t.isMe ? <IconChevron size={14} color={c.textFaint} /> : null}
              </Pressable>
              {!onTeamPress && isOpen ? (
                <View style={styles.rosterBox}>
                  {loadingRoster === t.id_equipo ? (
                    <ActivityIndicator color={c.accent} />
                  ) : (rosters[t.id_equipo ?? -1] ?? []).length === 0 ? (
                    <Text style={styles.rowMeta}>Sin plantilla registrada.</Text>
                  ) : (
                    (rosters[t.id_equipo ?? -1] ?? []).map((p, i) => (
                      <View key={i} style={styles.rosterRow}>
                        <Text style={styles.rosterName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.rosterPts}>{p.puntos} pts</Text>
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    groupName: { color: c.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2, marginBottom: 4 },
    hint: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.6,
      color: c.textFaint,
      fontWeight: '500',
      marginBottom: 10,
    },
    empty: { paddingVertical: 26, paddingHorizontal: 8 },
    emptyText: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    posBadge: {
      width: 28,
      height: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posText: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 13, fontWeight: '800' },
    ptsCol: { alignItems: 'center', minWidth: 34 },
    ptsNum: { fontFamily: Fonts.mono, color: c.text, fontSize: 16, fontWeight: '800' },
    ptsLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 8, letterSpacing: 1, fontWeight: '500' },
    rowName: { color: c.text, fontSize: 14, fontWeight: '700' },
    rowMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2 },
    rosterBox: {
      marginTop: 4,
      marginLeft: 12,
      paddingLeft: 12,
      borderLeftWidth: 2,
      borderLeftColor: c.hairStrong,
      gap: 4,
      paddingVertical: 6,
    },
    rosterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rosterName: { flex: 1, color: c.text, fontSize: 13 },
    rosterPts: { fontFamily: Fonts.mono, color: c.accent, fontSize: 12, fontWeight: '700' },
  });
