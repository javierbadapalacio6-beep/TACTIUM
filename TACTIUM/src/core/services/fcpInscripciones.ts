// Equipos del club apuntados a la liga de la Federación que TODAVÍA no ha
// empezado. Ver la migración `20260914_fcp_inscripciones` y el modo
// `--inscripciones` del agente.
//
// Esto no es la temporada en curso ni la sustituye: es la lista de inscripción
// del año que viene, que la FCP publica meses antes de que exista calendario.
// Para el gestor de un club son dos preguntas: ¿están todos mis equipos
// apuntados y confirmados?, y ¿en qué categoría han quedado?
import { supabase } from '@core/supabase/client';
import { catShort } from './fcpSearch';
import { fetchCurrentLiga, seasonLabel } from './fcpBrowse';

type AnyFrom = (table: string) => any;
const rawFrom = supabase.from.bind(supabase) as unknown as AnyFrom;

const norm = (s: string | null | undefined) =>
  (s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Mismo criterio que el alta de clubes: quita patrocinador y letra de equipo
// para quedarse con el nombre del club. Ver `clubOf` en [[fcpOnboarding]].
const clubOf = (equipo: string): string => {
  let s = equipo.trim().replace(/\s+/g, ' ');
  s = s.replace(/\s*[-–]\s*[^-–]+$/, '').trim() || s;
  s = s.replace(/\s+(G[º°]\.?|GRUPO)\s+.+$/i, '').trim() || s;
  s = s.replace(/[\s\-–]+$/, '').trim() || equipo.trim();
  s = s.replace(/\s+(MASCULINO|FEMENINO)?\s*([A-ZÑ]|\d{1,2}|I{2,3}|IV|VI{0,3}|IX|XI{0,2})$/i, '').trim();
  return s || equipo.trim();
};

export interface FcpInscripcion {
  equipo: string;
  genero: 'M' | 'F' | null;
  categoria: string | null; // "1ª"
  confirmado: boolean;
  /** Ese equipo ya existe en el club dentro de TACTIUM. */
  enTactium: boolean;
  /** Su categoría en la temporada en curso, si la sabemos. Sirve para ver de un
   *  vistazo quién sube y quién baja. */
  categoriaActual: string | null;
}

export interface FcpInscripcionesResumen {
  temporada: string; // "2026/2027"
  total: number;
  confirmados: number;
  rows: FcpInscripcion[];
}

export interface TeamLite {
  name: string;
  gender: string | null;
  category: string | null;
}

/**
 * Inscripciones de la temporada siguiente para los equipos de un club.
 *
 * Se cruza por NOMBRE, no por id: el `id_equipo` de la Federación cambia cada
 * temporada, así que el vínculo que tenemos guardado (`fcp_team_links`) apunta a
 * la liga en curso y no sirve para encontrar al mismo equipo en la siguiente.
 *
 * Devuelve null si no hay liga en inscripción o si el club no tiene equipos
 * federados: así la pantalla no pinta nada el resto del año.
 */
export async function fetchClubInscripciones(
  teams: TeamLite[],
): Promise<FcpInscripcionesResumen | null> {
  const conNombre = teams.filter((t) => (t.name ?? '').trim());
  if (conNombre.length === 0) return null;

  // Solo miramos ligas POSTERIORES a la que se juega: lo anterior ya tiene su
  // clasificación y no es una inscripción.
  const currentLiga = await fetchCurrentLiga();

  const bases = [...new Set(conNombre.map((t) => clubOf(t.name)).filter(Boolean))];
  const vistos = new Set<string>();
  const rows: FcpInscripcion[] = [];
  let idLiga: number | null = null;

  for (const base of bases) {
    // `%` y `,` rompen los filtros de PostgREST; el nombre de un club no los
    // lleva, pero no cuesta nada no fiarse.
    const safe = base.replace(/[%,()]/g, ' ').trim();
    if (safe.length < 2) continue;
    const { data } = await rawFrom('fcp_inscripciones')
      .select('id_liga, equipo, genero, grupo_nombre, confirmado')
      .ilike('equipo', `${safe}%`)
      .limit(200);

    for (const r of (data ?? []) as {
      id_liga: number;
      equipo: string | null;
      genero: string | null;
      grupo_nombre: string | null;
      confirmado: boolean | null;
    }[]) {
      if (currentLiga != null && r.id_liga <= currentLiga) continue;
      const equipo = (r.equipo ?? '').trim();
      if (!equipo) continue;
      const clave = `${norm(equipo)}|${r.genero ?? ''}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      idLiga = idLiga ?? r.id_liga;

      // El mismo equipo en TACTIUM: por nombre Y género, porque «MEDIO CUDEYO A»
      // existe dos veces, una masculina y otra femenina.
      const mio = conNombre.find(
        (t) =>
          norm(t.name) === norm(equipo) &&
          (r.genero === 'F' ? t.gender === 'femenino' : t.gender !== 'femenino'),
      );

      rows.push({
        equipo,
        genero: r.genero === 'F' ? 'F' : r.genero === 'M' ? 'M' : null,
        categoria: catShort(r.grupo_nombre),
        confirmado: !!r.confirmado,
        enTactium: !!mio,
        categoriaActual: mio?.category ?? null,
      });
    }
  }

  if (rows.length === 0) return null;

  let temporada = '';
  if (idLiga != null) {
    const { data: liga } = await rawFrom('fcp_ligas')
      .select('temporada')
      .eq('id_liga', idLiga)
      .maybeSingle();
    temporada = seasonLabel((liga as { temporada: string | null } | null)?.temporada);
  }

  rows.sort((a, b) => a.equipo.localeCompare(b.equipo) || (a.genero ?? '').localeCompare(b.genero ?? ''));

  return {
    temporada,
    total: rows.length,
    confirmados: rows.filter((r) => r.confirmado).length,
    rows,
  };
}
