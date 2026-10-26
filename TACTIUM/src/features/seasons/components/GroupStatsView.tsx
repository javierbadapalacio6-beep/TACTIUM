/**
 * Estadísticas del grupo con las actas de la Federación. Patrón de las apps de deporte (Mobbin: FotMob «Top
 * stats», MLS «Player stats», Apple Sports y NBA «Team comparison»): tarjetas de líderes con top 5 y «Ver todas»,
 * y barras enfrentadas (tu equipo contra la media del grupo) para el rendimiento por pista.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Radius } from '@core/theme/spacing';
import {
  computeGroupStats,
  fetchGroupActas,
  fetchGroupResults,
  niceName,
  projectTable,
  suggestLineup,
  teamResults,
  type GroupStats,
  type Record2,
  type ResultRow,
} from '@core/services/groupStats';

const pct = (r: Record2) => (r.pj > 0 ? Math.round((r.pg / r.pj) * 100) : 0);
const sg = (n: number) => (n > 0 ? `+${n}` : String(n));

export const GroupStatsView: React.FC<{
  idGrupo: string;
  equipos: string[];
  /** Nombre de TU equipo en la clasificación (para «Tu equipo»). */
  myTeam: string | null;
  /** Puntos y enfrentamientos de cada equipo (para la proyección). */
  standings: { equipo: string; puntos: number; enf: number }[];
}> = ({ idGrupo, equipos, myTeam, standings }) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [allPairs, setAllPairs] = useState(false);
  const [allPlayers, setAllPlayers] = useState(false);
  const key = equipos.join('|');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchGroupResults(idGrupo)
      .then((r) => alive && setResults(r))
      .catch(() => {});
    fetchGroupActas(idGrupo)
      .then((a) => alive && setStats(computeGroupStats(a, equipos)))
      .catch(() => alive && setStats(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idGrupo, key]);

  if (loading) return <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />;
  if (!stats || stats.total === 0) {
    return (
      <Text style={s.empty}>
        Las estadísticas aparecen en cuanto la Federación sube las primeras actas del grupo.
      </Text>
    );
  }

  const mine = myTeam ? stats.courtsByTeam.get(myTeam) ?? [] : [];
  const split = myTeam ? stats.splitByTeam.get(myTeam) : undefined;
  const pairs = allPairs ? stats.pairs : stats.pairs.slice(0, 5);
  const players = allPlayers ? stats.players : stats.players.slice(0, 5);
  const form = myTeam ? teamResults(results, myTeam, equipos) : [];
  const totalEnf = (equipos.length - 1) * 2;
  const projection = projectTable(standings, totalEnf);
  const myEnf = standings.find((r) => r.equipo === myTeam)?.enf ?? 0;
  const myPairs = myTeam ? stats.pairs.filter((p) => p.team === myTeam) : [];
  const myPlayers = myTeam ? stats.players.filter((p) => p.team === myTeam) : [];
  const suggestion = myTeam ? suggestLineup(stats, myTeam).filter((x) => x.pair) : [];

  return (
    <View style={{ marginTop: 18, gap: 14 }}>
      {myTeam && (mine.length > 0 || split) ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Tu equipo · {myTeam}</Text>
          {mine.length > 0 ? (
            <>
              <Text style={s.sub}>Partidos ganados por pista, frente a la media del grupo</Text>
              {mine.map((m) => {
                const g = stats.courtsGroup.find((x) => x.court === m.court);
                const gp = g ? pct(g) : 0;
                return (
                  <View key={m.court} style={s.barBlock}>
                    <View style={s.barHead}>
                      <Text style={s.barLabel}>Pista {m.court}</Text>
                      <Text style={s.barNums}>
                        {m.pg}/{m.pj} · {pct(m)}%
                        <Text style={{ color: c.textFaint }}>   grupo {gp}%</Text>
                      </Text>
                    </View>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${Math.max(pct(m), 2)}%`, backgroundColor: c.accent }]} />
                    </View>
                    <View style={[s.track, { marginTop: 3 }]}>
                      <View style={[s.fill, { width: `${Math.max(gp, 2)}%`, backgroundColor: c.textFaint }]} />
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}
          {split ? (
            <View style={s.tiles}>
              <Tile s={s} label="En casa" r={split.home} />
              <Tile s={s} label="Fuera" r={split.away} />
            </View>
          ) : null}
        </View>
      ) : null}

      {myTeam && form.length > 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Tendencia</Text>
          <Text style={s.sub}>Tus enfrentamientos jugados</Text>
          {form.map((f) => (
            <View key={`${f.jornada}${f.rival}`} style={s.row}>
              <View style={[s.chip, { backgroundColor: f.won ? c.accent10 : 'rgba(220,60,60,0.12)' }]}>
                <Text style={[s.chipText, { color: f.won ? c.accent : c.error }]}>{f.won ? 'V' : 'D'}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name}>{f.rival}</Text>
                <Text style={s.team}>
                  Jornada {f.jornada ?? '–'} · {f.home ? 'en casa' : 'fuera'}
                </Text>
              </View>
              <Text style={s.big}>
                {f.us}-{f.them}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.cardTitle}>Proyección</Text>
        {myEnf >= 2 ? (
          <>
            <Text style={s.sub}>Puntos al acabar la liga si cada equipo mantiene su ritmo (orientativa)</Text>
            {projection.map((p, i) => (
              <View key={p.equipo} style={s.row}>
                <Text style={s.rank}>{i + 1}</Text>
                <Text style={[s.name, { flex: 1 }, p.equipo === myTeam && { color: c.accent }]}>{p.equipo}</Text>
                <Text style={s.big}>{p.proj.toFixed(1).replace('.', ',')}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={s.sub}>Disponible desde que tu equipo juegue su segundo enfrentamiento: con uno solo, el ritmo no dice nada.</Text>
        )}
      </View>

      {myTeam && myPairs.length > 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Tus parejas</Text>
          <Text style={s.sub}>Con quién has jugado y cómo os ha ido</Text>
          {myPairs.map((p) => (
            <View key={`${p.a}${p.b}`} style={s.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name}>{niceName(p.a)}</Text>
                <Text style={s.name}>{niceName(p.b)}</Text>
                <Text style={s.team}>{p.courts.length ? `P${[...p.courts].sort().join(', P')}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.big}>
                  {p.pg}-{p.pj - p.pg}
                </Text>
                <Text style={s.small}>
                  {sg(p.sf - p.sc)} sets · {sg(p.jf - p.jc)} juegos
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {myTeam && myPlayers.length > 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Tus jugadores</Text>
          <Text style={s.sub}>Partidos ganados y juegos de cada uno</Text>
          {myPlayers.map((p) => (
            <View key={p.name} style={s.row}>
              <Text style={[s.name, { flex: 1 }]}>{niceName(p.name)}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.big}>
                  {p.pg}-{p.pj - p.pg}
                </Text>
                <Text style={s.small}>{sg(p.jf - p.jc)} juegos</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {suggestion.length > 0 ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Sugerencia de parejas</Text>
          <Text style={s.sub}>La mejor pareja de cada pista según tu historial, sin repetir jugadores. Solo orienta: no cambia tu alineación.</Text>
          {suggestion.map((x) => (
            <View key={x.court} style={s.row}>
              <Text style={s.rank}>P{x.court}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name}>{niceName(x.pair!.a)}</Text>
                <Text style={s.name}>{niceName(x.pair!.b)}</Text>
              </View>
              <Text style={s.big}>
                {x.rec!.pg}-{x.rec!.pj - x.rec!.pg}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.cardTitle}>Mejores parejas</Text>
        <Text style={s.sub}>Por porcentaje de partidos ganados; desempata sets y juegos</Text>
        {pairs.map((p, i) => (
          <View key={`${p.team}${p.a}${p.b}`} style={s.row}>
            <Text style={s.rank}>{i + 1}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Nombres enteros: bajan de línea, nunca puntos suspensivos */}
              <Text style={s.name}>{niceName(p.a)}</Text>
              <Text style={s.name}>{niceName(p.b)}</Text>
              <Text style={s.team}>
                {p.team}
                {p.courts.length ? ` · P${[...p.courts].sort().join(', P')}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.big}>
                {p.pg}-{p.pj - p.pg}
              </Text>
              <Text style={s.small}>
                {sg(p.sf - p.sc)} sets · {sg(p.jf - p.jc)} juegos
              </Text>
            </View>
          </View>
        ))}
        {stats.pairs.length > 5 ? (
          <Pressable onPress={() => setAllPairs((v) => !v)} style={s.more}>
            <Text style={s.moreText}>{allPairs ? 'Ver menos' : `Ver todas (${stats.pairs.length})`}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Jugadores</Text>
        <Text style={s.sub}>Partidos ganados de cada jugador en la liga</Text>
        {players.map((p, i) => (
          <View key={`${p.team}${p.name}`} style={s.row}>
            <Text style={s.rank}>{i + 1}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name}>{niceName(p.name)}</Text>
              <Text style={s.team}>{p.team}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.big}>
                {p.pg}-{p.pj - p.pg}
              </Text>
              <Text style={s.small}>{pct(p)}% ganados</Text>
            </View>
          </View>
        ))}
        {stats.players.length > 5 ? (
          <Pressable onPress={() => setAllPlayers((v) => !v)} style={s.more}>
            <Text style={s.moreText}>{allPlayers ? 'Ver menos' : `Ver todos (${stats.players.length})`}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={s.note}>
        Calculado con {stats.total} partidos con acta. Se actualiza solo según la Federación sube actas.
      </Text>
    </View>
  );
};

const Tile: React.FC<{ s: ReturnType<typeof makeStyles>; label: string; r: Record2 }> = ({ s, label, r }) => (
  <View style={s.tile}>
    <Text style={s.tileLabel}>{label.toUpperCase()}</Text>
    <Text style={s.tileBig}>
      {r.pg}/{r.pj}
    </Text>
    <Text style={s.small}>
      {r.pj > 0 ? `${pct(r)}% ganados` : 'Sin partidos'}
    </Text>
  </View>
);

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    empty: { marginTop: 24, color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    card: {
      padding: 14,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      gap: 10,
    },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    sub: { color: c.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: -4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hair,
    },
    rank: { width: 18, color: c.textMuted, fontSize: 13, fontWeight: '700' },
    name: { color: c.text, fontSize: 14, fontWeight: '700', lineHeight: 18 },
    team: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    big: { color: c.accent, fontSize: 18, fontWeight: '800' },
    small: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
    more: { alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: c.accent10 },
    moreText: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
    barBlock: { gap: 4 },
    barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    barLabel: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    barNums: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    track: { height: 6, borderRadius: 3, backgroundColor: c.hair, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
    tiles: { flexDirection: 'row', gap: 10 },
    tile: {
      flex: 1,
      padding: 12,
      borderRadius: Radius.lg,
      backgroundColor: c.accent10,
      gap: 2,
    },
    tileLabel: { color: c.textMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
    tileBig: { color: c.text, fontSize: 22, fontWeight: '800' },
    chip: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    chipText: { fontSize: 13, fontWeight: '800' },
    note: { color: c.textFaint, fontSize: 11.5, textAlign: 'center', lineHeight: 16 },
  });
