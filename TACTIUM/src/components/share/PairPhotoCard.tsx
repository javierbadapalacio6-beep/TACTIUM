import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';

/**
 * Tarjeta de UNA pareja para compartir (carrusel de Instagram, WhatsApp…): la foto de la pareja, sus dos
 * nombres COMPLETOS (nunca con puntos suspensivos: si no caben, bajan de línea), el resultado y la victoria.
 * Lleva el logo de TACTIUM y, si lo hay, el del club. Formato 4:5, el de Instagram.
 */
export interface PairPhotoCardProps {
  photoUri: string;
  playerA: string;
  playerB: string;
  /** «P1» */
  courtLabel: string;
  /** «6-4 6-3» (sets de la pareja, nuestro lado primero). */
  summary: string;
  won: boolean | null;
  /** «Medio Cudeyo A vs Castro Urdiales A» */
  matchLine: string;
  /** «Jornada 1 · 24 oct» */
  subtitle?: string;
  clubLogoUri?: string | null;
}

export const PairPhotoCard = React.forwardRef<View, PairPhotoCardProps>(
  ({ photoUri, playerA, playerB, courtLabel, summary, won, matchLine, subtitle, clubLogoUri }, ref) => (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(4,10,8,0.55)', 'transparent']}
        style={styles.topVeil}
      />
      <LinearGradient
        colors={['transparent', 'rgba(4,10,8,0.7)', 'rgba(4,10,8,0.95)']}
        style={styles.veil}
      />
      {/* Marca arriba: TACTIUM + logo del club */}
      <View style={styles.brandRow}>
        <View style={styles.brand}>
          <TactiumMark size={20} gradient />
          <Text style={styles.brandName}>TACTIUM</Text>
        </View>
        {clubLogoUri ? <Image source={{ uri: clubLogoUri }} style={styles.clubLogo} /> : null}
      </View>

      <View style={styles.overlay}>
        {won != null ? (
          <View style={[styles.badge, { backgroundColor: won ? Colors.accent : 'rgba(255,255,255,0.18)' }]}>
            <Text style={[styles.badgeText, { color: won ? '#04110B' : '#FFFFFF' }]}>
              {won ? 'VICTORIA' : 'DERROTA'} · {courtLabel}
            </Text>
          </View>
        ) : null}
        <Text style={styles.name}>{playerA}</Text>
        <Text style={styles.name}>{playerB}</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        <Text style={styles.matchLine}>{matchLine}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.url}>tactium.io</Text>
      </View>
    </View>
  ),
);
PairPhotoCard.displayName = 'PairPhotoCard';

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 400,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  topVeil: { position: 'absolute', left: 0, right: 0, top: 0, height: 90 },
  veil: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 },
  brandRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandName: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  clubLogo: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF' },
  overlay: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  // Sin numberOfLines: el nombre entero siempre, bajando de línea si hace falta.
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, lineHeight: 26 },
  summary: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1,
  },
  matchLine: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600', marginTop: 6 },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  url: {
    fontFamily: Fonts.mono,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 8,
  },
});
