import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconCheck, IconX } from '@components/ui';
import {
  fetchPlayoffFamily,
  fetchFcpBracketFamily,
  fetchFcpBracketTieActa,
  isSameTeam,
  type FcpBracket,
  type FcpBracketTie,
  type FcpBracketTieActa,
} from '@core/services/fcpBracket';
import type { FcpActaPartido } from '@core/services/fcpSeason';

interface Props {
  idGrupo: string;
  highlightTeam?: string | null;
}

/** Cuadro de playoff en formato columnas-por-ronda (scroll horizontal). Reúne
 *  TODOS los trozos que la Federación publica por separado para una misma
 *  categoría —el cuadro grande y las eliminatorias de puestos (5º-8º, 3º-4º…)—
 *  en una sola vista con pestañas, en vez de obligar a saltar entre grupos. */
export const FcpBracketView: React.FC<Props> = ({ idGrupo, highlightTeam }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [bracket, setBracket] = useState<FcpBracket | null>(null);
  const [selCuadro, setSelCuadro] = useState(0);
  const [openTie, setOpenTie] = useState<FcpBracketTie | null>(null);
  const hScroll = useRef<ScrollView | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPlayoffFamily(idGrupo)
      .then((parts) => fetchFcpBracketFamily(parts))
      .then((b) => {
        if (!alive) return;
        setBracket(b);
        setSelCuadro(0);
      })
      .catch(() => alive && setBracket(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [idGrupo]);

  if (loading) return <ActivityIndicator color={c.accent} style={{ marginTop: 30 }} />;
  if (!bracket || bracket.cuadros.length === 0)
    return <Text style={styles.empty}>El cuadro aún no está disponible.</Text>;

  const cuadro = bracket.cuadros[selCuadro] ?? bracket.cuadros[0];

  // Recorrido del equipo: sus cruces ronda a ronda. Es lo que de verdad se
  // quiere saber de un cuadro ("de dónde vengo y contra quién voy"), y en un
  // móvil eso no se ve: caben dos columnas y el resto queda fuera de pantalla.
  const myPath = highlightTeam
    ? cuadro.rounds
        .map((r) => ({
          round: r,
          tie: r.ties.find(
            (t) => isSameTeam(t.local, highlightTeam) || isSameTeam(t.visit, highlightTeam),
          ),
        }))
        .filter((x): x is { round: (typeof cuadro.rounds)[number]; tie: FcpBracketTie } => !!x.tie)
    : [];

  return (
    <View>
      {/* Selector de cuadro (principal / consolación) */}
      {bracket.cuadros.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.seg}
        >
          {bracket.cuadros.map((q, i) => {
            const on = i === selCuadro;
            return (
              <Pressable key={q.key} onPress={() => setSelCuadro(i)} style={[styles.segBtn, on && styles.segBtnOn]}>
                <Text style={[styles.segText, on && styles.segTextOn]}>{q.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.cuadroTitle}>{cuadro.label}</Text>
      )}

      {highlightTeam && myPath.length > 0 ? (
        <View style={styles.pathBox}>
          <Text style={styles.pathTitle} numberOfLines={1}>
            RECORRIDO DE {highlightTeam.toUpperCase()}
          </Text>
          {myPath.map(({ round, tie }) => {
            const rival = isSameTeam(tie.local, highlightTeam) ? tie.visit : tie.local;
            const iAmLocal = isSameTeam(tie.local, highlightTeam);
            const won =
              (iAmLocal && tie.ganador === 'local') ||
              (!iAmLocal && tie.ganador === 'visitante');
            const lost = !!tie.ganador && tie.ganador !== 'empate' && !won;
            return (
              <Pressable
                key={`path-${tie.idPartido}`}
                onPress={() =>
                  tie.estado === 'jugado' || tie.estado === 'jugado_ida'
                    ? setOpenTie(tie)
                    : undefined
                }
                style={styles.pathRow}
              >
                <Text style={styles.pathRound} numberOfLines={1}>
                  {round.label}
                </Text>
                <Text style={styles.pathRival} numberOfLines={1}>
                  {rival || 'Por determinar'}
                </Text>
                <Text
                  style={[
                    styles.pathResult,
                    won && { color: c.accent },
                    lost && { color: c.textFaint },
                  ]}
                >
                  {tie.marcador
                    ? `${won ? 'Ganó' : lost ? 'Perdió' : ''} ${tie.marcador.replace('-', '–')}`.trim()
                    : 'pendiente'}
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.pathHint}>
            El marcador es de partidos ganados en la eliminatoria, sumando ida y
            vuelta. Toca un cruce para ver el acta.
          </Text>
        </View>
      ) : null}

      <ScrollView
        ref={hScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 4, paddingRight: 12 }}
        onLayout={() => {
          // Arranca en la ronda que se está jugando, no en la primera: con el
          // torneo avanzado, lo de la izquierda ya es historia.
          const i = cuadro.rounds.findIndex((r) =>
            r.ties.some((t) => t.estado !== 'jugado'),
          );
          if (i > 0) hScroll.current?.scrollTo({ x: i * (182 + 14), animated: false });
        }}
      >
        {cuadro.rounds.map((r) => (
          <View key={`${cuadro.key}-${r.avance}`} style={styles.col}>
            <Text style={styles.colHead} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={{ gap: 8 }}>
              {r.ties.map((t) => (
                <TieCard
                  key={t.idPartido}
                  c={c}
                  styles={styles}
                  tie={t}
                  highlightTeam={highlightTeam}
                  onPress={() => setOpenTie(t)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <TieActaModal tie={openTie} onClose={() => setOpenTie(null)} />
    </View>
  );
};

// ─── Tarjeta de un cruce ──────────────────────────────────────────────────────

const TieCard: React.FC<{
  c: Palette;
  styles: ReturnType<typeof makeStyles>;
  tie: FcpBracketTie;
  highlightTeam?: string | null;
  onPress: () => void;
}> = ({ c, styles, tie, highlightTeam, onPress }) => {
  const localWon = tie.ganador === 'local';
  const visitWon = tie.ganador === 'visitante';
  const hasActa = tie.estado === 'jugado' || tie.estado === 'jugado_ida';
  const mine =
    !!highlightTeam && (isSameTeam(tie.local, highlightTeam) || isSameTeam(tie.visit, highlightTeam));
  const pending = !tie.visit || !tie.local;

  return (
    <Pressable
      disabled={!hasActa}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tie,
        mine && styles.tieMine,
        pressed && hasActa && { opacity: 0.85 },
      ]}
    >
      <TeamLine c={c} styles={styles} name={tie.local} won={localWon} mine={isSameTeam(tie.local, highlightTeam)} />
      <View style={styles.tieDivider} />
      <TeamLine
        c={c}
        styles={styles}
        name={pending && !tie.visit ? 'Por determinar' : tie.visit}
        won={visitWon}
        mine={isSameTeam(tie.visit, highlightTeam)}
        muted={pending && !tie.visit}
      />
      <View style={styles.tieFoot}>
        <Text style={styles.tieResult}>
          {tie.marcador ? tie.marcador.replace('-', '–') : hasActa ? '—' : 'pend.'}
        </Text>
        {hasActa ? <Text style={styles.tieActaHint}>ver acta</Text> : null}
      </View>
      {tie.resultadoIda || tie.resultadoVuelta ? (
        <Text style={styles.tieLegs} numberOfLines={1}>
          {[
            tie.resultadoIda ? `ida ${tie.resultadoIda}` : null,
            tie.resultadoVuelta ? `vuelta ${tie.resultadoVuelta}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
    </Pressable>
  );
};

const TeamLine: React.FC<{
  c: Palette;
  styles: ReturnType<typeof makeStyles>;
  name: string | null;
  won: boolean;
  mine?: boolean;
  muted?: boolean;
}> = ({ c, styles, name, won, mine, muted }) => (
  <View style={styles.teamLine}>
    {won ? <IconCheck size={12} color={c.accent} /> : <View style={{ width: 12 }} />}
    <Text
      style={[styles.teamName, won && styles.teamWin, mine && styles.teamMine, muted && styles.teamMuted]}
      numberOfLines={1}
    >
      {name || '—'}
    </Text>
  </View>
);

// ─── Modal con el acta del cruce (ida + vuelta) ───────────────────────────────

const TieActaModal: React.FC<{
  tie: FcpBracketTie | null;
  onClose: () => void;
}> = ({ tie, onClose }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [loading, setLoading] = useState(false);
  const [acta, setActa] = useState<FcpBracketTieActa | null>(null);

  useEffect(() => {
    if (!tie) {
      setActa(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchFcpBracketTieActa(tie.idPartido)
      .then((a) => alive && setActa(a))
      .catch(() => alive && setActa(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tie]);

  return (
    <Modal visible={!!tie} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {tie?.local || '—'}
            </Text>
            <Text style={styles.sheetVs}>vs</Text>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {tie?.visit || 'Por determinar'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.sheetClose}>
            <IconX size={16} color={c.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={c.accent} style={{ marginTop: 24 }} />
          ) : !acta || (acta.ida.length === 0 && acta.vuelta.length === 0) ? (
            <Text style={styles.empty}>Acta no disponible todavía.</Text>
          ) : (
            <>
              <ActaLeg styles={styles} title="IDA" partidos={acta.ida} />
              <ActaLeg styles={styles} title="VUELTA" partidos={acta.vuelta} />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const ActaLeg: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  title: string;
  partidos: FcpActaPartido[];
}> = ({ styles, title, partidos }) => {
  if (partidos.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.legTitle}>{title}</Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        {partidos.map((g) => {
          const lWon = g.ganador === 'local';
          const vWon = g.ganador === 'visitante';
          return (
            <View key={g.partido_num} style={styles.actaRow}>
              <Text style={styles.actaNum}>{g.partido_num}</Text>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text style={[styles.actaPair, lWon && styles.actaWin]} numberOfLines={1}>
                  {[g.local_j1, g.local_j2].filter(Boolean).join(' / ') || '—'}
                </Text>
                <Text style={[styles.actaPair, vWon && styles.actaWin]} numberOfLines={1}>
                  {[g.visit_j1, g.visit_j2].filter(Boolean).join(' / ') || '—'}
                </Text>
              </View>
              <Text style={styles.actaScore}>
                {g.parciales || `${g.sets_local ?? 0}-${g.sets_visit ?? 0}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    empty: { color: c.textMuted, fontSize: 13.5, marginTop: 24, textAlign: 'center' },
    seg: {
      flexDirection: 'row',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: c.bgCard,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: c.hair,
      marginBottom: 14,
    },
    segBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center' },
    segBtnOn: { backgroundColor: c.accent },
    segText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    segTextOn: { color: c.textInverse },
    cuadroTitle: { color: c.text, fontSize: 15, fontWeight: '800', marginBottom: 12 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    legendDot: { width: 10, height: 10, borderRadius: 3, backgroundColor: c.accent },
    pathBox: {
      marginTop: 10,
      marginBottom: 6,
      padding: 12,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgRaised,
    },
    pathTitle: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 10.5,
      letterSpacing: 1.4,
      marginBottom: 8,
    },
    pathRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    pathRound: { color: c.textFaint, fontSize: 11.5, fontWeight: '700', width: 74 },
    pathRival: { color: c.text, fontSize: 13, fontWeight: '600', flex: 1, minWidth: 0 },
    pathResult: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
    pathHint: { color: c.textFaint, fontSize: 11, lineHeight: 15, marginTop: 8 },
    tieLegs: { color: c.textFaint, fontSize: 10.5, marginTop: 3 },
    legendText: { color: c.textMuted, fontSize: 11.5, fontWeight: '600', flex: 1, minWidth: 0 },
    col: { width: 182, marginRight: 14 },
    colHead: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.4,
      color: c.accent,
      fontWeight: '700',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    tie: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    tieMine: { borderColor: c.accent, backgroundColor: c.accent10 },
    tieDivider: { height: 1, backgroundColor: c.hair, marginVertical: 6 },
    teamLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    teamName: { flex: 1, minWidth: 0, color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    teamWin: { color: c.text, fontWeight: '800' },
    teamMine: { color: c.accent },
    teamMuted: { color: c.textFaint, fontStyle: 'italic' },
    tieFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 7,
    },
    tieResult: { fontFamily: Fonts.mono, color: c.text, fontSize: 13, fontWeight: '800' },
    tieActaHint: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 0.5 },
    // Modal
    backdrop: { flex: 1, backgroundColor: '#00000088' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '82%',
      backgroundColor: c.background,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.hairStrong,
      marginBottom: 12,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
    sheetTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    sheetVs: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginVertical: 1 },
    sheetClose: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legTitle: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '700',
    },
    actaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    actaNum: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '800',
      width: 16,
      textAlign: 'center',
    },
    actaPair: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    actaWin: { color: c.text, fontWeight: '800' },
    actaScore: { fontFamily: Fonts.mono, color: c.text, fontSize: 12, fontWeight: '700' },
  });
