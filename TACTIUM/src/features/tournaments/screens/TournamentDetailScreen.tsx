import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconShare, IconTrophy, IconTrash, BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import {
  getTournament,
  listRegistrations,
  listMatches,
  addRegistration,
  deleteRegistration,
  generateKoBracket,
  generateRoundRobin,
  generateGroups,
  generateKnockoutFromGroups,
  computeStandings,
  posBracket,
  BRACKET_LABEL,
  groupName,
  setMatchResult,
  formatConfig,
  type Tournament,
  type TournamentRegistration,
  type TournamentMatch,
  type StandingRow,
} from '@core/services/tournaments';

import type { TournamentsStackScreenProps } from '@navigation/types';

const roundLabel = (round: number, total: number): string => {
  const fromEnd = total - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinales';
  if (fromEnd === 2) return 'Cuartos';
  if (fromEnd === 3) return 'Octavos';
  return `Ronda ${round}`;
};
const shortRoundLabel = (round: number, total: number): string => {
  const fromEnd = total - round;
  if (fromEnd === 0) return 'F';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  if (fromEnd === 3) return '8';
  return `R${round}`;
};

// Geometría del cuadro (para alinear rondas y dibujar los conectores en L).
const BRACKET_H = 60; // alto de cada partido
const BRACKET_G = 16; // hueco base entre partidos de la 1ª ronda
const COL_W = 198; // ancho de columna de ronda
const CONN_W = 26; // ancho de la columna de conectores
const HEADER_H = 46; // alto reservado para la cabecera de ronda
const PITCH1 = BRACKET_H + BRACKET_G;
const roundMetrics = (r: number) => ({
  pitch: PITCH1 * Math.pow(2, r - 1),
  topOffset: (PITCH1 * (Math.pow(2, r - 1) - 1)) / 2,
});

// Líneas conectoras en L entre la ronda `round` y la siguiente.
const RoundConnectors: React.FC<{
  round: number;
  targets: number;
  totalH: number;
  line: string;
  hidden: boolean;
}> = ({ round, targets, totalH, line, hidden }) => {
  if (hidden) return <View style={{ width: CONN_W }} />;
  const mR = roundMetrics(round);
  const mN = roundMetrics(round + 1);
  return (
    <View style={{ width: CONN_W }}>
      <View style={{ height: HEADER_H }} />
      <View style={{ height: totalH }}>
        {Array.from({ length: targets }, (_, k) => {
          const yA = mR.topOffset + 2 * k * mR.pitch + BRACKET_H / 2;
          const yB = mR.topOffset + (2 * k + 1) * mR.pitch + BRACKET_H / 2;
          const yT = mN.topOffset + k * mN.pitch + BRACKET_H / 2;
          const top = Math.min(yA, yB);
          const h = Math.abs(yB - yA);
          return (
            <React.Fragment key={k}>
              <View style={{ position: 'absolute', left: 0, top: yA, width: CONN_W / 2, height: 1.5, backgroundColor: line }} />
              <View style={{ position: 'absolute', left: 0, top: yB, width: CONN_W / 2, height: 1.5, backgroundColor: line }} />
              <View style={{ position: 'absolute', left: CONN_W / 2 - 0.75, top, width: 1.5, height: h, backgroundColor: line }} />
              <View style={{ position: 'absolute', left: CONN_W / 2, top: yT, width: CONN_W / 2, height: 1.5, backgroundColor: line }} />
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

// Una "división" = un cuadro: combinación de género y categoría.
interface Division {
  gender: string | null;
  category: string | null;
}
const sameDiv = (a: Division, b: Division) =>
  a.gender === b.gender && a.category === b.category;
const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};
const divLabel = (d: Division): string =>
  [d.gender ? GENDER_LABEL[d.gender] ?? d.gender : null, d.category]
    .filter(Boolean)
    .join(' · ') || 'General';

export const TournamentDetailScreen = ({
  navigation,
  route,
}: TournamentsStackScreenProps<'TournamentDetail'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;

  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editMatch, setEditMatch] = useState<TournamentMatch | null>(null);
  const [activeDiv, setActiveDiv] = useState<Division | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleRound = (r: number) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(r)) n.delete(r);
      else n.add(r);
      return n;
    });

  const load = useCallback(async () => {
    try {
      const [tt, rr, mm] = await Promise.all([
        getTournament(tournamentId),
        listRegistrations(tournamentId),
        listMatches(tournamentId),
      ]);
      setT(tt);
      setRegs(rr);
      setMatches(mm);
    } catch (e: any) {
      toast.error('No se pudo cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const regName = useCallback(
    (id: string | null): string => {
      if (!id) return '—';
      const r = regs.find((x) => x.id === id);
      if (!r) return '—';
      const seed = r.seed ? `(${r.seed}) ` : '';
      return `${seed}${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}`;
    },
    [regs],
  );

  // Divisiones = género × categoría (cada una su cuadro).
  const divisions = useMemo<Division[]>(() => {
    const gs = t?.genders?.length ? t.genders : [null];
    const cs = t?.categories?.length ? t.categories : [null];
    const out: Division[] = [];
    for (const g of gs) for (const cat of cs) out.push({ gender: g, category: cat });
    return out;
  }, [t]);

  useEffect(() => {
    if (
      divisions.length > 0 &&
      (!activeDiv || !divisions.some((d) => sameDiv(d, activeDiv)))
    ) {
      setActiveDiv(divisions[0]);
    }
  }, [divisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const dg = activeDiv?.gender ?? null;
  const dc = activeDiv?.category ?? null;
  const regsCat = useMemo(
    () => regs.filter((r) => r.gender === dg && r.category === dc),
    [regs, dg, dc],
  );
  const matchesCat = useMemo(
    () => matches.filter((m) => m.gender === dg && m.category === dc),
    [matches, dg, dc],
  );

  const isRR = t?.format === 'round_robin';
  const isGroups = t?.format === 'groups_ko';
  const hasBracket = matchesCat.length > 0;

  const standings = useMemo(
    () => (isRR ? computeStandings(regsCat, matchesCat) : []),
    [isRR, regsCat, matchesCat],
  );

  const champion = useMemo(() => {
    if (!hasBracket) return null;
    if (isRR) {
      const allPlayed =
        matchesCat.length > 0 && matchesCat.every((m) => m.status === 'finished');
      return allPlayed ? standings[0]?.regId ?? null : null;
    }
    // KO (o cuadro ORO en grupos): ganador de la final del cuadro principal.
    const mainBracket = isGroups ? 'gold' : 'main';
    const koMatches = matchesCat.filter((m) => m.bracket === mainBracket);
    const tr = koMatches.reduce((mx, x) => Math.max(mx, x.round), 0);
    const final = koMatches.find(
      (m) => m.round === tr && m.slot === 0 && m.status === 'finished',
    );
    return final?.winner_reg ?? null;
  }, [hasBracket, isRR, isGroups, matchesCat, standings]);

  const runGenerate = async (fn: () => Promise<void>) => {
    setGenerating(true);
    try {
      await fn();
      await load();
    } catch (e: any) {
      toast.error('No se pudo generar', e?.message ?? '');
    } finally {
      setGenerating(false);
    }
  };

  const onGenerate = () => {
    if (!t) return;
    if (isGroups) {
      Alert.alert(
        'Generar grupos',
        `¿De cuántas parejas por grupo? Se repartirán las ${regsCat.length} parejas por siembra.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Grupos de 3', onPress: () => runGenerate(() => generateGroups(t, regsCat, dg, dc, 3)) },
          { text: 'Grupos de 4', onPress: () => runGenerate(() => generateGroups(t, regsCat, dg, dc, 4)) },
        ],
      );
      return;
    }
    Alert.alert(
      'Generar',
      `Se ${isRR ? 'creará la liga' : 'creará el cuadro'}${activeDiv ? ` de ${divLabel(activeDiv)}` : ''} con ${regsCat.length} parejas. No podrás añadir más parejas a esta división.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: () =>
            runGenerate(() =>
              isRR
                ? generateRoundRobin(t, regsCat, dg, dc)
                : generateKoBracket(t, regsCat, dg, dc),
            ),
        },
      ],
    );
  };

  const onGenerateKnockout = () => {
    if (!t) return;
    Alert.alert(
      'Generar eliminatorias',
      'Se crearán los cuadros (oro, plata, bronce…) con los clasificados de cada grupo por su posición.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: () =>
            runGenerate(() =>
              generateKnockoutFromGroups(t, regsCat, matchesCat, dg, dc),
            ),
        },
      ],
    );
  };

  const shareCode = async () => {
    if (!t?.signup_code) return;
    try {
      await Share.share({
        message:
          `🎾 Apúntate al torneo "${t.name}" en TACTIUM.\n` +
          `Código de inscripción: ${t.signup_code}`,
      });
    } catch {
      /* cancelado */
    }
  };

  const removeReg = (r: TournamentRegistration) => {
    Alert.alert('Quitar pareja', `¿Quitar a ${r.p1_name}${r.p2_name ? ' / ' + r.p2_name : ''}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRegistration(r.id);
            await load();
          } catch (e: any) {
            toast.error('No se pudo quitar', e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>TORNEO</Text>
          <Text style={styles.title} numberOfLines={1}>
            {t?.name ?? ''}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Campeón */}
          {champion ? (
            <View style={styles.championCard}>
              <IconTrophy size={22} color={c.accent} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.championLabel}>CAMPEÓN</Text>
                <Text style={styles.championName} numberOfLines={1}>
                  {regName(champion)}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Pestañas por división (género × categoría), cada una su cuadro */}
          {divisions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catTabs}
            >
              {divisions.map((d) => {
                const sel = activeDiv != null && sameDiv(d, activeDiv);
                return (
                  <Pressable
                    key={divLabel(d)}
                    onPress={() => setActiveDiv(d)}
                    style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                  >
                    <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                      {divLabel(d)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Fase de inscripción */}
          {!hasBracket ? (
            <View style={{ paddingHorizontal: 22 }}>
              {t?.signup_code ? (
                <View style={styles.codeCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.codeLabel}>CÓDIGO DE INSCRIPCIÓN</Text>
                    <Text style={styles.code}>{t.signup_code}</Text>
                    <Text style={styles.codeHint}>
                      Compártelo para que se apunten desde la app.
                    </Text>
                  </View>
                  <Pressable
                    onPress={shareCode}
                    hitSlop={8}
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
                  >
                    <IconShare size={16} color={c.accent} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.regHeader}>
                <Text style={styles.sectionLabel}>
                  INSCRITOS
                  {activeDiv && divisions.length > 1 ? ` · ${divLabel(activeDiv)}` : ''} ·{' '}
                  {regsCat.length}
                  {t?.max_pairs ? `/${t.max_pairs}` : ''}
                </Text>
                <Pressable onPress={() => setAdding(true)} hitSlop={8}>
                  <Text style={styles.addLink}>+ Añadir pareja</Text>
                </Pressable>
              </View>

              {regsCat.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aún no hay parejas
                  {activeDiv && divisions.length > 1 ? ` en ${divLabel(activeDiv)}` : ''}.
                  Añádelas a mano o comparte el código.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {regsCat.map((r, i) => (
                    <View key={r.id} style={styles.regRow}>
                      <Text style={styles.regIdx}>{i + 1}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.regName} numberOfLines={1}>
                          {r.p1_name}
                          {r.p2_name ? ` / ${r.p2_name}` : ''}
                        </Text>
                        <Text style={styles.regMeta} numberOfLines={1}>
                          {[
                            r.seed_points != null ? `${r.seed_points} pts` : null,
                            ...r.availability,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Sin datos extra'}
                        </Text>
                      </View>
                      <Pressable onPress={() => removeReg(r)} hitSlop={8}>
                        <IconTrash size={14} color={c.textFaint} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                onPress={onGenerate}
                disabled={regsCat.length < 2 || generating}
                style={({ pressed }) => [
                  styles.generateBtn,
                  (regsCat.length < 2 || generating) && { opacity: 0.4 },
                  pressed && { opacity: 0.9 },
                ]}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={c.textInverse} />
                ) : (
                  <Text style={styles.generateLabel}>
                    {isGroups ? 'Generar grupos' : isRR ? 'Generar liga' : 'Generar cuadro'}
                    {activeDiv && divisions.length > 1 ? ` · ${divLabel(activeDiv)}` : ''}
                  </Text>
                )}
              </Pressable>
              {regsCat.length < 2 ? (
                <Text style={styles.genHint}>
                  Hacen falta al menos 2 parejas
                  {activeDiv && divisions.length > 1 ? ` en ${divLabel(activeDiv)}` : ''}.
                </Text>
              ) : null}
            </View>
          ) : isRR ? (
            <RoundRobinView
              standings={standings}
              matches={matchesCat}
              regName={regName}
              onEdit={setEditMatch}
            />
          ) : isGroups ? (
            <GroupsView
              regs={regsCat}
              matches={matchesCat}
              regName={regName}
              collapsed={collapsed}
              toggleRound={toggleRound}
              onEdit={setEditMatch}
              onGenerateKnockout={onGenerateKnockout}
              generating={generating}
            />
          ) : (
            <View>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
                CUADRO
              </Text>
              <BracketView
                matches={matchesCat.filter((m) => m.bracket === 'main')}
                regName={regName}
                onEdit={setEditMatch}
                collapsed={collapsed}
                toggleRound={toggleRound}
              />
              <Text style={styles.bracketHint}>
                Toca una ronda para ocultarla/mostrarla. Toca un partido para meter
                el resultado.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <AddPairSheet
        open={adding}
        tournamentId={tournamentId}
        gender={dg}
        category={dc}
        onClose={() => setAdding(false)}
        onAdded={load}
      />

      <ResultSheet
        match={editMatch}
        matchFormat={t?.match_format ?? 'bo3_stb'}
        advance={!isRR}
        homeName={regName(editMatch?.home_reg ?? null)}
        awayName={regName(editMatch?.away_reg ?? null)}
        onClose={() => setEditMatch(null)}
        onSaved={load}
      />
    </View>
  );
};

const MatchSide: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  name: string;
  score: number | null;
  win: boolean;
}> = ({ styles, name, score, win }) => (
  <View style={styles.matchSide}>
    <Text
      style={[styles.matchName, win && styles.matchNameWin]}
      numberOfLines={1}
    >
      {name}
    </Text>
    <Text style={[styles.matchScore, win && styles.matchNameWin]}>
      {score ?? ''}
    </Text>
  </View>
);

type Styles = ReturnType<typeof makeStyles>;

// Fila de partido (liga/grupo): parejas + marcador en sets o "Poner".
const MatchRow: React.FC<{
  m: TournamentMatch;
  regName: (id: string | null) => string;
  onEdit: (m: TournamentMatch) => void;
  styles: Styles;
}> = ({ m, regName, onEdit, styles }) => {
  const done = m.status === 'finished';
  const homeWin = m.winner_reg === m.home_reg;
  return (
    <Pressable
      onPress={() => onEdit(m)}
      style={({ pressed }) => [styles.rrMatch, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rrName, done && homeWin && styles.rrWin]} numberOfLines={1}>
          {regName(m.home_reg)}
        </Text>
        <Text style={[styles.rrName, done && !homeWin && styles.rrWin]} numberOfLines={1}>
          {regName(m.away_reg)}
        </Text>
      </View>
      {done ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.rrScore}>{m.home_score}</Text>
          <Text style={styles.rrScore}>{m.away_score}</Text>
        </View>
      ) : (
        <Text style={styles.rrPending}>Poner</Text>
      )}
    </Pressable>
  );
};

// Tabla de clasificación (liga/grupo).
const StandingsTable: React.FC<{ standings: StandingRow[]; styles: Styles }> = ({
  standings,
  styles,
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
    <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
      <View style={styles.stHeader}>
        <Text style={styles.stPos}>#</Text>
        <Text style={styles.stName}>PAREJA</Text>
        <Text style={styles.stCol}>PJ</Text>
        <Text style={styles.stCol}>G</Text>
        <Text style={styles.stCol}>P</Text>
        <Text style={styles.stColW}>SETS</Text>
        <Text style={styles.stColW}>JUEGOS</Text>
        <Text style={styles.stCol}>PTS</Text>
      </View>
      {standings.map((s, i) => (
        <View key={s.regId} style={styles.stRow}>
          <Text style={styles.stPos}>{i + 1}</Text>
          <Text style={styles.stName} numberOfLines={1}>{s.name}</Text>
          <Text style={styles.stCol}>{s.played}</Text>
          <Text style={styles.stCol}>{s.won}</Text>
          <Text style={styles.stCol}>{s.lost}</Text>
          <Text style={styles.stColW}>{s.setsFor}-{s.setsAgainst}</Text>
          <Text style={styles.stColW}>{s.gamesFor}-{s.gamesAgainst}</Text>
          <Text style={[styles.stCol, styles.stPts]}>{s.points}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);

// Cuadro KO (columnas por ronda + conectores + rondas colapsables).
const BracketView: React.FC<{
  matches: TournamentMatch[];
  regName: (id: string | null) => string;
  onEdit: (m: TournamentMatch) => void;
  collapsed: Set<number>;
  toggleRound: (r: number) => void;
}> = ({ matches, regName, onEdit, collapsed, toggleRound }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const totalRounds = matches.reduce((m, x) => Math.max(m, x.round), 0);
  const r1count = matches.filter((m) => m.round === 1).length;
  const totalH = r1count * PITCH1;
  if (matches.length === 0) {
    return <Text style={styles.bracketHint}>Sin cuadro todavía.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 22, paddingTop: 12 }}>
        {Array.from({ length: totalRounds }, (_, r) => r + 1).map((round) => {
          const col = matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.slot - b.slot);
          const isCol = collapsed.has(round);
          const { pitch, topOffset } = roundMetrics(round);
          return (
            <React.Fragment key={round}>
              <View style={{ width: isCol ? 52 : COL_W }}>
                <Pressable
                  onPress={() => toggleRound(round)}
                  style={({ pressed }) => [styles.roundPill, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.roundPillText} numberOfLines={1}>
                    {isCol ? shortRoundLabel(round, totalRounds) : roundLabel(round, totalRounds)}
                  </Text>
                  <Text style={styles.roundPillChevron}>{isCol ? '›' : '⌄'}</Text>
                </Pressable>
                {isCol ? (
                  <View style={[styles.collapsedStrip, { height: totalH }]}>
                    <Text style={styles.collapsedText}>{col.length}</Text>
                  </View>
                ) : (
                  <View style={{ height: totalH }}>
                    {col.map((m, i) => {
                      const playable = !!m.home_reg && !!m.away_reg;
                      const homeWin = m.winner_reg && m.winner_reg === m.home_reg;
                      const awayWin = m.winner_reg && m.winner_reg === m.away_reg;
                      return (
                        <Pressable
                          key={m.id}
                          disabled={!playable}
                          onPress={() => onEdit(m)}
                          style={({ pressed }) => [
                            styles.matchCard,
                            { marginTop: i === 0 ? topOffset : pitch - BRACKET_H, height: BRACKET_H },
                            pressed && playable && { opacity: 0.85 },
                          ]}
                        >
                          <MatchSide styles={styles} name={regName(m.home_reg)} score={m.home_score} win={!!homeWin} />
                          <View style={styles.matchDivider} />
                          <MatchSide styles={styles} name={regName(m.away_reg)} score={m.away_score} win={!!awayWin} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
              {round < totalRounds ? (
                <RoundConnectors
                  round={round}
                  targets={Math.floor(r1count / Math.pow(2, round))}
                  totalH={totalH}
                  line={c.hairStrong}
                  hidden={isCol || collapsed.has(round + 1)}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </ScrollView>
  );
};

// Vista de LIGA: clasificación + lista de partidos.
const RoundRobinView: React.FC<{
  standings: StandingRow[];
  matches: TournamentMatch[];
  regName: (id: string | null) => string;
  onEdit: (m: TournamentMatch) => void;
}> = ({ standings, matches, regName, onEdit }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const sorted = [...matches].sort((a, b) => a.slot - b.slot);
  const played = matches.filter((m) => m.status === 'finished').length;
  return (
    <View>
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
        CLASIFICACIÓN
      </Text>
      <StandingsTable standings={standings} styles={styles} />
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 24 }]}>
        PARTIDOS · {played}/{matches.length}
      </Text>
      <View style={{ paddingHorizontal: 22, gap: 8, marginTop: 6 }}>
        {sorted.map((m) => (
          <MatchRow key={m.id} m={m} regName={regName} onEdit={onEdit} styles={styles} />
        ))}
      </View>
    </View>
  );
};

// Vista de GRUPOS + eliminatorias: fase de grupos (clasificación + partidos) y
// luego los cuadros por posición (oro/plata/bronce).
const GroupsView: React.FC<{
  regs: TournamentRegistration[];
  matches: TournamentMatch[];
  regName: (id: string | null) => string;
  collapsed: Set<number>;
  toggleRound: (r: number) => void;
  onEdit: (m: TournamentMatch) => void;
  onGenerateKnockout: () => void;
  generating: boolean;
}> = ({ regs, matches, regName, collapsed, toggleRound, onEdit, onGenerateKnockout, generating }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const groupMatches = matches.filter((m) => m.bracket === 'grp');
  const koMatches = matches.filter((m) => m.bracket !== 'grp');
  const groupNos = Array.from(
    new Set(regs.filter((r) => r.group_no != null).map((r) => r.group_no as number)),
  ).sort((a, b) => a - b);
  const allGroupsDone =
    groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished');
  const koBrackets = Array.from(new Set(koMatches.map((m) => m.bracket)));
  const [activeBracket, setActiveBracket] = useState<string | null>(null);
  useEffect(() => {
    if (koBrackets.length && (!activeBracket || !koBrackets.includes(activeBracket))) {
      setActiveBracket(koBrackets[0]);
    }
  }, [koMatches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (koMatches.length === 0) {
    return (
      <View>
        {groupNos.map((gn) => {
          const gRegs = regs.filter((r) => r.group_no === gn);
          const gMatches = groupMatches
            .filter((m) => m.group_no === gn)
            .sort((a, b) => a.slot - b.slot);
          const st = computeStandings(gRegs, gMatches);
          return (
            <View key={gn}>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 18 }]}>
                GRUPO {groupName(gn)}
              </Text>
              <StandingsTable standings={st} styles={styles} />
              <View style={{ paddingHorizontal: 22, gap: 8, marginTop: 8 }}>
                {gMatches.map((m) => (
                  <MatchRow key={m.id} m={m} regName={regName} onEdit={onEdit} styles={styles} />
                ))}
              </View>
            </View>
          );
        })}
        <Pressable
          onPress={onGenerateKnockout}
          disabled={!allGroupsDone || generating}
          style={({ pressed }) => [
            styles.generateBtn,
            { marginHorizontal: 22, marginTop: 20 },
            (!allGroupsDone || generating) && { opacity: 0.4 },
            pressed && { opacity: 0.9 },
          ]}
        >
          {generating ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.generateLabel}>Generar eliminatorias</Text>
          )}
        </Pressable>
        {!allGroupsDone ? (
          <Text style={styles.genHint}>
            Termina todos los partidos de grupo para generar las eliminatorias.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      {koBrackets.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catTabs}
        >
          {koBrackets.map((b) => {
            const sel = activeBracket === b;
            return (
              <Pressable
                key={b}
                onPress={() => setActiveBracket(b)}
                style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                  {BRACKET_LABEL[b] ?? b}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 12 }]}>
        {(BRACKET_LABEL[activeBracket ?? ''] ?? 'CUADRO').toUpperCase()}
      </Text>
      <BracketView
        matches={koMatches.filter((m) => m.bracket === activeBracket)}
        regName={regName}
        onEdit={onEdit}
        collapsed={collapsed}
        toggleRound={toggleRound}
      />
    </View>
  );
};

const AddPairSheet: React.FC<{
  open: boolean;
  tournamentId: string;
  gender: string | null;
  category: string | null;
  onClose: () => void;
  onAdded: () => void;
}> = ({ open, tournamentId, gender, category, onClose, onAdded }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [pts, setPts] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setP1('');
      setP2('');
      setPts('');
    }
  }, [open]);

  const save = async () => {
    if (!p1.trim()) {
      toast.error('Falta el jugador 1');
      return;
    }
    setSaving(true);
    try {
      await addRegistration({
        tournamentId,
        gender,
        category,
        p1Name: p1,
        p2Name: p2,
        seedPoints: pts ? parseInt(pts, 10) : null,
      });
      onAdded();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo añadir', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || !p1.trim()}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !p1.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Añadir pareja</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>AÑADIR PAREJA</Text>
      <Text style={styles.sheetTitle}>Alta manual</Text>

      <Text style={styles.label}>JUGADOR 1</Text>
      <View style={styles.input}>
        <TextInput value={p1} onChangeText={setP1} placeholder="Nombre" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
      </View>
      <Text style={styles.label}>JUGADOR 2</Text>
      <View style={styles.input}>
        <TextInput value={p2} onChangeText={setP2} placeholder="Nombre (opcional)" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
      </View>
      <Text style={styles.label}>PUNTOS PARA LA SIEMBRA · OPCIONAL</Text>
      <View style={styles.input}>
        <TextInput
          value={pts}
          onChangeText={(v) => setPts(v.replace(/[^0-9]/g, ''))}
          placeholder="p. ej. 1500"
          placeholderTextColor={c.textFaint}
          style={styles.inputField}
          keyboardType="number-pad"
          maxLength={5}
        />
      </View>
    </BottomSheet>
  );
};

const ResultSheet: React.FC<{
  match: TournamentMatch | null;
  matchFormat: string;
  advance: boolean;
  homeName: string;
  awayName: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ match, matchFormat, advance, homeName, awayName, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cfg = useMemo(() => formatConfig(matchFormat), [matchFormat]);
  const [rows, setRows] = useState<{ h: string; a: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    setRows(
      Array.from({ length: cfg.maxSets }, (_, i) => {
        const s = match.sets?.[i];
        return { h: s ? String(s[0]) : '', a: s ? String(s[1]) : '' };
      }),
    );
  }, [match, cfg.maxSets]);

  const setCell = (i: number, side: 'h' | 'a', v: string) =>
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [side]: v.replace(/[^0-9]/g, '') } : r)),
    );

  const { wonHome, wonAway } = useMemo(() => {
    let wh = 0;
    let wa = 0;
    for (const r of rows) {
      const h = parseInt(r.h, 10);
      const a = parseInt(r.a, 10);
      if (Number.isNaN(h) || Number.isNaN(a) || h === a) continue;
      if (h > a) wh++;
      else wa++;
    }
    return { wonHome: wh, wonAway: wa };
  }, [rows]);

  const decided = wonHome >= cfg.setsToWin || wonAway >= cfg.setsToWin;

  const save = async () => {
    if (!match) return;
    const sets = rows
      .map((r) => [parseInt(r.h, 10), parseInt(r.a, 10)])
      .filter(([h, a]) => !Number.isNaN(h) && !Number.isNaN(a) && (h !== 0 || a !== 0));
    setSaving(true);
    try {
      await setMatchResult(match, sets, cfg.setsToWin, advance);
      toast.success('Resultado guardado');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? '');
    } finally {
      setSaving(false);
    }
  };

  const setLabel = (i: number) =>
    cfg.thirdSuperTb && cfg.maxSets === 3 && i === 2
      ? 'SUPER TIE-BREAK (a 11)'
      : `SET ${i + 1}`;

  return (
    <BottomSheet
      open={!!match}
      onClose={onClose}
      footer={
        <Pressable
          onPress={save}
          disabled={saving || !decided}
          style={({ pressed }) => [
            styles.saveBtn,
            (saving || !decided) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Guardar resultado</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>RESULTADO · {cfg.label.toUpperCase()}</Text>
      <Text style={styles.setTeam} numberOfLines={1}>{homeName}</Text>
      <Text style={styles.setVs}>vs</Text>
      <Text style={styles.setTeam} numberOfLines={1}>{awayName}</Text>

      {rows.map((r, i) => (
        <View key={i} style={styles.setRow}>
          <Text style={styles.setRowLabel}>{setLabel(i)}</Text>
          <View style={styles.setInputs}>
            <TextInput
              value={r.h}
              onChangeText={(v) => setCell(i, 'h', v)}
              placeholder="0"
              placeholderTextColor={c.textFaint}
              style={styles.setInput}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.setSep}>–</Text>
            <TextInput
              value={r.a}
              onChangeText={(v) => setCell(i, 'a', v)}
              placeholder="0"
              placeholderTextColor={c.textFaint}
              style={styles.setInput}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
      ))}

      <Text style={[styles.liveResult, decided && { color: c.accent }]}>
        {wonHome}–{wonAway} en sets
        {decided
          ? ` · gana ${wonHome > wonAway ? homeName : awayName}`
          : ' · marcador incompleto'}
      </Text>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    championCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 22,
      marginTop: 8,
      padding: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.accent15,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    championLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.accentDim, fontWeight: '600' },
    championName: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
    catTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingTop: 12 },
    catTab: {
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catTabText: { fontSize: 14, fontWeight: '700' },
    codeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent25,
      padding: 16,
      marginTop: 8,
    },
    codeLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: c.textFaint, fontWeight: '500' },
    code: { fontFamily: Fonts.mono, fontSize: 28, fontWeight: '800', color: c.accent, letterSpacing: 4, marginTop: 4 },
    codeHint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    shareBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    regHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 8,
    },
    sectionLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: c.textFaint, textTransform: 'uppercase', fontWeight: '500' },
    addLink: { color: c.accent, fontSize: 13, fontWeight: '600' },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    regRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    regIdx: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.textFaint, width: 20 },
    regName: { color: c.text, fontSize: 15, fontWeight: '600' },
    regMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    generateBtn: {
      height: 52,
      marginTop: 20,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    genHint: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 8 },
    // Bracket
    bracket: { paddingHorizontal: 22, paddingTop: 12, gap: 14 },
    roundCol: { width: 190 },
    roundLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      color: c.accent,
      textTransform: 'uppercase',
      fontWeight: '600',
      marginBottom: 10,
    },
    roundColInner: { flex: 1, justifyContent: 'space-around', gap: 10 },
    roundPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 34,
      marginBottom: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 8,
    },
    roundPillText: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1,
      color: c.accent,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    roundPillChevron: { color: c.textFaint, fontSize: 12, fontWeight: '700' },
    collapsedStrip: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    collapsedText: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      color: c.textFaint,
    },
    matchCard: {
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 10,
    },
    matchSide: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    matchName: { flex: 1, color: c.textMuted, fontSize: 12, fontWeight: '500' },
    matchNameWin: { color: c.accent, fontWeight: '800' },
    matchScore: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.text, minWidth: 16, textAlign: 'right' },
    matchDivider: { height: 1, backgroundColor: c.hair },
    bracketHint: { color: c.textFaint, fontSize: 12, paddingHorizontal: 22, marginTop: 12 },
    // Clasificación (liga)
    stHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderColor: c.hairStrong,
    },
    stRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderColor: c.hair,
    },
    stPos: {
      width: 22,
      fontFamily: Fonts.mono,
      fontSize: 12,
      fontWeight: '700',
      color: c.textFaint,
    },
    stName: { width: 150, color: c.text, fontSize: 13, fontWeight: '600', paddingRight: 8 },
    stCol: {
      width: 34,
      textAlign: 'center',
      fontFamily: Fonts.mono,
      fontSize: 12,
      color: c.textMuted,
      fontWeight: '600',
    },
    stColW: {
      width: 52,
      textAlign: 'center',
      fontFamily: Fonts.mono,
      fontSize: 12,
      color: c.textMuted,
      fontWeight: '600',
    },
    stPts: { color: c.accent, fontWeight: '800' },
    rrMatch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rrName: { color: c.textMuted, fontSize: 13, fontWeight: '500', paddingVertical: 3 },
    rrWin: { color: c.accent, fontWeight: '800' },
    rrScore: {
      fontFamily: Fonts.mono,
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      paddingVertical: 1,
    },
    rrPending: { color: c.accent, fontSize: 12, fontWeight: '700' },
    // Sheets
    sheetEyebrow: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, letterSpacing: 2, fontWeight: '500' },
    sheetTitle: { color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 16,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputField: { color: c.text, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
    },
    scoreName: { flex: 1, color: c.text, fontSize: 15, fontWeight: '600' },
    scoreInput: {
      width: 64,
      height: 52,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreInputField: {
      color: c.text,
      fontSize: 22,
      fontWeight: '800',
      fontFamily: Fonts.mono,
      textAlign: 'center',
      width: '100%',
    },
    scoreHint: { color: c.textMuted, fontSize: 12, marginTop: 16, lineHeight: 18 },
    setTeam: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
    setVs: { color: c.textFaint, fontSize: 12, fontFamily: Fonts.mono, marginVertical: 2 },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    setRowLabel: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1, color: c.textMuted, fontWeight: '600' },
    setInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    setInput: {
      width: 52,
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      color: c.text,
      fontSize: 20,
      fontWeight: '800',
      fontFamily: Fonts.mono,
      textAlign: 'center',
    },
    setSep: { color: c.textFaint, fontSize: 18, fontWeight: '700' },
    liveResult: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginTop: 18 },
    saveBtn: { height: 52, borderRadius: Radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  });
