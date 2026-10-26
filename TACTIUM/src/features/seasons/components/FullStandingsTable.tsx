/**
 * Clasificación COMPLETA de un grupo, como la de la Federación: posición, equipo, enfrentamientos,
 * puntos, partidos (jugados / ganados), sets (a favor / en contra / average) y juegos (idem).
 * Patrón de las apps de fútbol (FotMob, Apple Sports): la columna de equipo queda fija a la izquierda y
 * las cifras se desplazan en horizontal, así en el móvil nada se corta ni se aprieta.
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import type { FcpBrowseStanding } from '@core/services/fcpBrowse';

const COL = 40;

type Col = { key: string; label: string; wide?: boolean; value: (t: FcpBrowseStanding) => string; strong?: boolean };

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

const COLS: Col[] = [
  { key: 'enf', label: 'ENF', value: (t) => String(t.stats.enf) },
  { key: 'pts', label: 'PTS', strong: true, value: (t) => String(t.puntos ?? 0) },
  { key: 'pj', label: 'PJ', value: (t) => String(t.stats.pj) },
  { key: 'pg', label: 'PG', value: (t) => String(t.stats.pg) },
  { key: 'sf', label: 'SF', value: (t) => String(t.stats.sf) },
  { key: 'sc', label: 'SC', value: (t) => String(t.stats.sc) },
  { key: 'sa', label: 'AVG S', wide: true, value: (t) => sign(t.stats.sf - t.stats.sc) },
  { key: 'jf', label: 'JF', value: (t) => String(t.stats.jf) },
  { key: 'jc', label: 'JC', value: (t) => String(t.stats.jc) },
  { key: 'ja', label: 'AVG J', wide: true, value: (t) => sign(t.stats.jf - t.stats.jc) },
];

/** Líderes del grupo con lo que ya hay en actas: quién ataca más, quién defiende mejor, quién gana más partidos. */
function leaders(rows: FcpBrowseStanding[]): { label: string; team: string; value: string }[] {
  const played = rows.filter((t) => t.stats.pj > 0);
  if (played.length === 0) return [];
  const best = (score: (t: FcpBrowseStanding) => number) =>
    played.reduce((a, b) => (score(b) > score(a) ? b : a));
  const ataque = best((t) => t.stats.jf / t.stats.pj);
  const defensa = best((t) => -t.stats.jc / t.stats.pj);
  const efic = best((t) => t.stats.pg / t.stats.pj);
  const avg = best((t) => t.stats.jf - t.stats.jc);
  return [
    { label: 'Mejor ataque', team: ataque.equipo, value: `${(ataque.stats.jf / ataque.stats.pj).toFixed(1)} juegos/partido` },
    { label: 'Mejor defensa', team: defensa.equipo, value: `${(defensa.stats.jc / defensa.stats.pj).toFixed(1)} juegos en contra/partido` },
    { label: 'Más efectivo', team: efic.equipo, value: `${Math.round((efic.stats.pg / efic.stats.pj) * 100)}% de partidos ganados` },
    { label: 'Mayor average de juegos', team: avg.equipo, value: sign(avg.stats.jf - avg.stats.jc) },
  ];
}

export const FullStandingsTable: React.FC<{
  rows: FcpBrowseStanding[];
  myFcpId: number | null;
  zoneColorOf: (posicion: number | null) => string | null;
  onTeam: (t: FcpBrowseStanding) => void;
}> = ({ rows, myFcpId, zoneColorOf, onTeam }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const lead = leaders(rows);
  return (
    <>
    <View style={s.wrap}>
      {/* Izquierda fija: # y equipo (el nombre entero, hasta 2 líneas) */}
      <View style={s.fixed}>
        <View style={s.headRow}>
          <Text style={[s.th, { width: 22 }]}>#</Text>
          <Text style={[s.th, { flex: 1 }]}>EQUIPO</Text>
        </View>
        {rows.map((t) => {
          const mine = myFcpId != null && t.idEquipo === myFcpId;
          const zc = zoneColorOf(t.posicion);
          return (
            <Pressable
              key={`${t.idEquipo}-${t.equipo}`}
              onPress={() => onTeam(t)}
              style={[s.row, mine && { backgroundColor: c.accent10 }]}
            >
              <View style={[s.zoneBar, { backgroundColor: zc ?? 'transparent' }]} />
              <Text style={[s.pos, { width: 22 }]}>{t.posicion ?? '–'}</Text>
              <Text style={[s.team, mine && { color: c.accent }]} numberOfLines={2}>
                {t.equipo}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Derecha desplazable: las cifras */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View>
          <View style={s.headRow}>
            {COLS.map((col) => (
              <Text key={col.key} style={[s.th, s.num, { width: col.wide ? COL + 14 : COL }]}>
                {col.label}
              </Text>
            ))}
          </View>
          {rows.map((t) => {
            const mine = myFcpId != null && t.idEquipo === myFcpId;
            return (
              <View key={`${t.idEquipo}-${t.equipo}`} style={[s.row, mine && { backgroundColor: c.accent10 }]}>
                {COLS.map((col) => (
                  <Text
                    key={col.key}
                    style={[
                      s.cell,
                      { width: col.wide ? COL + 14 : COL },
                      col.strong && { color: c.text, fontWeight: '700' },
                    ]}
                  >
                    {col.value(t)}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
    {lead.length > 0 ? (
      <View style={s.leadGrid}>
        {lead.map((l) => (
          <View key={l.label} style={s.leadCard}>
            <Text style={s.leadLabel}>{l.label.toUpperCase()}</Text>
            <Text style={s.leadTeam}>{l.team}</Text>
            <Text style={s.leadValue}>{l.value}</Text>
          </View>
        ))}
      </View>
    ) : null}
    </>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      marginTop: 10,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      overflow: 'hidden',
    },
    fixed: { width: 150, borderRightWidth: 1, borderRightColor: c.hair },
    headRow: {
      height: 30,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.hair,
    },
    th: { color: c.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
    num: { textAlign: 'center' },
    row: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hair,
    },
    zoneBar: { position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2 },
    pos: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    team: { flex: 1, color: c.text, fontSize: 13, fontWeight: '700', paddingRight: 6, lineHeight: 16 },
    leadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    leadCard: {
      flexGrow: 1,
      flexBasis: '47%',
      padding: 12,
      gap: 3,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
    },
    leadLabel: { color: c.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
    leadTeam: { color: c.text, fontSize: 14, fontWeight: '700' },
    leadValue: { color: c.accent, fontSize: 12.5, fontWeight: '600' },
    cell: { textAlign: 'center', color: c.textMuted, fontSize: 13, fontWeight: '500' },
  });
