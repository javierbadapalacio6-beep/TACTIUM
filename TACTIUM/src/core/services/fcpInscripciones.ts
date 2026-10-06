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
import type { FcpTeamOption } from './fcpOnboarding';
import type { TeamGender } from '@core/data/federations';
import {
  diffClubSeason,
  fcpEstadoLabel,
  fcpPlayerKey,
  type FcpDiffActual,
  type FcpDiffSiguiente,
  type FcpSeasonEstado,
} from './fcpSeasonDiff';

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
  /** Liga, categoría y equipo en la Federación: hacen falta para pedir los
   *  rivales del grupo (`fetchInscripcionGrupo`). */
  idLiga: number;
  idGrupo: string;
  idEquipo: number;
  equipo: string;
  genero: 'M' | 'F' | null;
  categoria: string | null; // "1ª"
  /** Grupo dentro de la categoría ('A' | 'B' | 'C' | 'D'), según el PDF de
   *  distribución de la Federación. Null mientras no se conozca. */
  subgrupo: string | null;
  confirmado: boolean;
  /** Ese equipo ya existe en el club dentro de TACTIUM. */
  enTactium: boolean;
  /** Id del equipo en TACTIUM, para poder pedir el refresco manual. Sale del
   *  cruce por jugadores, así que un equipo al que la FCP ha cambiado la letra
   *  lo conserva. */
  teamId: string | null;
  /** Su categoría en la temporada en curso, si la sabemos. Sirve para ver de un
   *  vistazo quién sube y quién baja. */
  categoriaActual: string | null;
  /** Qué le pasa respecto a la temporada en curso (ver [[fcpSeasonDiff]]). */
  estado: FcpSeasonEstado;
  /** Nombre que tiene en TACTIUM cuando la Federación lo inscribe con otro. */
  antes: string | null;
  /** «Sigue en 2ª», «4ª → 3ª», «Antes ZINK PADEL F», «Nuevo». */
  estadoLabel: string;
  /** Club donde jugará de local, según la Federación (nombre largo). */
  sede: string | null;
  /** La misma sede en corto («SMASH», «GO FIT»), como la escribe el PDF. */
  sedeCorta: string | null;
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
  /** Equipos del club en TACTIUM, importados de la Federación, que no salen en
   *  la lista de inscritos de la temporada nueva. */
  desaparecen: { teamId: string; name: string; categoria: string | null }[];
}

export interface TeamLite {
  id: string;
  name: string;
  gender: string | null;
  category: string | null;
}

/** Rival del mismo grupo en la temporada que viene. */
export interface FcpRivalGrupo {
  idEquipo: number;
  equipo: string;
  sedeCorta: string | null;
  confirmado: boolean;
}

/**
 * Fuerza la relectura de la plantilla de UN equipo en la Federación.
 *
 * El volcado automático pasa dos veces por semana; esto es para cuando el club
 * acaba de dar a alguien de alta y no quiere esperar. Va por función de
 * servidor porque hay que entrar en la web de la FCP, cosa que la app no puede
 * hacer. Devuelve cuántos jugadores tiene el equipo ahora, o null si ese equipo
 * no está inscrito en la temporada que viene.
 *
 * `idEquipo` es el de la temporada nueva cuando ya lo sabemos (sale del cruce
 * por jugadores): sin él, la función busca por el nombre de TACTIUM y no
 * encuentra a un equipo al que la Federación le ha cambiado la letra.
 */
export async function refreshInscripcionRoster(
  teamId: string,
  idEquipo?: number | null,
): Promise<{ found: boolean; players: number | null }> {
  const { data, error } = await supabase.functions.invoke('fcp-refresh-roster', {
    body: idEquipo ? { team_id: teamId, fcp_id_equipo: idEquipo } : { team_id: teamId },
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { found?: boolean; players?: number | null };
  return { found: !!r.found, players: r.players ?? null };
}

/**
 * Plantilla de la temporada EN CURSO de cada equipo del club, como claves de
 * jugador (`fcpPlayerKey`), para cruzarla con la de la temporada que viene.
 *
 * Primero la de la Federación, por el vínculo `fcp_team_links`: es la lista
 * oficial y trae nombre y apellidos por separado. Si el equipo no está
 * vinculado (o la FCP no publica jugadores en él), la de TACTIUM: los
 * jugadores importados se guardan como «Nombre Apellido1 Apellido2», que
 * normalizado da la misma clave.
 *
 * Devuelve también qué equipos están vinculados: solo esos pueden
 * «desaparecer» de la Federación. Un equipo creado a mano nunca estuvo allí.
 */
async function plantillasActuales(
  teams: TeamLite[],
): Promise<{ porEquipo: Map<string, Set<string>>; vinculados: Set<string> }> {
  const porEquipo = new Map<string, Set<string>>();
  const vinculados = new Set<string>();
  const ids = teams.map((t) => t.id);
  if (ids.length === 0) return { porEquipo, vinculados };

  const { data: links } = await rawFrom('fcp_team_links')
    .select('team_id, fcp_id_equipo')
    .in('team_id', ids);
  const linkRows = ((links ?? []) as { team_id: string; fcp_id_equipo: number | null }[]).filter(
    (l) => l.fcp_id_equipo != null,
  );
  for (const l of linkRows) vinculados.add(l.team_id);

  if (linkRows.length > 0) {
    const { data: jug } = await rawFrom('fcp_jugadores')
      .select('id_equipo, nombre, nombre_pila, apellido1, apellido2')
      .in('id_equipo', [...new Set(linkRows.map((l) => l.fcp_id_equipo as number))])
      .limit(5000);
    const clavesPorFcp = new Map<number, Set<string>>();
    for (const j of (jug ?? []) as {
      id_equipo: number;
      nombre: string | null;
      nombre_pila: string | null;
      apellido1: string | null;
      apellido2: string | null;
    }[]) {
      const k = fcpPlayerKey(j);
      if (!k) continue;
      const set = clavesPorFcp.get(j.id_equipo) ?? new Set<string>();
      set.add(k);
      clavesPorFcp.set(j.id_equipo, set);
    }
    // Un equipo puede tener más de un vínculo (de temporadas distintas): se
    // juntan, porque cualquiera de esos jugadores sirve para reconocerlo.
    for (const l of linkRows) {
      const claves = clavesPorFcp.get(l.fcp_id_equipo as number);
      if (!claves || claves.size === 0) continue;
      const set = porEquipo.get(l.team_id) ?? new Set<string>();
      claves.forEach((k) => set.add(k));
      porEquipo.set(l.team_id, set);
    }
  }

  const sinPlantilla = ids.filter((id) => !porEquipo.get(id)?.size);
  if (sinPlantilla.length > 0) {
    const { data: pl } = await supabase
      .from('players')
      .select('team_id, name')
      .in('team_id', sinPlantilla)
      .eq('active', true)
      .limit(5000);
    for (const p of (pl ?? []) as { team_id: string; name: string | null }[]) {
      const k = fcpPlayerKey({ nombre: p.name });
      if (!k) continue;
      const set = porEquipo.get(p.team_id) ?? new Set<string>();
      set.add(k);
      porEquipo.set(p.team_id, set);
    }
  }

  return { porEquipo, vinculados };
}

type FilaInscripcionRaw = {
  id_liga: number;
  id_grupo: string;
  id_equipo: number;
  equipo: string | null;
  genero: string | null;
  grupo_nombre: string | null;
  subgrupo: string | null;
  confirmado: boolean | null;
  sede: string | null;
  sede_corta: string | null;
  plantilla_updated_at: string | null;
};

/**
 * Inscripciones de la temporada siguiente para los equipos de un club.
 *
 * Las filas se buscan por el nombre del club (prefijo), y cada una se casa con
 * su equipo de TACTIUM con [[fcpSeasonDiff]]: primero por jugadores en común y
 * después por nombre sin patrocinador. No sirve el id: el `id_equipo` de la
 * Federación cambia cada temporada, y el vínculo guardado (`fcp_team_links`)
 * apunta a la liga en curso. Tampoco basta el nombre exacto: la FCP reasigna
 * letras («ZINK PADEL F» pasa a «ZINK PADEL E») y el equipo de siempre salía
 * como nuevo.
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
  const candidatas: FilaInscripcionRaw[] = [];
  for (const base of bases) {
    // `%` y `,` rompen los filtros de PostgREST; el nombre de un club no los
    // lleva, pero no cuesta nada no fiarse.
    const safe = base.replace(/[%,()]/g, ' ').trim();
    if (safe.length < 2) continue;
    const { data } = await rawFrom('fcp_inscripciones')
      .select(
        'id_liga, id_grupo, id_equipo, equipo, genero, grupo_nombre, subgrupo, confirmado, sede, sede_corta, plantilla_updated_at',
      )
      .ilike('equipo', `${safe}%`)
      .limit(200);
    for (const r of (data ?? []) as FilaInscripcionRaw[]) {
      if (currentLiga != null && r.id_liga <= currentLiga) continue;
      if (!(r.equipo ?? '').trim()) continue;
      candidatas.push(r);
    }
  }
  if (candidatas.length === 0) return null;

  // Filas viejas. Al rellenar los grupos con el PDF de distribución quedaron
  // filas sin `subgrupo` en categorías que sí lo tienen: son inscripciones que
  // la Federación ya no publica, y contarlas pondría un equipo de más en la
  // lista del club. Se mira la categoría entera, una consulta para todas.
  const dudosas = [...new Set(candidatas.filter((r) => !r.subgrupo).map((r) => r.id_grupo))];
  const conSubgrupos = new Set<string>();
  if (dudosas.length > 0) {
    const { data: sg } = await rawFrom('fcp_inscripciones')
      .select('id_grupo')
      .in('id_grupo', dudosas)
      .not('subgrupo', 'is', null)
      .limit(5000);
    for (const g of (sg ?? []) as { id_grupo: string }[]) conSubgrupos.add(g.id_grupo);
  }

  // Una fila por equipo y género. Si aun así se repite, gana la que trae grupo.
  const porClave = new Map<string, FilaInscripcionRaw>();
  for (const r of candidatas) {
    if (!r.subgrupo && conSubgrupos.has(r.id_grupo)) continue;
    const clave = `${norm(r.equipo)}|${r.genero ?? ''}`;
    const previa = porClave.get(clave);
    if (!previa || (!previa.subgrupo && r.subgrupo)) porClave.set(clave, r);
  }
  const raws = [...porClave.values()];
  if (raws.length === 0) return null;
  const idLiga = raws[0].id_liga;

  // Plantillas de la temporada nueva (viven en `fcp_jugadores` con el
  // `id_liga` nuevo; los campos son los de siempre) y de la que se juega, a
  // la vez. Todo en bloque, no una consulta por equipo.
  const idsEquipo = [...new Set(raws.map((r) => r.id_equipo))];
  const [{ data: jug }, actualesInfo] = await Promise.all([
    rawFrom('fcp_jugadores')
      .select('id_jugador, nombre, nombre_pila, apellido1, apellido2, puntos, id_equipo')
      .in('id_equipo', idsEquipo)
      .order('puntos', { ascending: false, nullsFirst: false })
      .limit(3000),
    plantillasActuales(conNombre),
  ]);
  const porEquipo = new Map<number, FcpJugadorInscrito[]>();
  const clavesPorEquipo = new Map<number, Set<string>>();
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
    const k = fcpPlayerKey(j);
    if (k) {
      const set = clavesPorEquipo.get(j.id_equipo) ?? new Set<string>();
      set.add(k);
      clavesPorEquipo.set(j.id_equipo, set);
    }
  }

  // El cruce de temporada: qué fila es qué equipo del club.
  const actuales: FcpDiffActual[] = conNombre.map((t) => ({
    teamId: t.id,
    name: t.name,
    genero: t.gender === 'femenino' ? 'F' : 'M',
    categoria: t.category,
    jugadores: actualesInfo.porEquipo.get(t.id) ?? new Set<string>(),
  }));
  const generoDe = (g: string | null): 'M' | 'F' | null => (g === 'F' ? 'F' : g === 'M' ? 'M' : null);
  const siguientes: FcpDiffSiguiente[] = raws.map((r) => ({
    equipo: (r.equipo ?? '').trim(),
    genero: generoDe(r.genero),
    categoria: catShort(r.grupo_nombre),
    jugadores: clavesPorEquipo.get(r.id_equipo) ?? new Set<string>(),
  }));
  const diff = diffClubSeason(actuales, siguientes);

  const rows: FcpInscripcion[] = raws.map((r, i) => {
    const d = diff.filas[i];
    const categoria = siguientes[i].categoria;
    return {
      idLiga: r.id_liga,
      idGrupo: r.id_grupo,
      idEquipo: r.id_equipo,
      equipo: siguientes[i].equipo,
      genero: siguientes[i].genero,
      categoria,
      subgrupo: r.subgrupo ?? null,
      confirmado: !!r.confirmado,
      enTactium: !!d.teamId,
      teamId: d.teamId,
      categoriaActual: d.categoriaAntes,
      estado: d.estado,
      antes: d.antes,
      estadoLabel: fcpEstadoLabel(d, categoria),
      sede: r.sede ?? null,
      sedeCorta: r.sede_corta ?? null,
      jugadores: porEquipo.get(r.id_equipo) ?? [],
      plantillaAt: r.plantilla_updated_at ?? null,
    };
  });

  const { data: liga } = await rawFrom('fcp_ligas')
    .select('temporada')
    .eq('id_liga', idLiga)
    .maybeSingle();
  const temporada = seasonLabel((liga as { temporada: string | null } | null)?.temporada);

  rows.sort((a, b) => a.equipo.localeCompare(b.equipo) || (a.genero ?? '').localeCompare(b.genero ?? ''));

  return {
    temporada,
    total: rows.length,
    confirmados: rows.filter((r) => r.confirmado).length,
    rows,
    // Solo los importados de la Federación: un equipo hecho a mano (amateur,
    // de pachanga) no tiene por qué estar inscrito y avisar de él sería ruido.
    desaparecen: diff.desaparecen
      .filter((t) => actualesInfo.vinculados.has(t.teamId))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Rivales del grupo de un equipo en la temporada que viene: mismos liga,
 * categoría y subgrupo, sin el propio equipo, por nombre.
 *
 * Sin subgrupo devuelve []: la categoría entera son 32 equipos y casi ninguno
 * será rival, así que enseñarla como «tu grupo» sería falso. Filtrar por
 * subgrupo deja fuera, de paso, las filas viejas que se quedaron sin él.
 */
export async function fetchInscripcionGrupo(fila: {
  idLiga: number;
  idGrupo: string;
  subgrupo: string | null;
  idEquipo?: number | null;
}): Promise<FcpRivalGrupo[]> {
  if (!fila.subgrupo) return [];
  const { data } = await rawFrom('fcp_inscripciones')
    .select('id_equipo, equipo, sede_corta, confirmado')
    .eq('id_liga', fila.idLiga)
    .eq('id_grupo', fila.idGrupo)
    .eq('subgrupo', fila.subgrupo)
    .limit(100);
  return ((data ?? []) as {
    id_equipo: number;
    equipo: string | null;
    sede_corta: string | null;
    confirmado: boolean | null;
  }[])
    .filter((r) => r.id_equipo !== fila.idEquipo && (r.equipo ?? '').trim())
    .map((r) => ({
      idEquipo: r.id_equipo,
      equipo: (r.equipo ?? '').trim(),
      sedeCorta: r.sede_corta ?? null,
      confirmado: !!r.confirmado,
    }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo));
}

/**
 * Los equipos de la temporada que VIENE, con la forma que usa el buscador de
 * equipos federativos (`FcpTeamOption`), para poder ofrecerlos como candidatos.
 *
 * POR QUÉ. «Preparar temporada» compara tu plantilla con la del equipo que
 * elijas, y hasta ahora solo podía elegir entre los equipos de la liga EN
 * JUEGO (`searchFcpClubs` filtra por `fetchCurrentLiga`). Justo cuando toca
 * preparar la temporada nueva, esa liga es la vieja: el único candidato con tu
 * nombre era tu propio equipo del año pasado, así que el diff se calculaba
 * contra sí mismo y salía «15 siguen, 0 nuevos, 0 vuelven, 0 se van» — una
 * pantalla que siempre dice que no cambia nada. Los datos buenos ya estaban
 * espejados, pero en `fcp_inscripciones`, que ese buscador no mira.
 *
 * Una liga en inscripción no tiene grupos ni clasificación todavía, así que la
 * categoría sale de `grupo_nombre` («1ª CATEGORIA MASCULINA»). El grupo dentro
 * de la categoría (`subgrupo`) sí se conoce en cuanto la Federación publica el
 * PDF de distribución; hasta entonces va vacío.
 */
export interface FcpPreseasonTeam extends FcpTeamOption {
  /** "2026/2027", para poder distinguirlo del mismo equipo del año pasado. */
  temporada: string;
}

export async function fetchFcpPreseasonTeams(): Promise<FcpPreseasonTeam[]> {
  const currentLiga = await fetchCurrentLiga();
  const { data } = await rawFrom('fcp_inscripciones')
    .select('id_liga, id_equipo, equipo, genero, grupo_nombre, subgrupo')
    // Una temporada entera de la FCP ronda las 350 inscripciones; el límite por
    // defecto de PostgREST (1000) daría de sobra, pero es el tipo de tope que
    // se come equipos en silencio cuando la liga crece.
    .limit(3000);

  const rows = ((data ?? []) as {
    id_liga: number;
    id_equipo: number;
    equipo: string | null;
    genero: string | null;
    grupo_nombre: string | null;
    subgrupo: string | null;
  }[]).filter((r) => r.equipo && (currentLiga == null || r.id_liga > currentLiga));
  if (rows.length === 0) return [];

  // Etiqueta de temporada, una consulta para todas las ligas implicadas.
  const ligas = [...new Set(rows.map((r) => r.id_liga))];
  const { data: ligasRaw } = await rawFrom('fcp_ligas')
    .select('id_liga, temporada')
    .in('id_liga', ligas);
  const labelPorLiga = new Map<number, string>(
    ((ligasRaw ?? []) as { id_liga: number; temporada: string | null }[]).map((l) => [
      l.id_liga,
      seasonLabel(l.temporada),
    ]),
  );

  return rows
    .map((r) => ({
      id_equipo: r.id_equipo,
      id_liga: r.id_liga,
      equipo: (r.equipo ?? '').trim(),
      club: clubOf(r.equipo ?? ''),
      grupo: r.subgrupo ? `Grupo ${r.subgrupo}` : '',
      gender: (r.genero === 'F' ? 'femenino' : 'masculino') as TeamGender,
      category: catShort(r.grupo_nombre),
      temporada: labelPorLiga.get(r.id_liga) ?? '',
    }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo));
}
