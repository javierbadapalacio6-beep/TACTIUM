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
  setMatchResult,
  formatConfig,
  type Tournament,
  type TournamentRegistration,
  type TournamentMatch,
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

  const totalRounds = matches.reduce((m, x) => Math.max(m, x.round), 0);
  const hasBracket = matches.length > 0;

  const champion = useMemo(() => {
    if (t?.status !== 'finished') return null;
    const final = matches.find((m) => m.round === totalRounds && m.slot === 0);
    return final?.winner_reg ?? null;
  }, [t, matches, totalRounds]);

  const onGenerate = () => {
    if (!t) return;
    Alert.alert(
      'Generar el cuadro',
      `Se cerrará la inscripción y se creará el cuadro con ${regs.length} parejas (siembra por puntos). No podrás añadir más parejas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: async () => {
            setGenerating(true);
            try {
              await generateKoBracket(t, regs);
              await load();
            } catch (e: any) {
              toast.error('No se pudo generar', e?.message ?? '');
            } finally {
              setGenerating(false);
            }
          },
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
                  INSCRITOS · {regs.length}
                  {t?.max_pairs ? `/${t.max_pairs}` : ''}
                </Text>
                <Pressable onPress={() => setAdding(true)} hitSlop={8}>
                  <Text style={styles.addLink}>+ Añadir pareja</Text>
                </Pressable>
              </View>

              {regs.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aún no hay parejas. Añádelas a mano o comparte el código.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {regs.map((r, i) => (
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
                disabled={regs.length < 2 || generating}
                style={({ pressed }) => [
                  styles.generateBtn,
                  (regs.length < 2 || generating) && { opacity: 0.4 },
                  pressed && { opacity: 0.9 },
                ]}
              >
                {generating ? (
                  <ActivityIndicator size="small" color={c.textInverse} />
                ) : (
                  <Text style={styles.generateLabel}>
                    Cerrar inscripción y generar cuadro
                  </Text>
                )}
              </Pressable>
              {regs.length < 2 ? (
                <Text style={styles.genHint}>Hacen falta al menos 2 parejas.</Text>
              ) : null}
            </View>
          ) : (
            /* Cuadro */
            <View>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
                CUADRO
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bracket}
              >
                {Array.from({ length: totalRounds }, (_, r) => r + 1).map((round) => {
                  const col = matches
                    .filter((m) => m.round === round && m.bracket === 'main')
                    .sort((a, b) => a.slot - b.slot);
                  return (
                    <View key={round} style={styles.roundCol}>
                      <Text style={styles.roundLabel}>
                        {roundLabel(round, totalRounds)}
                      </Text>
                      <View style={styles.roundColInner}>
                        {col.map((m) => {
                          const playable = !!m.home_reg && !!m.away_reg;
                          const homeWin = m.winner_reg && m.winner_reg === m.home_reg;
                          const awayWin = m.winner_reg && m.winner_reg === m.away_reg;
                          return (
                            <Pressable
                              key={m.id}
                              disabled={!playable}
                              onPress={() => setEditMatch(m)}
                              style={({ pressed }) => [
                                styles.matchCard,
                                pressed && playable && { opacity: 0.85 },
                              ]}
                            >
                              <MatchSide
                                styles={styles}
                                name={regName(m.home_reg)}
                                score={m.home_score}
                                win={!!homeWin}
                              />
                              <View style={styles.matchDivider} />
                              <MatchSide
                                styles={styles}
                                name={regName(m.away_reg)}
                                score={m.away_score}
                                win={!!awayWin}
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <Text style={styles.bracketHint}>
                Toca un partido con las dos parejas para meter el resultado.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <AddPairSheet
        open={adding}
        tournamentId={tournamentId}
        onClose={() => setAdding(false)}
        onAdded={load}
      />

      <ResultSheet
        match={editMatch}
        matchFormat={t?.match_format ?? 'bo3_stb'}
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

const AddPairSheet: React.FC<{
  open: boolean;
  tournamentId: string;
  onClose: () => void;
  onAdded: () => void;
}> = ({ open, tournamentId, onClose, onAdded }) => {
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
  homeName: string;
  awayName: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ match, matchFormat, homeName, awayName, onClose, onSaved }) => {
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
      await setMatchResult(match, sets, cfg.setsToWin);
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
    matchCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    matchSide: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
    matchName: { flex: 1, color: c.textMuted, fontSize: 12, fontWeight: '500' },
    matchNameWin: { color: c.accent, fontWeight: '800' },
    matchScore: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', color: c.text, minWidth: 16, textAlign: 'right' },
    matchDivider: { height: 1, backgroundColor: c.hair },
    bracketHint: { color: c.textFaint, fontSize: 12, paddingHorizontal: 22, marginTop: 12 },
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
