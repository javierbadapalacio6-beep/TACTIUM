import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconCheck, IconX, IconCalendar } from '@components/ui/Icon';
import { TactiumMark } from '@components/brand/TactiumMark';

// ─────────────────────────────────────────────────────────────────────
// Tarjeta de resultado de partido (formato compartible). Dos variantes:
//   · 'league'     → partido de LIGA (equipo vs equipo, 5 pistas, jornada)
//   · 'individual' → AMISTOSO / ENTRENO / TORNEO (pareja vs pareja, sets, nivel)
// Paleta: bg #030F0F · card #0C2222 · accent #00DF82 · perdido #FF6B6B.
// ─────────────────────────────────────────────────────────────────────

const WIN = Colors.accent;
const LOSS = Colors.error;

export type MatchCourt = { pair: string; score: string; opp: string; won: boolean };

export type LeagueMatch = {
  variant: 'league';
  jornada: string; // "JORNADA 7"
  home: string;
  away: string;
  clubLogo?: string | null;
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
  date: string;
  courts: MatchCourt[];
};

export type IndividualMatch = {
  variant: 'individual';
  tag: string; // "AMISTOSO" | "ENTRENO" | "TORNEO"
  clubLogo?: string | null;
  pair: string; // nuestra pareja
  opp: string; // pareja rival
  sets: string; // "6-4 6-3"
  won: boolean;
  date: string;
  levelFrom?: string;
  levelTo?: string;
};

export type MatchCardData = LeagueMatch | IndividualMatch;

export const EXAMPLE_MATCH: LeagueMatch = {
  variant: 'league',
  jornada: 'JORNADA 7',
  home: 'CD Tactium',
  away: 'Padel Río',
  clubLogo: null,
  scoreFor: 3,
  scoreAgainst: 2,
  won: true,
  date: '25 de mayo de 2025',
  courts: [
    { pair: 'M. García / A. López', score: '6-4 6-3', opp: 'J. Pérez / D. Morales', won: true },
    { pair: 'P. Ruiz / J. Sánchez', score: '4-6 6-7', opp: 'F. Castillo / R. Ortega', won: false },
    { pair: 'L. Martín / I. Navarro', score: '6-4 6-2', opp: 'M. Vega / A. Salas', won: true },
    { pair: 'R. Díaz / S. Romero', score: '3-6 6-2 6-4', opp: 'I. Méndez / B. Gil', won: true },
    { pair: 'A. Torres / C. Vega', score: '2-6 3-6', opp: 'E. Noguera / P. Marín', won: false },
  ],
};

export const EXAMPLE_INDIVIDUAL: IndividualMatch = {
  variant: 'individual',
  tag: 'AMISTOSO',
  clubLogo: null,
  pair: 'Bada / Marco',
  opp: 'Ruiz / Sanz',
  sets: '6-4 6-3',
  won: true,
  date: '25 de mayo de 2025',
  levelFrom: '3.25',
  levelTo: '3.50',
};

// Escudo del club: logo si lo hay; si no, iniciales.
const ClubCrest: React.FC<{ name: string; logo?: string | null }> = ({ name, logo }) => {
  if (logo) return <Image source={{ uri: logo }} style={styles.crestImg} />;
  const initials = name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <View style={styles.crest}>
      <Text style={styles.crestTxt}>{initials}</Text>
    </View>
  );
};

const ResultBadge: React.FC<{ won: boolean }> = ({ won }) => (
  <View style={styles.badgeWrap}>
    <View style={[styles.badge, { borderColor: (won ? WIN : LOSS) + '66', backgroundColor: (won ? WIN : LOSS) + '1F' }]}>
      {won ? <IconCheck size={13} color={WIN} /> : <IconX size={12} color={LOSS} />}
      <Text style={[styles.badgeTxt, { color: won ? WIN : LOSS }]}>
        {won ? 'GANADO' : 'PERDIDO'}
      </Text>
    </View>
  </View>
);

const DateRow: React.FC<{ date: string }> = ({ date }) => (
  <View style={styles.dateRow}>
    <IconCalendar size={14} color={Colors.textFaint} />
    <Text style={styles.date}>{date}</Text>
  </View>
);

const CourtRow: React.FC<{ court: MatchCourt; index: number }> = ({ court, index }) => (
  <View style={[styles.row, court.won && styles.rowWon]}>
    <Text style={styles.rowPista}>P{index + 1}</Text>
    <Text style={styles.rowPair} numberOfLines={1}>{court.pair}</Text>
    <Text style={styles.rowScore}>{court.score}</Text>
    <Text style={styles.rowOpp} numberOfLines={1}>{court.opp}</Text>
    <View style={styles.rowMark}>
      {court.won ? <IconCheck size={14} color={WIN} /> : <IconX size={12} color={LOSS} />}
    </View>
  </View>
);

export const MatchCard: React.FC<{ data?: MatchCardData }> = ({ data = EXAMPLE_MATCH }) => {
  return (
    <View style={styles.card}>
      {/* Cabecera: escudo del club (liga) + logo TACTIUM */}
      <View style={styles.topRow}>
        {data.variant === 'league' ? (
          <ClubCrest name={data.home} logo={data.clubLogo} />
        ) : (
          <View style={styles.spacer} />
        )}
        <TactiumMark size={40} gradient />
      </View>

      {/* Etiqueta: jornada (liga) o tipo (amistoso/entreno…) */}
      <View style={styles.jornadaRow}>
        <View style={styles.hair} />
        <Text style={styles.jornada}>
          {data.variant === 'league' ? data.jornada : data.tag}
        </Text>
        <View style={styles.hair} />
      </View>

      {data.variant === 'league' ? (
        <>
          {/* Marcador equipo */}
          <View style={styles.scoreRow}>
            <Text style={[styles.teamName, styles.teamHome]} numberOfLines={1}>{data.home}</Text>
            <Text style={styles.bigScore}>
              {data.scoreFor} <Text style={styles.dash}>—</Text> {data.scoreAgainst}
            </Text>
            <Text style={[styles.teamName, styles.teamAway]} numberOfLines={1}>{data.away}</Text>
          </View>
          <ResultBadge won={data.won} />
          <View style={styles.courts}>
            {data.courts.map((c, i) => (
              <CourtRow key={i} court={c} index={i} />
            ))}
          </View>
          <DateRow date={data.date} />
        </>
      ) : (
        <>
          {/* Partido individual: pareja vs pareja */}
          <View style={styles.indivMatch}>
            <Text style={styles.indivPair} numberOfLines={1}>{data.pair}</Text>
            <Text style={styles.indivVs}>vs</Text>
            <Text style={styles.indivOpp} numberOfLines={1}>{data.opp}</Text>
          </View>
          <Text style={styles.indivSets}>{data.sets}</Text>
          <ResultBadge won={data.won} />
          {data.levelFrom && data.levelTo ? (
            <View style={styles.levelWrap}>
              <View style={styles.levelChip}>
                <Text style={styles.levelTxt}>
                  Nivel {data.levelFrom} → <Text style={{ color: WIN }}>{data.levelTo} ▲</Text>
                </Text>
              </View>
            </View>
          ) : null}
          <DateRow date={data.date} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.accent + '3A',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    overflow: 'hidden',
    shadowColor: Colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  spacer: { width: 40, height: 40 },
  crest: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestImg: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: Colors.hairStrong },
  crestTxt: { color: Colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  jornadaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 18 },
  hair: { height: 1, width: 28, backgroundColor: Colors.hairStrong },
  jornada: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: Colors.textMuted },

  // league
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, gap: 8 },
  teamName: { fontSize: 16, fontWeight: '700', flex: 1 },
  teamHome: { color: Colors.accent, textAlign: 'left' },
  teamAway: { color: Colors.text, textAlign: 'right' },
  bigScore: { color: Colors.text, fontSize: 30, fontWeight: '800', letterSpacing: 1 },
  dash: { color: Colors.textFaint, fontWeight: '400' },
  courts: { marginTop: 20, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  rowWon: { backgroundColor: Colors.accent10 },
  rowPista: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.accent, width: 20 },
  rowPair: { color: Colors.text, fontSize: 11, flex: 1 },
  rowScore: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textMuted, width: 74, textAlign: 'center' },
  rowOpp: { color: Colors.textFaint, fontSize: 11, flex: 1, textAlign: 'right' },
  rowMark: { width: 16, alignItems: 'center' },

  // individual
  indivMatch: { alignItems: 'center', marginTop: 18, gap: 4 },
  indivPair: { color: Colors.accent, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  indivVs: { color: Colors.textFaint, fontSize: 13, fontWeight: '600' },
  indivOpp: { color: Colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  indivSets: { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 14 },
  levelWrap: { alignItems: 'center', marginTop: 14 },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  levelTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },

  // shared
  badgeWrap: { alignItems: 'center', marginTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  badgeTxt: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  date: { color: Colors.textFaint, fontSize: 12, fontFamily: Fonts.mono, letterSpacing: 0.5 },
});
