// Qué pasa con cada equipo del club al cambiar de temporada en la Federación.
//
// Lógica pura, sin base de datos. COPIA LITERAL de la app
// (`TACTIUM/src/core/services/fcpSeasonDiff.ts`): si tocas una, toca
// la otra.
//
// POR QUÉ. La FCP no publica «tu equipo de este año es el de aquel». Publica una
// lista de inscritos, y entre una temporada y la siguiente un equipo puede
// cambiar de letra («ZINK PADEL F» pasa a ser «ZINK PADEL E»), de nombre
// («LEGACY» → «LABARU»), de categoría, o desaparecer. Cruzando solo por nombre,
// un cambio de letra salía como «equipo nuevo» y el de siempre se quedaba
// huérfano, y el club acababa con dos equipos en TACTIUM. Lo que sí se mantiene
// es la gente: por eso el segundo criterio son los jugadores en común.

export type FcpSeasonEstado =
  /** Mismo nombre y misma categoría. */
  | 'sigue'
  /** Mismo nombre, otra categoría. */
  | 'sube'
  | 'baja'
  /** Otro nombre, pero es el mismo equipo (comparten jugadores). */
  | 'renombrado'
  /** No se parece a ninguno de los que tiene el club. */
  | 'nuevo';

export interface FcpDiffActual {
  teamId: string;
  name: string;
  /** 'M' | 'F' */
  genero: 'M' | 'F';
  /** "2ª" */
  categoria: string | null;
  /** Claves de jugador (ver `fcpPlayerKey`). Vacío si no se conoce la plantilla. */
  jugadores: Set<string>;
}

export interface FcpDiffSiguiente {
  equipo: string;
  genero: 'M' | 'F' | null;
  categoria: string | null;
  jugadores: Set<string>;
}

export interface FcpDiffResultado {
  /** Por índice de `siguientes`. */
  filas: {
    estado: FcpSeasonEstado;
    teamId: string | null;
    /** Nombre (sin patrocinador) del equipo en TACTIUM cuando es otro. */
    antes: string | null;
    /** Categoría del equipo en TACTIUM, para enseñar «2ª → 1ª». */
    categoriaAntes: string | null;
    /** Jugadores en común, solo en «renombrado». */
    comunes: number;
  }[];
  /** Equipos del club en TACTIUM que no aparecen inscritos. */
  desaparecen: { teamId: string; name: string; categoria: string | null }[];
}

const normName = (s: string | null | undefined) =>
  (s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Nombre sin patrocinador: «ZINK PADEL F - ALTAMIRA A» y «ZINK PADEL F-ALTAMIRA
 *  A» son «ZINK PADEL F». Solo corta cuando lo de antes del guion acaba en la
 *  letra del equipo, para no partir «NUEVO SAN LAZARO - PONTEJOS A». */
const sinPatrocinador = (s: string) => {
  let n = normName(s).replace(/\s+(G[º°]\.?|GRUPO)\s+.+$/, '');
  const m = n.match(/^(.*\s[A-ZÑ])\s*-/);
  if (m) n = m[1];
  return n.trim();
};

/** Clave de un jugador que sobrevive al cambio de temporada: el `id_jugador`
 *  de la FCP lleva dentro el id del equipo, que cambia cada año. */
export const fcpPlayerKey = (p: {
  nombre_pila?: string | null;
  apellido1?: string | null;
  apellido2?: string | null;
  nombre?: string | null;
}): string => {
  const partes = [p.nombre_pila, p.apellido1, p.apellido2].filter(Boolean).join(' ');
  return normName(partes || p.nombre);
};

const catNum = (c: string | null) => {
  const m = (c ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Mínimo para dar por bueno que dos equipos son el mismo: 2 jugadores y un
 *  tercio de la plantilla más corta. Con uno solo bastaría un fichaje. */
const MIN_COMUNES = 2;
const MIN_PROPORCION = 1 / 3;

export function diffClubSeason(
  actuales: FcpDiffActual[],
  siguientes: FcpDiffSiguiente[],
): FcpDiffResultado {
  const filas: FcpDiffResultado['filas'] = siguientes.map(() => ({
    estado: 'nuevo',
    teamId: null,
    antes: null,
    categoriaAntes: null,
    comunes: 0,
  }));
  const usados = new Set<string>();
  const generoDe = (s: FcpDiffSiguiente) => s.genero ?? 'M';

  const asignar = (i: number, t: FcpDiffActual, comunes: number) => {
    usados.add(t.teamId);
    const mismoNombre = sinPatrocinador(t.name) === sinPatrocinador(siguientes[i].equipo);
    const antes = catNum(t.categoria);
    const ahora = catNum(siguientes[i].categoria);
    filas[i] = {
      estado: !mismoNombre
        ? 'renombrado'
        : antes == null || ahora == null || antes === ahora
          ? 'sigue'
          : ahora < antes
            ? 'sube'
            : 'baja',
      teamId: t.teamId,
      antes: mismoNombre ? null : sinPatrocinador(t.name),
      categoriaAntes: t.categoria,
      comunes,
    };
  };

  // 1. Por jugadores en común, de la pareja más clara a la menos. Va ANTES que
  //    el nombre porque la FCP reasigna letras: en 2026/27 el «RACKET SPORT B»
  //    de 1ª es el «RACKET SPORT A» que jugaba en 2ª, no el «B» de 3ª.
  const candidatos: { i: number; t: FcpDiffActual; comunes: number }[] = [];
  siguientes.forEach((s, i) => {
    for (const t of actuales) {
      if (t.genero !== generoDe(s)) continue;
      if (t.jugadores.size === 0 || s.jugadores.size === 0) continue;
      let comunes = 0;
      for (const k of s.jugadores) if (t.jugadores.has(k)) comunes++;
      const minimo = Math.max(MIN_COMUNES, Math.ceil(Math.min(t.jugadores.size, s.jugadores.size) * MIN_PROPORCION));
      if (comunes >= minimo) candidatos.push({ i, t, comunes });
    }
  });
  candidatos.sort((a, b) => b.comunes - a.comunes);
  for (const c of candidatos) {
    if (filas[c.i].teamId || usados.has(c.t.teamId)) continue;
    asignar(c.i, c.t, c.comunes);
  }

  // 2. Mismo nombre y género, para lo que no se pudo decidir por plantilla
  //    (equipos sin jugadores volcados). «MEDIO CUDEYO A» existe en los dos.
  siguientes.forEach((s, i) => {
    if (filas[i].teamId) return;
    const t = actuales.find(
      (a) =>
        !usados.has(a.teamId) &&
        a.genero === generoDe(s) &&
        sinPatrocinador(a.name) === sinPatrocinador(s.equipo),
    );
    if (t) asignar(i, t, 0);
  });

  return {
    filas,
    desaparecen: actuales
      .filter((a) => !usados.has(a.teamId))
      .map((a) => ({ teamId: a.teamId, name: a.name, categoria: a.categoria })),
  };
}

/** Texto corto para la fila: «Sigue en 2ª», «2ª → 1ª», «Antes ZINK PADEL F», «Nuevo». */
export function fcpEstadoLabel(
  f: FcpDiffResultado['filas'][number],
  categoria: string | null,
): string {
  switch (f.estado) {
    case 'sigue':
      return categoria ? `Sigue en ${categoria}` : 'Sigue';
    case 'sube':
    case 'baja':
      return `${f.categoriaAntes} → ${categoria}`;
    case 'renombrado':
      return f.categoriaAntes && categoria && f.categoriaAntes !== categoria
        ? `Antes ${f.antes} · ${f.categoriaAntes} → ${categoria}`
        : `Antes ${f.antes}`;
    default:
      return 'Nuevo';
  }
}
