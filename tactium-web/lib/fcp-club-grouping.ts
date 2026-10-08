/**
 * Agrupar los equipos federativos por club — port LITERAL de `clubOf`, `clubTokens`,
 * `commonClubPrefix` y de la fusión de nombres de `TACTIUM/src/core/services/fcpOnboarding.ts`.
 *
 * Es código puro (sin Supabase) a propósito: así se puede probar contra el catálogo real y
 * comprobar que web y app agrupan igual. Si se toca aquí, hay que tocar allí (y al revés).
 */

// Filas de la clasificación que NO son equipos (huecos del cuadro).
export const NON_TEAM_ROW = /^(exento|eliminatoria|bye|descansa|vacante|fase\b)/i;

// Palabras que NO identifican a un club por sí solas: si dos nombres solo
// comparten esto, no son el mismo club.
const GENERIC_CLUB_WORDS = new Set([
  "PADEL", "CLUB", "CP", "CD", "AD", "CDE", "ESCUELA", "INDOOR", "SPORT",
  "SPORTS", "DEPORTIVO", "POLIDEPORTIVO", "CENTRO", "COMPLEJO", "DE", "LA",
  "EL", "LOS", "LAS", "DEL", "TEAM",
]);

/**
 * Deriva el nombre de club quitando el patrocinador tras guion y el sufijo de equipo del
 * final: letra (CUALQUIERA, no solo A-F: un club grande llega a la G, la H o la I y esos
 * equipos se quedaban fuera de su propio club), número, o número romano. Opcionalmente
 * precedido de MASCULINO/FEMENINO.
 */
export function clubOf(equipo: string): string {
  let s = equipo.trim().replace(/\s+/g, " ");
  // 1) Patrocinador tras guion: "CENTRAL PADEL B - ESTELA".
  s = s.replace(/\s*[-–]\s*[^-–]+$/, "").trim() || s;
  // 2) Patrocinador tras "Gº"/"GRUPO" (sin guion): la Federación lo escribe de
  //    las dos maneras — "A.D.R.M. A  Gº PATATAS REGATO PUENTE".
  s = s.replace(/\s+(G[º°]\.?|GRUPO)\s+.+$/i, "").trim() || s;
  // 3) Restos de separador al final.
  s = s.replace(/[\s\-–]+$/, "").trim() || equipo.trim();
  // 4) Sufijo de equipo.
  s = s
    .replace(/\s+(MASCULINO|FEMENINO)?\s*([A-ZÑ]|\d{1,2}|I{2,3}|IV|VI{0,3}|IX|XI{0,2})$/i, "")
    .trim();
  return s || equipo.trim();
}

const clubTokens = (name: string): string[] => {
  const all = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
  // Quita la forma jurídica inicial ("C.D.", "C.P.", "S.T.C."): son iniciales
  // sueltas y no distinguen un club de otro, así "C.D. LA PLAYUCA ASTILLERO A"
  // y "LA PLAYUCA ASTILLERO C" caen en el mismo. Si TODO el nombre son
  // iniciales ("A.D.R.M."), ahí sí son su identidad y se quedan.
  let i = 0;
  while (i < all.length && all[i].length === 1) i++;
  return i < all.length ? all.slice(i) : all;
};

/**
 * Prefijo común de dos nombres de club, si de verdad los identifica: al menos 2 palabras, y
 * alguna de 3+ letras que no sea genérica. Lo de las 3+ letras no es capricho: media Cantabria
 * empieza por "C.D." / "C.D.E." / "C.P.", y sin ese filtro C.D. SALAS, C.D. LA PLAYUCA y
 * C.D. PADEL SANTANDER acababan en el mismo saco (comprobado contra los datos reales de la FCP).
 */
function commonClubPrefix(a: string[], b: string[]): string[] | null {
  const pre: string[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) break;
    pre.push(a[i]);
  }
  if (pre.length < 2) return null;
  if (!pre.some((w) => w.length >= 3 && !GENERIC_CLUB_WORDS.has(w))) return null;
  return pre;
}

export const genderOf = (g: string | null): string =>
  (g ?? "").toUpperCase().startsWith("F") ? "femenino" : "masculino";

export const categoryOf = (grupo: string | null): string | null => {
  const m = (grupo ?? "").match(/(\d+)\s*ª/);
  return m ? `${m[1]}ª` : null;
};

/**
 * Un mismo club aparece en la Federación con nombres distintos ("ES MAS PADEL", "ES MAS PADEL
 * SANTANDER", "ES MAS PADEL CLUB") y así sus equipos salían en grupos separados y no se podían
 * importar de una vez. Se funden los nombres que comparten un prefijo que de verdad los
 * identifica. Filtra por `query` (nombre del club, del equipo o la etiqueta fundida).
 */
export function groupByClub<T extends { club: string; equipo: string }>(
  opts: T[],
  query: string,
): { club: string; teams: T[] }[] {
  const names = [...new Set(opts.map((o) => o.club))];
  const tokensOf = new Map(names.map((n) => [n, clubTokens(n)]));
  // Nombre canónico de cada uno (arranca en sí mismo y se va acortando).
  const canon = new Map(names.map((n) => [n, tokensOf.get(n)!]));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const pre = commonClubPrefix(canon.get(names[i])!, canon.get(names[j])!);
      if (!pre) continue;
      // Los dos (y cualquiera que ya apuntara a ellos) pasan al prefijo común.
      const a = canon.get(names[i])!.join(" ");
      const b = canon.get(names[j])!.join(" ");
      for (const n of names) {
        const cur = canon.get(n)!.join(" ");
        if (cur === a || cur === b) canon.set(n, pre);
      }
    }
  }
  const labelOf = new Map<string, string>();
  for (const n of names) {
    const key = canon.get(n)!.join(" ");
    // Etiqueta = el nombre real más corto de los que se han fundido (así se ve
    // "ES MAS PADEL" y no una reconstrucción en mayúsculas sin acentos).
    const prev = labelOf.get(key);
    if (!prev || n.length < prev.length) labelOf.set(key, n);
  }

  const q = query.trim().toLowerCase();
  const byClub = new Map<string, T[]>();
  for (const o of opts) {
    const key = canon.get(o.club)!.join(" ");
    const label = labelOf.get(key) ?? o.club;
    if (
      q &&
      !label.toLowerCase().includes(q) &&
      !o.club.toLowerCase().includes(q) &&
      !o.equipo.toLowerCase().includes(q)
    )
      continue;
    if (!byClub.has(label)) byClub.set(label, []);
    byClub.get(label)!.push(o);
  }
  return Array.from(byClub.entries())
    .map(([club, teams]) => ({
      club,
      teams: teams.sort((a, b) => a.equipo.localeCompare(b.equipo)),
    }))
    .sort((a, b) => a.club.localeCompare(b.club));
}
