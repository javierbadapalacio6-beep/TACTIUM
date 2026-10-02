import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { formatShortDay, initialsOf } from '@core/utils/format';
import type { FcpStandingRow } from '@core/services/fcpSeason';

/**
 * Cabecera MARCADOR de la jornada: nuestro equipo · centro · rival.
 * El centro es la cuenta atrás mientras no se juega y el marcador grande
 * cuando ya hay resultado. Puesto y racha solo si la Federación los da.
 */
export interface JornadaScoreHeaderProps {
  jornadaNumber: number;
  date: Date | null;
  /** 'HH:MM' o '' */
  time: string;
  isHome: boolean;
  teamName: string;
  opponent: string;
  me: FcpStandingRow | null;
  rival: FcpStandingRow | null;
  /** Hay marcador que enseñar (jugada, en juego con pistas resueltas o cerrada). */
  hasResult: boolean;
  matchStarted: boolean;
  us: number;
  them: number;
  /** Color del estado (victoria/derrota/empate/en curso). */
  tint: string;
  statusLabel: string;
  /** Línea fina al pie: temporada, tandas… */
  footer?: string | null;
}

/** Cuenta atrás hasta el partido: «Hoy 16:00», «Mañana 16:00» o «2 d / 4 h». */
function countdown(
  target: Date,
  time: string,
  now: Date,
): { big: string; small: string } {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(target, now)) return { big: 'Hoy', small: time || 'Hora por confirmar' };
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const ms = target.getTime() - now.getTime();
  if (sameDay(target, tomorrow) && ms < 24 * 3_600_000) {
    return { big: 'Mañana', small: time || 'Hora por confirmar' };
  }
  const totalH = Math.max(0, Math.floor(ms / 3_600_000));
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  if (d === 0) return { big: `${h} h`, small: 'para el partido' };
  return { big: `${d} d / ${h} h`, small: 'para el partido' };
}

export const JornadaScoreHeader: React.FC<JornadaScoreHeaderProps> = ({
  jornadaNumber,
  date,
  time,
  isHome,
  teamName,
  opponent,
  me,
  rival,
  hasResult,
  matchStarted,
  us,
  them,
  tint,
  statusLabel,
  footer,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Refresco por minuto para que la cuenta atrás no se quede congelada.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (hasResult || matchStarted) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [hasResult, matchStarted]);

  const target = useMemo(() => {
    if (!date) return null;
    const t = new Date(date);
    const [hh, mm] = (time || '00:00').split(':').map((x) => Number(x) || 0);
    t.setHours(hh, mm, 0, 0);
    return t;
  }, [date, time]);

  const eyebrow = [
    `JORNADA ${String(jornadaNumber).padStart(2, '0')}`,
    date ? formatShortDay(date).toUpperCase() : 'FECHA POR CONFIRMAR',
    time || null,
    isHome ? 'LOCAL' : 'VISITANTE',
  ]
    .filter(Boolean)
    .join(' · ');

  let center: React.ReactNode;
  if (hasResult) {
    center = (
      <>
        <Text style={[styles.score, { color: tint }]} numberOfLines={1}>
          {us}–{them}
        </Text>
        <Text style={[styles.centerSmall, { color: tint }]}>
          {statusLabel.toUpperCase()}
        </Text>
      </>
    );
  } else if (matchStarted) {
    center = (
      <>
        <Text style={[styles.countBig, { color: c.warning }]}>En juego</Text>
        <Text style={styles.centerSmall}>SIN RESULTADOS AÚN</Text>
      </>
    );
  } else if (target) {
    const cd = countdown(target, time, now);
    center = (
      <>
        <Text style={styles.countBig} numberOfLines={1} adjustsFontSizeToFit>
          {cd.big}
        </Text>
        <Text style={styles.centerSmall}>{cd.small.toUpperCase()}</Text>
      </>
    );
  } else {
    center = (
      <>
        <Text style={[styles.countBig, { color: c.textFaint }]}>—</Text>
        <Text style={styles.centerSmall}>SIN FECHA</Text>
      </>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow} numberOfLines={2}>
        {eyebrow}
      </Text>
      <View style={styles.grid}>
        <TeamColumn name={teamName} row={me} mine />
        <View style={styles.center}>{center}</View>
        <TeamColumn name={opponent} row={rival} />
      </View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
};

const TeamColumn: React.FC<{
  name: string;
  row: FcpStandingRow | null;
  mine?: boolean;
}> = ({ name, row, mine }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const tone = mine ? c.accent : c.text;
  return (
    <View style={styles.team}>
      <View
        style={[
          styles.crest,
          {
            backgroundColor: mine ? c.accent10 : withAlpha(c.text, 0.06),
            borderColor: mine ? c.accent40 : c.hairStrong,
          },
        ]}
      >
        <Text style={[styles.crestText, { color: tone }]}>{initialsOf(name)}</Text>
      </View>
      <Text style={styles.teamName} numberOfLines={2}>
        {name}
      </Text>
      {row && row.form.length > 0 ? (
        <View style={styles.formRow}>
          {row.form.map((f, i) => (
            <View
              key={i}
              style={[
                styles.formDot,
                {
                  backgroundColor:
                    f === 'V' ? withAlpha(c.accent, 0.18) : withAlpha(c.error, 0.16),
                },
              ]}
            >
              <Text
                style={[styles.formDotText, { color: f === 'V' ? c.accent : c.error }]}
              >
                {f}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {row && row.posicion != null ? (
        <Text style={styles.position}>
          {row.posicion}º{row.puntos != null ? ` · ${row.puntos} pts` : ''}
        </Text>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginTop: 4,
      padding: 16,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.6,
      color: c.accent,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 14,
    },
    grid: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    team: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 6,
    },
    crest: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crestText: {
      fontFamily: Fonts.mono,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    teamName: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    formRow: { flexDirection: 'row', gap: 3 },
    formDot: {
      width: 15,
      height: 15,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formDotText: {
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      fontWeight: '700',
    },
    position: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      color: c.textMuted,
      letterSpacing: 0.3,
    },
    center: {
      width: 112,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 6,
      gap: 4,
    },
    score: {
      fontFamily: Fonts.mono,
      fontSize: 40,
      fontWeight: '700',
      letterSpacing: -1,
      lineHeight: 44,
    },
    countBig: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.6,
      textAlign: 'center',
    },
    centerSmall: {
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1.2,
      color: c.textFaint,
      textAlign: 'center',
    },
    footer: {
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 0.6,
      color: c.textFaint,
      textAlign: 'center',
    },
  });
