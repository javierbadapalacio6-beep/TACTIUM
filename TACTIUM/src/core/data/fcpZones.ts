import type { Palette } from '@core/theme';
import { catShort } from '@core/services/fcpSearch';

/**
 * Zonas de la clasificación de la Liga Cántabra (federación `FCantP`): qué
 * puestos de la FASE DE GRUPOS van a cada play off y cuáles descienden.
 *
 * Fuente: «Normativa Liga Cántabra de Pádel 2026» (PDF en la raíz del repo).
 * La Federación NO publica los cupos en sus datos: están a mano aquí y hay
 * que REVISARLOS CADA TEMPORADA cuando salga la normativa nueva.
 *
 * Solo aplica a los grupos de la fase regular. Los grupos de play off
 * (`fase2`…`fase5`, o nombres con ORO/PLATA/PLAY OFF) no llevan zonas.
 * Sin datos (otra federación, categoría desconocida…) → null y la tabla se
 * pinta como siempre. Se aplica a cualquier temporada de la FCantP (con la
 * nota en pantalla de que puede cambiar). Género: `fcp_grupos.genero`;
 * categoría: del nombre del grupo.
 */

export type ZoneKey = 'oro' | 'plata' | 'bronce' | 'descenso';

export interface Zone {
  key: ZoneKey;
  label: string;
  from: number;
  to: number;
}

type Gender = 'M' | 'F';

export const ZONE_COLORS: Record<Exclude<ZoneKey, 'descenso'>, string> = {
  oro: '#E3B341',
  plata: '#B9C4C2',
  bronce: '#C27A4A',
};

/** Color de la franja / chip de una zona (el descenso usa el rojo del tema). */
export const zoneColor = (key: ZoneKey, c: Palette): string =>
  key === 'descenso' ? c.error : ZONE_COLORS[key];

const LABEL: Record<ZoneKey, string> = {
  oro: 'Play off Oro',
  plata: 'Play off Plata',
  bronce: 'Play off Bronce',
  descenso: 'Descenso',
};

const z = (key: ZoneKey, from: number, to: number, label = LABEL[key]): Zone => ({
  key,
  label,
  from,
  to,
});

// Normativa 2026 · por género y categoría.
const FCANTP_2026: Record<Gender, Record<string, Zone[]>> = {
  M: {
    '1ª': [z('oro', 1, 4), z('plata', 5, 8)],
    '2ª': [z('oro', 1, 4), z('plata', 5, 8)],
    '3ª': [z('oro', 1, 3), z('plata', 4, 6), z('bronce', 7, 8)],
    '4ª': [z('oro', 1, 3), z('plata', 4, 6), z('bronce', 7, 8)],
    '5ª': [z('oro', 1, 3), z('plata', 4, 6), z('bronce', 7, 10)],
    '6ª': [z('oro', 1, 2), z('plata', 3, 4), z('bronce', 5, 6), z('descenso', 7, 10)],
  },
  F: {
    // En 1ª femenina la segunda fase son ligas, no play off.
    '1ª': [z('oro', 1, 3, 'Liga Oro'), z('plata', 4, 6, 'Liga Plata')],
    '2ª': [z('oro', 1, 4), z('plata', 5, 8)],
    '3ª': [z('oro', 1, 4), z('plata', 5, 8)],
    '4ª': [z('oro', 1, 4), z('plata', 5, 8)],
    '5ª': [z('oro', 1, 3), z('plata', 4, 6), z('bronce', 7, 9)],
  },
};

const RULES: Record<string, Record<Gender, Record<string, Zone[]>>> = {
  FCantP: FCANTP_2026,
};

const normGender = (g: string | null | undefined): Gender | null => {
  const s = (g ?? '').trim().toUpperCase();
  if (s.startsWith('F')) return 'F';
  if (s.startsWith('M')) return 'M';
  return null;
};

const normCat = (cat: string | null | undefined): string | null => catShort(cat) ?? null;

/** Leyenda (zonas en orden) de una categoría, o null si no hay datos. */
export function legendFor(
  fed: string | null | undefined,
  gender: string | null | undefined,
  category: string | null | undefined,
): Zone[] | null {
  const g = normGender(gender);
  const cat = normCat(category);
  if (!fed || !g || !cat) return null;
  return RULES[fed]?.[g]?.[cat] ?? null;
}

/** Zona de un puesto, o null (sin datos o puesto fuera de todas las zonas). */
export function zoneFor(
  fed: string | null | undefined,
  gender: string | null | undefined,
  category: string | null | undefined,
  position: number | null | undefined,
): Zone | null {
  if (position == null) return null;
  const zones = legendFor(fed, gender, category);
  return zones?.find((x) => position >= x.from && position <= x.to) ?? null;
}

/** ¿Es un grupo de play off (fase 2-5)? Ahí no hay zonas. */
export const isPlayoffGroup = (idGrupo: string | null | undefined, nombre?: string | null) =>
  /^fase/i.test(idGrupo ?? '') || /ORO|PLATA|PLAY\s*-?\s*OFF/i.test(nombre ?? '');

/**
 * Atajo para un grupo concreto: leyenda de la fase de grupos o null. La
 * categoría sale del nombre del grupo («3ª Categoría Masculina - Grupo A»).
 */
export function groupZones(params: {
  fed: string | null | undefined;
  idGrupo: string | null | undefined;
  nombre: string | null | undefined;
  genero: string | null | undefined;
}): Zone[] | null {
  if (isPlayoffGroup(params.idGrupo, params.nombre)) return null;
  return legendFor(params.fed, params.genero, params.nombre);
}

/** Zona de un puesto dentro de una leyenda ya resuelta. */
export const zoneIn = (zones: Zone[] | null, position: number | null | undefined): Zone | null =>
  zones && position != null
    ? zones.find((x) => position >= x.from && position <= x.to) ?? null
    : null;

export const ZONES_FOOTNOTE =
  'Según la normativa 2026 de la Liga Cántabra. Puede cambiar cada temporada.';

/** «1º–4º» para la leyenda. */
export const zoneRange = (zn: Zone): string => `${zn.from}º–${zn.to}º`;
