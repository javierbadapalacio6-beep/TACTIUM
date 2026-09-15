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

export interface FcpJugadorInscrito {
  idJugador: string;
  nombre: string;
  puntos: number;
}

export interface FcpInscripcion {
  equipo: string;
  genero: 'M' | 'F' | null;
  categoria: string | null; // "1ª"
  confirmado: boolean;
  /** Ese equipo ya existe en el club dentro de TACTIUM. */
  enTactium: boolean;
  /** Id del equipo en TACTIUM, para poder pedir el refresco manual. */
  teamId: string | null;
  /** Su categoría en la temporada en curso, si la sabemos. Sirve para ver de un
   *  vistazo quién sube y quién baja. */
  categoriaActual: string | null;
  /** Club donde jugará de local, según la Federación. */
  sede: string | null;
  /** Plantilla inscrita, de más a menos puntos. */
  jugadores: FcpJugadorInscrito[];
  /** Cuándo se leyó esa plantilla. La lista cambia mientras dura la
   *  inscripción, así que la pantalla dice de cuándo es la foto. */
  plantillaAt: string | null;
}

export interface FcpInscripcionesResumen {
  temporada: string; // "2026/2027"
  total: number;
  confirmados: number;
  rows: FcpInscripcion[];
}

export interface TeamLite {
  id: string;
  name: string;
  gender: string | null;
  category: string | null;
}

/**
 * Fuerza la relectura de la plantilla de UN equipo en la Federación.
 *
 * El volcado automático pasa dos veces por semana; esto es para cuando el club
 * acaba de dar a alguien de alta y no quiere esperar. Va por función de
 * servidor porque hay que entrar en la web de la FCP, cosa que la app no puede
 * hacer. Devuelve cuántos jugadores tiene el equipo ahora, o null si ese equipo
 * no está inscrito en la temporada que viene.
 */
export async function refreshInscripcionRoster(
  teamId: string,
): Promise<{ found: boolean; players: number | null }> {
  const { data, error } = await supabase.functions.invoke('fcp-refresh-roster', {
    body: { team_id: teamId },
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { found?: boolean; players?: number | null };
  return { found: !!r.found, players: r.players ?? null };
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
  // Fila -> id_equipo de la Federacion, para colgarle luego su plantilla.
  const idEquipoPorFila = new Map<number, number>();
  const rows: FcpInscripcion[] = [];
  let idLiga: number | null = null;

  for (const base of bases) {
    // `%` y `,` rompen los filtros de PostgREST; el nombre de un club no los
    // lleva, pero no cuesta nada no fiarse.
    const safe = base.replace(/[%,()]/g, ' ').trim();
    if (safe.length < 2) continue;
    const { data } = await rawFrom('fcp_inscripciones')
      .select('id_liga, id_equipo, equipo, genero, grupo_nombre, confirmado, sede, plantilla_updated_at')
      .ilike('equipo', `${safe}%`)
      .limit(200);

    for (const r of (data ?? []) as {
      id_liga: number;
      id_equipo: number;
      equipo: string | null;
      genero: string | null;
      grupo_nombre: string | null;
      confirmado: boolean | null;
      sede: string | null;
      plantilla_updated_at: string | null;
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
        teamId: mio?.id ?? null,
        categoriaActual: mio?.category ?? null,
        sede: r.sede ?? null,
        jugadores: [],
        plantillaAt: r.plantilla_updated_at ?? null,
      });
      idEquipoPorFila.set(rows.length - 1, r.id_equipo);
    }
  }

  if (rows.length === 0) return null;

  // Plantillas. Viven en `fcp_jugadores` con el `id_liga` de la temporada nueva
  // (misma tabla de siempre: los campos son idénticos). Una sola consulta para
  // todos los equipos, no una por fila.
  const idsEquipo = [...new Set([...idEquipoPorFila.values()])];
  if (idsEquipo.length > 0) {
    const { data: jug } = await rawFrom('fcp_jugadores')
      .select('id_jugador, nombre, nombre_pila, apellido1, apellido2, puntos, id_equipo')
      .in('id_equipo', idsEquipo)
      .order('puntos', { ascending: false, nullsFirst: false })
      .limit(2000);
    const porEquipo = new Map<number, FcpJugadorInscrito[]>();
    for (const j of (jug ?? []) as {
      id_jugador: string;
      nombre: string | null;
      nombre_pila: string | null;
      apellido1: string | null;
      apellido2: string | null;
      puntos: number | null;
      id_equipo: number;
    }[]) {
      const lista = porEquipo.get(j.id_equipo) ?? [];
      lista.push({
        idJugador: j.id_jugador,
        // "Nombre Apellido1 Apellido2" se lee mejor que el "APELLIDOS, Nombre"
        // que publica la Federación.
        nombre:
          [j.nombre_pila, j.apellido1, j.apellido2].filter(Boolean).join(' ').trim() ||
          (j.nombre ?? '—'),
        puntos: j.puntos ?? 0,
      });
      porEquipo.set(j.id_equipo, lista);
    }
    for (const [i, idEq] of idEquipoPorFila) {
      rows[i].jugadores = porEquipo.get(idEq) ?? [];
    }
  }

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
