import { supabase } from '@core/supabase/client';

/**
 * Enlace público de disponibilidad (tactium.io/d/TOKEN): el capitán lo pega en
 * el grupo de WhatsApp y cada jugador responde Voy / Duda / No desde el
 * navegador, sin app ni cuenta. Gratis para todo capitán.
 *
 * Un enlace por jornada; `rotate` invalida el anterior (por si se ha filtrado).
 * RPC en supabase/migrations/20261010_availability_public_link.sql.
 *
 * Espejo en la web: tactium-web/lib/availability-text.ts (si cambia el texto,
 * cambiar los dos).
 */

export const availabilityUrl = (token: string): string => `https://tactium.io/d/${token}`;

export async function createAvailabilityLink(matchdayId: string): Promise<string> {
  const { data, error } = await supabase.rpc('availability_link_create' as never, {
    p_matchday_id: matchdayId,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function rotateAvailabilityLink(matchdayId: string): Promise<string> {
  const { data, error } = await supabase.rpc('availability_link_rotate' as never, {
    p_matchday_id: matchdayId,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** «domingo 3 de mayo» desde un `YYYY-MM-DD` (a mano: no depende de Intl en Hermes). */
export function longDate(d: string | null | undefined): string | null {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return null;
  return `${DIAS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

/** «23 - 25 Oct» (rango de la Federación) → «23-25 oct». */
function rangoCorto(r: string | null | undefined): string {
  return (r ?? '').trim().replace(/\s*-\s*/g, '-').replace(/[A-Za-zÁÉÍÓÚáéíóú]+/g, (w) => w.toLowerCase());
}

export function availabilityShareText(o: {
  opponent: string;
  jornada: number | null;
  date: string | null;
  time: string | null;
  isHome: boolean | null;
  token: string;
  /** Fin de semana de la Federación («23 - 25 Oct») mientras no hay fecha exacta. */
  range?: string | null;
}): string {
  const fecha = longDate(o.date);
  const hora = o.time ? o.time.slice(0, 5) : null;
  const lines: (string | null)[] = [
    `🎾 ¿Puedes jugar${o.jornada != null ? ` la jornada ${o.jornada}` : ' la próxima jornada'}?`,
    `🆚 ${o.opponent}`,
    fecha
      ? `📅 ${fecha}${hora ? ` · ${hora}` : ''}`
      : o.range
        ? `📅 ${rangoCorto(o.range)} (día y hora por confirmar)`
        : null,
    o.isHome == null ? null : o.isHome ? '🏠 En casa' : '🚗 Fuera',
    '',
    'Dime si vas con un toque, sin app 👇',
    availabilityUrl(o.token),
  ];
  return lines.filter((l) => l !== null).join('\n');
}
