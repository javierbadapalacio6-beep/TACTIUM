import { longDate } from '@core/services/availabilityLink';
import { describeTandasShort, isValidTandas, pairsFor } from '@core/utils/tandas';
import type { ClubHomeMatch } from '@core/services/clubSchedule';

/**
 * Mensaje de WhatsApp con los horarios de LOCAL de una jornada del club: para pasárselo, de una vez, a los
 * equipos que aún no usan la app (los invitados, sobre todo) en lugar de escribirlo a mano. Una línea por
 * partido: hora, equipo local contra visitante, tandas y sede, agrupado por día.
 */
export function clubScheduleShareText(o: {
  clubName: string | null;
  jornada: number | null;
  /** «30 Oct - 1 Nov» de la Federación, si la hay. */
  range?: string | null;
  matches: ClubHomeMatch[];
  tandasByMatch: Record<string, string>;
  genderByTeam: Record<string, string | null | undefined>;
}): string {
  const withTime = o.matches
    .filter((m) => m.match_date && m.match_time && !m.home_unconfirmed)
    .sort((a, b) => `${a.match_date} ${a.match_time}`.localeCompare(`${b.match_date} ${b.match_time}`));
  const without = o.matches.filter((m) => !m.match_date || !m.match_time || m.home_unconfirmed);

  const lines: string[] = [];
  lines.push(`🎾 *HORARIOS DE LOCAL${o.clubName ? ` · ${o.clubName.toUpperCase()}` : ''}*`);
  const head = [o.jornada != null ? `Jornada ${o.jornada}` : null, o.range?.trim() || null]
    .filter(Boolean)
    .join(' · ');
  if (head) lines.push(head);

  let day: string | null = null;
  for (const m of withTime) {
    if (m.match_date !== day) {
      day = m.match_date;
      const d = longDate(day);
      lines.push('', `📅 *${d ? d.charAt(0).toUpperCase() + d.slice(1) : day}*`);
    }
    const time = (m.match_time ?? '').slice(0, 5);
    lines.push(`⏰ ${time} · ${m.team_name} vs ${m.opponent ?? 'rival por confirmar'}`);
    const tandas = o.tandasByMatch[m.matchday_id];
    const gender = o.genderByTeam[m.team_id] ?? null;
    if (tandas) {
      const valid = isValidTandas(tandas, pairsFor(gender));
      const short = valid ? describeTandasShort(tandas, gender, time) : '';
      lines.push(`   Tandas: ${short || tandas}`);
    }
    if (m.location?.trim()) lines.push(`   📍 ${m.location.trim()}`);
  }

  if (without.length > 0) {
    lines.push('', '⏳ *Pendientes de hora*');
    for (const m of without) lines.push(`• ${m.team_name} vs ${m.opponent ?? 'rival por confirmar'}`);
  }

  lines.push('', 'Horarios hechos con TACTIUM · tactium.io');
  return lines.join('\n');
}
