import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import type * as MatchdaysApi from '@core/services/matchdays';
import type * as SeasonsApi from '@core/services/seasons';
import type * as LineupsApi from '@core/services/lineups';
import { DOWNLOAD_URL } from '@core/config/referral';

// Tarjeta de alineación pensada para COMPARTIR como imagen por WhatsApp:
// marca TACTIUM + QR de descarga. Cada alineación compartida es un anuncio
// perfectamente segmentado (loop viral del plan de escalado).
//
// Se renderiza como preview dentro del ShareLineupSheet y se captura con
// react-native-view-shot cuando el binario lo incluye (fallback: texto).

// El QR lleva a la DESCARGA directa; 'tactium.io' queda como texto de
// marca en el pie de la tarjeta.
const APP_URL = DOWNLOAD_URL;

interface Props {
  teamName: string;
  matchday: MatchdaysApi.Matchday;
  season: SeasonsApi.Season | null;
  pairs: LineupsApi.LineupPair[];
  /** Fecha corta ya formateada (evita duplicar helpers de pantalla). */
  shortDate: string;
  time?: string;
}

export const LineupShareCard: React.FC<Props> = ({
  teamName,
  matchday,
  season,
  pairs,
  shortDate,
  time,
}) => {
  const sorted = [...pairs].sort(
    (a, b) => (a.court_number ?? 0) - (b.court_number ?? 0),
  );

  return (
    <View style={styles.card}>
      {/* Header de marca */}
      <View style={styles.brandRow}>
        <TactiumMark size={26} gradient />
        <Text style={styles.brandName}>TACTIUM</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.jChip}>
          <Text style={styles.jChipText}>
            J·{String(matchday.jornada_number).padStart(2, '0')}
          </Text>
        </View>
      </View>

      {/* Enfrentamiento */}
      <Text style={styles.teamName} numberOfLines={1}>
        {teamName}
      </Text>
      <Text style={styles.vsLine} numberOfLines={1}>
        {matchday.is_home ? 'Local' : 'Visitante'} · vs. {matchday.opponent}
      </Text>
      <Text style={styles.metaLine} numberOfLines={1}>
        {shortDate}
        {time ? ` · ${time}` : ''}
        {season ? ` · ${season.name}` : ''}
      </Text>

      {/* Parejas */}
      <View style={styles.pairs}>
        {sorted.map((p) => (
          <View key={p.court_number} style={styles.pairRow}>
            <View style={styles.courtChip}>
              <Text style={styles.courtChipText}>P{p.court_number}</Text>
            </View>
            <Text style={styles.pairNames} numberOfLines={1}>
              {p.player_a_name ?? '—'} / {p.player_b_name ?? '—'}
            </Text>
            {p.pair_points != null ? (
              <Text style={styles.pairPts}>{p.pair_points} pts</Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* Footer con QR de descarga */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerTitle}>La app del capitán de pádel</Text>
          <Text style={styles.footerUrl}>tactium.io</Text>
        </View>
        <View style={styles.qrWrap}>
          <QRCode
            value={APP_URL}
            size={52}
            color="#0B0F14"
            backgroundColor="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  brandName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  jChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.accent15,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  jChipText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  teamName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  vsLine: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  metaLine: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  pairs: {
    marginTop: 14,
    gap: 6,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  courtChip: {
    width: 30,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.accent15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtChipText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  pairNames: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pairPts: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.hair,
  },
  footerTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  footerUrl: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  qrWrap: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
});
