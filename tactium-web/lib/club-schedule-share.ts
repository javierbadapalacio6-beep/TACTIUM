import { longDate } from "@/lib/availability-text";
import { describeTandasShort, isValidTandas, pairsFor } from "@/lib/tandas";

/**
 * Mensaje de WhatsApp con los horarios de LOCAL de una jornada del club (réplica de la app,
 * `TACTIUM/src/core/services/clubScheduleShare.ts`): para pasárselo de una vez a los equipos que aún no usan la
 * app (los invitados, sobre todo). Una línea por partido, agrupado por día: hora, local contra visitante,
 * tandas y sede.
 */
export interface ShareFixture {
  team_name: string;
  opponent: string | null;
  match_date: string | null;
  match_time: string | null;
  location: string | null;
  tandas?: string | null;
  gender?: string | null;
  unconfirmed?: boolean;
}

export function clubScheduleShareText(o: {
  clubName: string | null;
  jornada: number | null;
  range?: string | null;
  fixtures: ShareFixture[];
}): string {
  const withTime = o.fixtures
    .filter((m) => m.match_date && m.match_time && !m.unconfirmed)
    .sort((a, b) => `${a.match_date} ${a.match_time}`.localeCompare(`${b.match_date} ${b.match_time}`));
  const without = o.fixtures.filter((m) => !m.match_date || !m.match_time || m.unconfirmed);

  const lines: string[] = [];
  lines.push(`🎾 *HORARIOS DE LOCAL${o.clubName ? ` · ${o.clubName.toUpperCase()}` : ""}*`);
  const head = [o.jornada != null ? `Jornada ${o.jornada}` : null, o.range?.trim() || null].filter(Boolean).join(" · ");
  if (head) lines.push(head);

  let day: string | null = null;
  for (const m of withTime) {
    if (m.match_date !== day) {
      day = m.match_date;
      const d = longDate(day);
      lines.push("", `📅 *${d ? d.charAt(0).toUpperCase() + d.slice(1) : day}*`);
    }
    const time = (m.match_time ?? "").slice(0, 5);
    lines.push(`⏰ ${time} · ${m.team_name} vs ${m.opponent ?? "rival por confirmar"}`);
    if (m.tandas) {
      const short = isValidTandas(m.tandas, pairsFor(m.gender)) ? describeTandasShort(m.tandas, m.gender, time) : "";
      lines.push(`   Tandas: ${short || m.tandas}`);
    }
    if (m.location?.trim()) lines.push(`   📍 ${m.location.trim()}`);
  }

  if (without.length > 0) {
    lines.push("", "⏳ *Pendientes de hora*");
    for (const m of without) lines.push(`• ${m.team_name} vs ${m.opponent ?? "rival por confirmar"}`);
  }

  lines.push("", "Horarios hechos con TACTIUM · tactium.io");
  return lines.join("\n");
}
