import { fcp } from './fcpClient';

// Conector Federación Cántabra de Pádel (FCP). Lee de las tablas públicas
// `fcp_*` (proyecto 4PADEL), que contienen TODA la liga cántabra (masculino y
// femenino); el género se distingue por `fcp_grupos.genero` ('M' | 'F'). NO
// reimplementa el reglamento: solo expone lo scrapeado (a prueba de cambios de
// formato año a año). El volcado a TACTIUM lo hace el caller con
// `bulkUpsertPlayers` (mismo camino que el escaneo → add/update por nombre).

export type FcpGender = 'M' | 'F';

export interface FcpTeam {
  idEquipo: number;
  nombre: string;
  // Categoría + grupo legible, p.ej. "2ª Categoria Masculina - Grupo A".
  grupo: string | null;
}

export interface FcpPlayer {
  name: string;
  pts: number;
  categoria: string | null;
}

// "BARRIO RIBON, MARCOS" → "Marcos Barrio Ribon"; "2ª CATEGORIA … - GRUPO A"
// → "2ª Categoria … - Grupo A".
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

const isRegular = (idGrupo: string) => !String(idGrupo).startsWith('fase');

/**
 * Busca equipos de un género por nombre. Devuelve su categoría/grupo para
 * distinguir homónimos (mismo nombre en distinta categoría) y filtra por
 * género usando `fcp_grupos.genero`.
 */
export async function searchFcpTeams(
  query: string,
  gender: FcpGender,
): Promise<FcpTeam[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await fcp
    .from('fcp_clasificacion')
    .select('id_equipo, equipo, id_grupo')
    .ilike('equipo', `%${q}%`)
    .limit(500);
  if (error) throw error;

  const rows = (data ?? []) as {
    id_equipo: number;
    equipo: string;
    id_grupo: string;
  }[];
  if (!rows.length) return [];

  // Info de cada grupo (nombre + género).
  const grupoIds = Array.from(new Set(rows.map((r) => r.id_grupo)));
  const { data: g } = await fcp
    .from('fcp_grupos')
    .select('id_grupo, nombre, genero')
    .in('id_grupo', grupoIds);
  const info = new Map<string, { nombre: string; genero: string }>(
    ((g ?? []) as { id_grupo: string; nombre: string; genero: string }[]).map(
      (x) => [String(x.id_grupo), { nombre: x.nombre, genero: x.genero }],
    ),
  );

  // Solo el género pedido; quédate con el grupo de fase REGULAR por equipo.
  const byTeam = new Map<number, { equipo: string; grupoId: string }>();
  for (const r of rows) {
    const gi = info.get(String(r.id_grupo));
    if (!gi || gi.genero !== gender) continue;
    const cur = byTeam.get(r.id_equipo);
    if (!cur || (isRegular(r.id_grupo) && !isRegular(cur.grupoId))) {
      byTeam.set(r.id_equipo, { equipo: r.equipo, grupoId: r.id_grupo });
    }
  }

  return Array.from(byTeam, ([idEquipo, v]) => ({
    idEquipo,
    nombre: v.equipo,
    grupo: info.has(String(v.grupoId))
      ? titleCase(info.get(String(v.grupoId))!.nombre)
      : null,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Plantilla (jugadores + puntos) de un equipo, de más a menos puntos. */
export async function fetchFcpRoster(idEquipo: number): Promise<FcpPlayer[]> {
  const { data, error } = await fcp
    .from('fcp_jugadores')
    .select('nombre_pila, apellido1, apellido2, categoria, puntos')
    .eq('id_equipo', idEquipo)
    .order('puntos', { ascending: false, nullsFirst: false });
  if (error) throw error;

  return ((data ?? []) as {
    nombre_pila: string | null;
    apellido1: string | null;
    apellido2: string | null;
    categoria: string | null;
    puntos: number | null;
  }[]).map((r) => ({
    name: titleCase(`${r.nombre_pila ?? ''} ${r.apellido1 ?? ''} ${r.apellido2 ?? ''}`),
    pts: r.puntos ?? 0,
    categoria: r.categoria ?? null,
  }));
}
