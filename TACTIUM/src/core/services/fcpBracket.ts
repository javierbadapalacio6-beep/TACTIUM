// Cuadro (bracket) de un grupo de playoff de la Federación Cántabra.
// Lee las eliminatorias ya espejadas en fcp_partidos (tipo playoff): cada fila
// es UN cruce con equipos, resultado ida/vuelta, ganador y su posición en el
// cuadro (cuadro principal 'Final' vs consolación 'Consola', avance = ronda).
// OJO: en la FCP `avance` va al REVÉS → avance alto = primera ronda, avance 1 =
// final. Ver [[tactium_fcp_federation_integration]] y [[tactium_tournament_consolation_and_grid]].
import { supabase } from '@core/supabase/client';
import {
  fetchFcpActa,
  getFcpIdEquipo,
  resolveMainGroup,
  type FcpActaPartido,
} from './fcpSeason';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

export interface FcpBracketTie {
  idPartido: string;
  cuadro: string; // 'Final' | 'Consola'
  avance: number;
  posicion: number;
  ronda: string | null;
  local: string | null;
  visit: string | null;
  resultado: string | null; // agregado del scraper (poco fiable, no se muestra)
  resultadoIda: string | null;
  resultadoVuelta: string | null;
  // Marcador REAL de la eliminatoria = partidos ganados por cada equipo,
  // contados desde las actas (ida + vuelta, con los roles invertidos en la
  // vuelta). "local-visit". null si no hay actas. Es lo que se muestra.
  marcador: string | null;
  ganador: string | null; // 'local' | 'visitante' | 'empate' | null
  estado: string | null; // 'jugado' | 'jugado_ida' | 'pendiente'
}

export interface FcpBracketRound {
  avance: number;
  label: string;
  ties: FcpBracketTie[];
}

export interface FcpBracketCuadro {
  key: string; // 'Final' | 'Consola'
  label: string; // 'Cuadro principal' | 'Consolación'
  rounds: FcpBracketRound[];
}

export interface FcpBracket {
  cuadros: FcpBracketCuadro[];
}

// Nombres bonitos para el cuadro principal según profundidad (avance).
const PRINCIPAL_LABEL: Record<number, string> = {
  1: 'Final',
  2: 'Semifinal',
  3: 'Cuartos',
};

function roundLabel(cuadro: string, avance: number, ties: FcpBracketTie[]): string {
  if (cuadro === 'Final' && PRINCIPAL_LABEL[avance]) return PRINCIPAL_LABEL[avance];
  const r = ties.find((t) => t.ronda && t.ronda.trim())?.ronda;
  if (r) return r;
  return cuadro === 'Consola' ? `Consolación R${avance}` : `Ronda ${avance}`;
}

/** Cuadro completo de un grupo de playoff: cuadros (principal + consolación) →
 *  rondas (columnas, de primera ronda a final) → cruces. */
export async function fetchFcpBracket(idGrupo: string): Promise<FcpBracket> {
  const { data } = await rawFrom('fcp_partidos')
    .select(
      'id_partido, cuadro, avance, posicion_bracket, ronda, equipo_local, equipo_visit, resultado, resultado_ida, resultado_vuelta, ganador, estado',
    )
    .eq('id_grupo', idGrupo)
    .like('id_partido', 'fcp_playoff_%');

  // Marcador real (partidos ganados) por eliminatoria, desde las actas. En la
  // VUELTA los roles se invierten (el visitante de la eliminatoria juega de
  // local), así que un partido ganado por 'local' en la vuelta cuenta para el
  // visitante de la eliminatoria.
  const { data: actas } = await rawFrom('fcp_actas')
    .select('id_partido, ganador')
    .eq('id_grupo', idGrupo)
    .like('id_partido', 'fcp_playoff_%');
  const score = new Map<string, { l: number; v: number }>();
  for (const a of (actas ?? []) as { id_partido: string; ganador: string | null }[]) {
    const m = a.id_partido.match(/^(.*)_(ida|vuelta)$/);
    if (!m) continue;
    const tieId = m[1];
    const ida = m[2] === 'ida';
    const s = score.get(tieId) ?? { l: 0, v: 0 };
    if (a.ganador === 'local') ida ? s.l++ : s.v++;
    else if (a.ganador === 'visitante') ida ? s.v++ : s.l++;
    score.set(tieId, s);
  }

  const ties: FcpBracketTie[] = ((data ?? []) as any[]).map((r) => {
    const s = score.get(r.id_partido);
    return {
      idPartido: r.id_partido,
      cuadro: r.cuadro || 'Final',
      avance: r.avance ?? 0,
      posicion: r.posicion_bracket ?? 0,
      ronda: r.ronda ?? null,
      local: r.equipo_local ?? null,
      visit: r.equipo_visit ?? null,
      resultado: r.resultado ?? null,
      resultadoIda: r.resultado_ida ?? null,
      resultadoVuelta: r.resultado_vuelta ?? null,
      marcador: s && s.l + s.v > 0 ? `${s.l}-${s.v}` : null,
      ganador: r.ganador ?? null,
      estado: r.estado ?? null,
    };
  });

  const CUADRO_ORDER = ['Final', 'Consola'];
  const byCuadro = new Map<string, FcpBracketTie[]>();
  for (const t of ties) {
    if (!byCuadro.has(t.cuadro)) byCuadro.set(t.cuadro, []);
    byCuadro.get(t.cuadro)!.push(t);
  }

  const cuadros: FcpBracketCuadro[] = [...byCuadro.keys()]
    .sort((a, b) => {
      const ia = CUADRO_ORDER.indexOf(a);
      const ib = CUADRO_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map((key) => {
      const arr = byCuadro.get(key)!;
      const byAv = new Map<number, FcpBracketTie[]>();
      for (const t of arr) {
        if (!byAv.has(t.avance)) byAv.set(t.avance, []);
        byAv.get(t.avance)!.push(t);
      }
      const rounds: FcpBracketRound[] = [...byAv.entries()]
        .sort((a, b) => b[0] - a[0]) // avance DESC → primera ronda a la izquierda, final a la derecha
        .map(([avance, ts]) => ({
          avance,
          label: roundLabel(key, avance, ts),
          ties: ts.sort((x, y) => x.posicion - y.posicion),
        }));
      return {
        key,
        label: key === 'Consola' ? 'Consolación' : 'Cuadro principal',
        rounds,
      };
    });

  return { cuadros };
}

export interface FcpBracketTieActa {
  ida: FcpActaPartido[];
  vuelta: FcpActaPartido[];
}

/** Acta de un cruce de playoff: sus dos mangas (ida + vuelta), cada una con los
 *  N partidos (parejas + parciales). Alguna manga puede venir vacía. */
export async function fetchFcpBracketTieActa(tieId: string): Promise<FcpBracketTieActa> {
  const [ida, vuelta] = await Promise.all([
    fetchFcpActa(`${tieId}_ida`),
    fetchFcpActa(`${tieId}_vuelta`),
  ]);
  return { ida, vuelta };
}

const normTeam = (s: string | null | undefined) =>
  (s ?? '')
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export interface FcpTeamPlayoffGroup {
  idGrupo: string;
  nombre: string;
}

/** Grupos de playoff (fase) de una liga donde aparece un equipo (por nombre).
 *  Para abrir el cuadro desde la temporada del equipo con su recorrido resaltado.
 *  OJO: las eliminatorias solo guardan el NOMBRE del equipo, y hay colisiones de
 *  nombre entre masculino y femenino (p.ej. "MEDIO CUDEYO A"). Por eso filtramos
 *  por `genero` del grupo — sin ese filtro se mezclarían masc/fem. */
export async function fetchTeamPlayoffGroups(
  idLiga: number,
  teamName: string,
  genero?: string | null,
): Promise<FcpTeamPlayoffGroup[]> {
  const { data } = await rawFrom('fcp_partidos')
    .select('id_grupo, equipo_local, equipo_visit')
    .like('id_partido', `fcp_playoff_${idLiga}_%`);
  const tn = normTeam(teamName);
  const ids = new Set<string>();
  for (const r of (data ?? []) as {
    id_grupo: string;
    equipo_local: string | null;
    equipo_visit: string | null;
  }[]) {
    if (normTeam(r.equipo_local) === tn || normTeam(r.equipo_visit) === tn) ids.add(r.id_grupo);
  }
  if (ids.size === 0) return [];
  let q = rawFrom('fcp_grupos').select('id_grupo, nombre, genero').in('id_grupo', [...ids]);
  if (genero) q = q.eq('genero', genero);
  const { data: grupos } = await q;
  return ((grupos ?? []) as { id_grupo: string; nombre: string | null }[]).map((g) => ({
    idGrupo: g.id_grupo,
    nombre: g.nombre ?? g.id_grupo,
  }));
}

/** ¿Coincide un equipo del cuadro con el nombre resaltado? (normalizado) */
export function isSameTeam(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normTeam(a);
  const nb = normTeam(b);
  return !!na && na === nb;
}

export interface FcpTeamPlayoff {
  teamName: string;
  groups: FcpTeamPlayoffGroup[];
}

/** Cuadro(s) de playoff de un equipo TACTIUM (por su vínculo federativo).
 *  Devuelve null si el equipo no está vinculado o no tiene playoff. */
export async function fetchTeamPlayoff(teamId: string): Promise<FcpTeamPlayoff | null> {
  const fcpId = await getFcpIdEquipo(teamId);
  if (!fcpId) return null;
  const main = await resolveMainGroup(fcpId);
  if (!main) return null;
  const { data: g } = await rawFrom('fcp_grupos')
    .select('id_liga, genero')
    .eq('id_grupo', main.id_grupo)
    .maybeSingle();
  const idLiga = g ? (g as { id_liga: number }).id_liga : null;
  const genero = g ? (g as { genero: string | null }).genero : null;
  if (idLiga == null) return null;
  const groups = await fetchTeamPlayoffGroups(idLiga, main.equipo, genero);
  if (groups.length === 0) return null;
  return { teamName: main.equipo, groups };
}
