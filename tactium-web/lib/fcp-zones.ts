/**
 * Zonas de la clasificación de la Liga Cántabra (FCantP): qué puestos de la
 * fase de grupos van a cada play off (o bajan).
 *
 * Fuente: «Normativa Liga Cántabra de Pádel 2026».
 * COPIA de `TACTIUM/src/core/data/fcpZones.ts` (la app): mismos datos y mismos
 * textos. Si cambia una, cambia la otra.
 *
 * Solo vale para la fase de grupos: los grupos de play off (`fase2`…`fase5`,
 * «Oro», «Plata»…) no tienen zonas. Sin datos para esa federación, género o
 * categoría → null, y la tabla se pinta sin franjas.
 */

export type FcpZoneId = "oro" | "plata" | "bronce" | "descenso";

export interface FcpZone {
  id: FcpZoneId;
  label: string;
  color: string;
  /** Puestos, ambos incluidos. */
  from: number;
  to: number;
}

export const FCP_ZONE_COLORS: Record<FcpZoneId, string> = {
  oro: "#E3B341",
  plata: "#B9C4C2",
  bronce: "#C27A4A",
  descenso: "var(--error)",
};

const LABEL: Record<FcpZoneId, string> = {
  oro: "Play off Oro",
  plata: "Play off Plata",
  bronce: "Play off Bronce",
  descenso: "Descenso",
};

type Range = [FcpZoneId, number, number];

const z = (ranges: Range[], labels?: Partial<Record<FcpZoneId, string>>): FcpZone[] =>
  ranges.map(([id, from, to]) => ({
    id,
    label: labels?.[id] ?? LABEL[id],
    color: FCP_ZONE_COLORS[id],
    from,
    to,
  }));

const TOP4_4: Range[] = [
  ["oro", 1, 4],
  ["plata", 5, 8],
];
const MASC_3_4: Range[] = [
  ["oro", 1, 3],
  ["plata", 4, 6],
  ["bronce", 7, 8],
];

/** Liga Cántabra 2026, por género y categoría. */
const CANTABRIA: Record<"M" | "F", Record<string, FcpZone[]>> = {
  M: {
    "1ª": z(TOP4_4),
    "2ª": z(TOP4_4),
    "3ª": z(MASC_3_4),
    "4ª": z(MASC_3_4),
    "5ª": z([
      ["oro", 1, 3],
      ["plata", 4, 6],
      ["bronce", 7, 10],
    ]),
    "6ª": z([
      ["oro", 1, 2],
      ["plata", 3, 4],
      ["bronce", 5, 6],
      ["descenso", 7, 10],
    ]),
  },
  F: {
    // 1ª femenina no juega play off: se parte en dos ligas.
    "1ª": z(
      [
        ["oro", 1, 3],
        ["plata", 4, 6],
      ],
      { oro: "Liga Oro", plata: "Liga Plata" }
    ),
    "2ª": z(TOP4_4),
    "3ª": z(TOP4_4),
    "4ª": z(TOP4_4),
    "5ª": z([
      ["oro", 1, 3],
      ["plata", 4, 6],
      ["bronce", 7, 9],
    ]),
  },
};

export const FCP_ZONES_NOTE =
  "Según la normativa 2026 de la Liga Cántabra. Puede cambiar cada temporada.";

function normFed(fed: string | null | undefined): "cantabria" | null {
  const f = (fed ?? "").trim().toLowerCase();
  return f === "fcantp" || f === "cantabra" || f === "cantabria" || f === "fcp"
    ? "cantabria"
    : null;
}

function normGender(g: string | null | undefined): "M" | "F" | null {
  const v = (g ?? "").trim().toUpperCase();
  if (v === "M" || v.startsWith("MASC")) return "M";
  if (v === "F" || v.startsWith("FEM")) return "F";
  return null;
}

/** «2ª Categoría Masculina» o «2» → «2ª». */
function normCategory(c: string | null | undefined): string | null {
  const m = (c ?? "").match(/(\d+)/);
  return m ? `${m[1]}ª` : null;
}

/** Zonas de un grupo, en orden de puesto. Null si no hay datos. */
export function legendFor(
  fed: string | null | undefined,
  gender: string | null | undefined,
  category: string | null | undefined
): FcpZone[] | null {
  if (normFed(fed) !== "cantabria") return null;
  const g = normGender(gender);
  const c = normCategory(category);
  if (!g || !c) return null;
  return CANTABRIA[g][c] ?? null;
}

/** Zona de un puesto concreto, o null (zona neutra o sin datos). */
export function zoneFor(
  fed: string | null | undefined,
  gender: string | null | undefined,
  category: string | null | undefined,
  position: number
): FcpZone | null {
  const zones = legendFor(fed, gender, category);
  if (!zones) return null;
  return zones.find((zn) => position >= zn.from && position <= zn.to) ?? null;
}
