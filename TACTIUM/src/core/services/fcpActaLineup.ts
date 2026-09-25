// Rellenar la ALINEACIÓN de una jornada con la que salió en el acta federativa.
//
// POR QUÉ. Las jornadas que llegan de la Federación traen rival, fecha y
// resultado, pero la alineación se quedaba vacía para siempre: el capitán veía
// «PENDIENTE» en una jornada de hace ocho meses, y las 5 parejas que de verdad
// jugaron estaban ahí al lado, en el acta. Nadie va a teclear a mano 19
// jornadas × 5 parejas para arreglar el histórico, así que se quedaba roto.
//
// Esto no inventa nada: el acta dice quién jugó en cada partido y en qué orden,
// que es exactamente lo que guarda `lineups` (`court_number` = `partido_num`).
//
// LO QUE NUNCA HACE es pisar una pareja que ya esté puesta. La alineación es
// del capitán; si él puso algo, manda él. Solo se rellenan las pistas vacías.
import { supabase } from '@core/supabase/client';
import * as LineupsApi from './lineups';
import * as LineupVariantsApi from './lineupVariants';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

/** Minúsculas, sin acentos, espacios colapsados. Mismo criterio que el resto
 *  del puente con la Federación. */
const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export interface ActaLineupResult {
  /** Parejas escritas (pistas que estaban vacías y ahora tienen su pareja). */
  pairs: number;
  /** Pistas que ya tenían pareja y no se han tocado. */
  kept: number;
  /** Nombres del acta que no están en la plantilla, sin repetir. Se quedan sin
   *  colocar: son jugadores que pasaron por el equipo y ya no están. */
  unresolved: string[];
}

/**
 * Índice «nombre del acta» → jugador de la plantilla.
 *
 * El acta escribe los nombres cortos, «NACHO QUINTANA», mientras la plantilla
 * guarda el nombre completo, «NACHO QUINTANA SAÑUDO». Hay dos caminos y los dos
 * hacen falta:
 *
 *  1. El VÍNCULO federativo (`fcp_player_links` → `fcp_jugadores`), que da el
 *     nombre exacto que usa el acta: «nombre_pila apellido1». Es el bueno, y
 *     con él se resuelven 178 de los 180 nombres de una temporada real.
 *  2. Por nombre, para los jugadores metidos a mano: vale que el nombre de la
 *     plantilla EMPIECE por el del acta.
 *
 * Si dos jugadores comparten nombre corto, esa clave se descarta en vez de
 * elegir a uno: preferimos dejar el hueco vacío a colocar al hermano.
 */
async function indicePorNombre(teamId: string): Promise<Map<string, string>> {
  const { data: playersRaw } = await rawFrom('players')
    .select('id, name')
    .eq('team_id', teamId);
  const players = ((playersRaw ?? []) as { id: string; name: string | null }[]).filter(
    (p) => !!p.name,
  );

  // Candidatos por clave; al final solo entran las claves con UN dueño.
  const candidatos = new Map<string, Set<string>>();
  const apunta = (clave: string, playerId: string) => {
    if (!clave) return;
    const s = candidatos.get(clave) ?? new Set<string>();
    s.add(playerId);
    candidatos.set(clave, s);
  };

  // 1) Por vínculo federativo.
  const { data: linksRaw } = await rawFrom('fcp_player_links')
    .select('player_id, fcp_id_jugador')
    .eq('team_id', teamId)
    .limit(500);
  const links = ((linksRaw ?? []) as {
    player_id: string | null;
    fcp_id_jugador: string | null;
  }[]).filter((l) => l.player_id && l.fcp_id_jugador);
  if (links.length > 0) {
    const { data: jugRaw } = await rawFrom('fcp_jugadores')
      .select('id_jugador, nombre_pila, apellido1')
      .in(
        'id_jugador',
        links.map((l) => l.fcp_id_jugador as string),
      );
    const porId = new Map(
      ((jugRaw ?? []) as {
        id_jugador: string;
        nombre_pila: string | null;
        apellido1: string | null;
      }[]).map((j) => [
        j.id_jugador,
        norm(`${(j.nombre_pila ?? '').trim()} ${(j.apellido1 ?? '').trim()}`),
      ]),
    );
    for (const l of links) {
      const clave = porId.get(l.fcp_id_jugador as string);
      if (clave) apunta(clave, l.player_id as string);
    }
  }

  // 2) Por nombre completo (el del acta es un prefijo del de la plantilla).
  //    Se guarda aparte y solo se usa si el vínculo no ha resuelto la clave:
  //    un prefijo es más débil que un vínculo y no debe competir con él.
  const porPrefijo = new Map<string, Set<string>>();
  for (const p of players) {
    const completo = norm(p.name);
    // Nombre + primer apellido, que es lo que escribe el acta.
    const corto = completo.split(' ').slice(0, 2).join(' ');
    if (corto && corto !== completo) {
      const s = porPrefijo.get(corto) ?? new Set<string>();
      s.add(p.id);
      porPrefijo.set(corto, s);
    }
    apunta(completo, p.id);
  }

  const out = new Map<string, string>();
  for (const [clave, duenos] of candidatos) {
    if (duenos.size === 1) out.set(clave, [...duenos][0]);
  }
  for (const [clave, duenos] of porPrefijo) {
    if (!out.has(clave) && duenos.size === 1) out.set(clave, [...duenos][0]);
  }
  return out;
}

/**
 * Vuelca la alineación del acta en una jornada.
 *
 * Devuelve `null` si esa jornada no tiene acta (no es federada, o la Federación
 * todavía no la ha publicado): no es un error, es que no hay nada que traer.
 */
export async function importLineupFromActa(
  matchdayId: string,
): Promise<ActaLineupResult | null> {
  const { data: mdRaw } = await rawFrom('matchdays')
    .select('id, season_id, fcp_id_partido')
    .eq('id', matchdayId)
    .maybeSingle();
  const md = mdRaw as { id: string; season_id: string; fcp_id_partido: string | null } | null;
  if (!md?.fcp_id_partido) return null;

  const { data: acta } = await rawFrom('fcp_actas')
    .select('partido_num, equipo_local, local_j1, local_j2, visit_j1, visit_j2')
    .eq('id_partido', md.fcp_id_partido)
    .order('partido_num', { ascending: true });
  const filas = (acta ?? []) as {
    partido_num: number | null;
    equipo_local: string | null;
    local_j1: string | null;
    local_j2: string | null;
    visit_j1: string | null;
    visit_j2: string | null;
  }[];
  if (filas.length === 0) return null;

  const { data: seasonRaw } = await rawFrom('seasons')
    .select('team_id')
    .eq('id', md.season_id)
    .maybeSingle();
  const teamId = (seasonRaw as { team_id: string } | null)?.team_id;
  if (!teamId) return null;
  const { data: teamRaw } = await rawFrom('teams')
    .select('name')
    .eq('id', teamId)
    .maybeSingle();
  const miNombre = norm((teamRaw as { name: string | null } | null)?.name);

  const indice = await indicePorNombre(teamId);

  // La variante activa es la «oficial», la que leen Jornada y Resultados. El
  // trigger `matchday_create_default_variant` garantiza que exista; si aún así
  // faltara, se crea antes de escribir.
  let variante = await LineupVariantsApi.fetchActiveVariant(matchdayId);
  if (!variante) variante = await LineupVariantsApi.createVariant(matchdayId, 'Variante 1');
  const yaPuestas = await LineupsApi.fetchLineup(variante.id);
  const ocupada = new Set(
    yaPuestas
      .filter((p) => p.player_a_id || p.player_b_id)
      .map((p) => p.court_number),
  );

  let pairs = 0;
  let kept = 0;
  const unresolved = new Set<string>();

  for (const fila of filas) {
    const court = fila.partido_num;
    if (court == null) continue;
    if (ocupada.has(court)) {
      kept++;
      continue;
    }

    // ¿Soy el local de ESTE acta? El acta lo dice por su nombre; no me fío de
    // `is_home` de la jornada, que en los playoffs fue durante un tiempo una
    // suposición y puede venir mal de antes.
    const soyLocal = miNombre
      ? norm(fila.equipo_local) === miNombre
      : true;
    const mios = soyLocal
      ? [fila.local_j1, fila.local_j2]
      : [fila.visit_j1, fila.visit_j2];

    const ids = mios.map((nombre) => {
      const clave = norm(nombre);
      if (!clave) return null;
      const id = indice.get(clave) ?? null;
      if (!id) unresolved.add((nombre ?? '').trim());
      return id;
    });
    if (!ids[0] && !ids[1]) continue; // nadie reconocible: se deja vacía

    await LineupsApi.setLineupPair(matchdayId, variante.id, court, ids[0], ids[1]);
    pairs++;
  }

  return { pairs, kept, unresolved: [...unresolved] };
}

export interface SeasonActaLineupResult {
  matchdays: number; // jornadas con alguna pareja nueva
  pairs: number;
  unresolved: string[];
}

/**
 * Lo mismo para TODA la temporada, que es como se usa de verdad: el histórico
 * llega de golpe al volcar la liga, no jornada a jornada.
 */
export async function importSeasonLineupsFromActas(
  seasonId: string,
): Promise<SeasonActaLineupResult> {
  const { data } = await rawFrom('matchdays')
    .select('id, jornada_number')
    .eq('season_id', seasonId)
    .not('fcp_id_partido', 'is', null)
    .order('jornada_number', { ascending: true });
  const ids = ((data ?? []) as { id: string }[]).map((m) => m.id);

  let matchdays = 0;
  let pairs = 0;
  const unresolved = new Set<string>();
  for (const id of ids) {
    // Una jornada que falle no puede tumbar el resto: el volcado es un favor,
    // no una transacción.
    try {
      const r = await importLineupFromActa(id);
      if (!r) continue;
      if (r.pairs > 0) {
        matchdays++;
        pairs += r.pairs;
      }
      for (const n of r.unresolved) unresolved.add(n);
    } catch {
      /* seguimos con la siguiente */
    }
  }
  return { matchdays, pairs, unresolved: [...unresolved] };
}
