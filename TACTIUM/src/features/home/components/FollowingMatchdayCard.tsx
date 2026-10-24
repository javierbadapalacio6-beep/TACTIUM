import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import type { Matchday } from '@core/services/matchdays';
import { formatMatchDate } from './OtherTeamsMatchdays';

interface Props {
  matchday: Matchday;
  onOpen: () => void;
}

/**
 * La jornada que viene DESPUÉS de la que está «pendiente del acta». Mientras
 * falta el acta de la última, el hero de Inicio sigue siendo esa, pero lo que
 * hay que preparar es esta: se enseña debajo, sin quitar nada.
 */
export const FollowingMatchdayCard: React.FC<Props> = ({ matchday, onOpen }) => {
  const c = useColors();
  const s = makeStyles(c);
  const fecha = matchday.match_date ? formatMatchDate(matchday.match_date) : null;
  const meta = [fecha, matchday.match_time?.slice(0, 5), matchday.location?.trim()]
    .filter(Boolean)
    .join(' · ');
  return (
    <View>
      <Text style={s.eyebrow}>PRÓXIMA JORNADA</Text>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Abrir la jornada ${matchday.jornada_number} contra ${matchday.opponent}`}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
      >
        <Text style={s.round}>J{String(matchday.jornada_number).padStart(2, '0')}</Text>
        <View style={s.body}>
          <Text style={s.title} numberOfLines={1}>
            <Text style={s.vs}>vs </Text>
            {matchday.opponent}
          </Text>
          {meta ? (
            <Text style={s.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2.4,
      color: c.accent,
      fontWeight: '500',
      marginTop: 18,
      marginBottom: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: c.bgCard,
    },
    round: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13, fontWeight: '700' },
    body: { flex: 1, gap: 3 },
    title: { color: c.text, fontSize: 17, fontWeight: '800' },
    vs: { color: c.textMuted, fontWeight: '600' },
    meta: { color: c.textMuted, fontSize: 12.5 },
    chevron: { color: c.textMuted, fontSize: 22, lineHeight: 22 },
  });
