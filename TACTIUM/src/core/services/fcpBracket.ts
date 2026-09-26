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
  resolveMainGroupOrPrevious,
  type FcpActaPartido,
} from './fcpSeason';
import * as SeasonsApi from './seasons';
import * as MatchdaysApi from './matchdays';

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

// ── Familia de playoff: los TROZOS de un mismo cuadro ───────────────────────
// La Federación parte el playoff de una categoría en varios grupos: el cuadro
// grande ("LIGA ORO · 2ª CATEGORIA MASCULINA", 21 cruces) y varias
// eliminatorias de puestos ("… 5º al 8º", "… 3º - 4º", "… 11º al 12º"). No son
// cuadros distintos: son partes del mismo. Aquí se reagrupan para enseñarlos
// juntos en vez de obligar a saltar de uno a otro.
//
// La clave de la familia es el prefijo del id (`fase2`=ORO, `fase3`=PLATA,
// `fase4`=BRONCE, `fase5`=DESCENSO) + género + nº de categoría. Comprobado
// contra los datos reales de la FCP: el prefijo es consistente en toda la liga.

/** "… 5º al 8º" → "Puestos 5º-8º". null si el grupo es el cuadro grande. */
export function placementLabel(nombre: string): string | null {
  const rest = (nombre ?? '').replace(/\d+\s*ª?\s*CATEGORIA/i, ' ');
  const m = rest.match(/(\d+)\s*[ºª°]?\s*(?:al|a|-|–)\s*(\d+)\s*[ºª°]?/i);
  return m ? `Puestos ${m[1]}º-${m[2]}º` : null;
}

/** Nº de categoría del nombre de un grupo ("… 2ª CATEGORIA …" → 2). */
function categoryNo(nombre: string): number | null {
  const m = (nombre ?? '').match(/(\d+)\s*ª\s*CATEGORIA/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Clave de familia de un grupo de playoff: mismo tipo de liga + categoría.
 *  Dos grupos con la misma clave son trozos del MISMO cuadro. */
export function playoffFamilyKey(idGrupo: string, nombre: string): string {
  return `${idGrupo.split('_')[0]}:${categoryNo(nombre) ?? '?'}`;
}

export interface FcpPlayoffPart {
  idGrupo: string;
  nombre: string;
  placement: string | null; // null = cuadro grande
}

/** Todos los grupos de playoff hermanos del que se pasa: mismo tipo de liga
 *  (oro/plata/bronce/descenso), mismo género y misma categoría. El cuadro
 *  grande va primero y luego las eliminatorias de puestos. */
export async function fetchPlayoffFamily(idGrupo: string): Promise<FcpPlayoffPart[]> {
  const { data: me } = await rawFrom('fcp_grupos')
    .select('id_grupo, nombre, genero, id_liga')
    .eq('id_grupo', idGrupo)
    .maybeSingle();
  const self = me as
    | { id_grupo: string; nombre: string | null; genero: string | null; id_liga: number | null }
    | null;
  if (!self) return [{ idGrupo, nombre: '', placement: null }];

  const prefix = idGrupo.split('_')[0]; // fase2 | fase3 | fase4 | fase5
  const cat = categoryNo(self.nombre ?? '');
  let q = rawFrom('fcp_grupos')
    .select('id_grupo, nombre, genero, id_liga')
    .like('id_grupo', `${prefix}_%`);
  if (self.id_liga != null) q = q.eq('id_liga', self.id_liga);
  if (self.genero) q = q.eq('genero', self.genero);
  const { data } = await q;

  const rows = ((data ?? []) as { id_grupo: string; nombre: string | null }[]).filter(
    (g) => cat == null || categoryNo(g.nombre ?? '') === cat,
  );
  const parts: FcpPlayoffPart[] = (rows.length ? rows : [{ id_grupo: idGrupo, nombre: self.nombre }]).map(
    (g) => ({
      idGrupo: g.id_grupo,
      nombre: g.nombre ?? g.id_grupo,
      placement: placementLabel(g.nombre ?? ''),
    }),
  );
  // Cuadro grande primero; luego los puestos, de mejor a peor.
  const firstPos = (p: FcpPlayoffPart) => {
    const m = p.placement?.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };
  return parts.sort((a, b) => firstPos(a) - firstPos(b));
}

/** Cuadro de varios grupos a la vez (una familia): las eliminatorias de puestos
 *  entran como cuadros extra, detrás del principal y su consolación. */
export async function fetchFcpBracketFamily(parts: FcpPlayoffPart[]): Promise<FcpBracket> {
  const cuadros: FcpBracketCuadro[] = [];
  for (const part of parts) {
    const b = await fetchFcpBracket(part.idGrupo);
    for (const q of b.cuadros) {
      if (q.rounds.length === 0) continue;
      cuadros.push(
        part.placement
          ? { ...q, key: `${part.idGrupo}:${q.key}`, label: part.placement }
          : { ...q, key: `${part.idGrupo}:${q.key}`, label: q.label },
      );
    }
  }
  return { cuadros };
}

// ── Los playoff, al HORARIO ─────────────────────────────────────────────────
// Las eliminatorias solo vivían en la vista del cuadro, así que el club no
// podía cuadrar sus pistas para ellas (no existían como jornadas). Esto las
// vuelca a la temporada del equipo.
//
// La SEDE sale de la normativa, no de la Federación —que no la publica de forma
// fiable—: «Todos los enfrentamientos del Play Off se disputarán a ida y vuelta,
// jugando el primero en casa del equipo PEOR clasificado». O sea: ida en casa
// del peor, vuelta en casa del mejor. Y como hay excepciones escritas (finales
// de ORO y PLATA a sede única; 5ª y 6ª masculina a partido único en casa del
// mejor), lo que se guarda es una PROPUESTA: `home_unconfirmed = true`. La
// confirma el club o el capitán.

export interface PlayoffImportResult {
  created: number;
  updated: number; // ya estaban y se les ha puesto el resultado
  skipped: number; // ya estaban y no había nada que cambiar
}

/** Posición en la fase REGULAR de cada equipo de la liga (por nombre). */
async function regularPositions(idLiga: number): Promise<Map<string, number>> {
  const { data } = await rawFrom('fcp_clasificacion')
    .select('equipo, posicion, id_grupo')
    .eq('id_liga', idLiga);
  const out = new Map<string, number>();
  for (const r of (data ?? []) as {
    equipo: string | null;
    posicion: number | null;
    id_grupo: string | null;
  }[]) {
    // Solo la liga regular: en los grupos de fase la posición no significa lo
    // mismo (y es la que estamos intentando resolver).
    if (!r.equipo || r.posicion == null) continue;
    if (r.id_grupo && /^fase/i.test(r.id_grupo)) continue;
    const k = normTeam(r.equipo);
    if (!out.has(k)) out.set(k, r.posicion);
  }
  return out;
}

/**
 * Vuelca al calendario del equipo sus eliminatorias de playoff: dos jornadas
 * por cruce (ida y vuelta) o una sola en las rondas a sede única. Sin fecha —
 * la pone el club— y con la sede como propuesta. Idempotente: los cruces que ya
 * estén (por `fcp_id_partido`) no se duplican.
 */
export async function importPlayoffMatchdays(
  teamId: string,
): Promise<PlayoffImportResult> {
  const fcpId = await getFcpIdEquipo(teamId);
  if (!fcpId) throw new Error('Este equipo no está vinculado a la Federación.');
  const main = await resolveMainGroupOrPrevious(fcpId);
  if (!main) throw new Error('No encuentro tu equipo en la Federación.');

  const { data: g } = await rawFrom('fcp_grupos')
    .select('id_liga, genero')
    .eq('id_grupo', main.id_grupo)
    .maybeSingle();
  const idLiga = g ? ((g as { id_liga: number | null }).id_liga ?? null) : null;
  const genero = g ? ((g as { genero: string | null }).genero ?? null) : null;
  if (idLiga == null) throw new Error('No encuentro la temporada de tu equipo.');

  const groups = await fetchTeamPlayoffGroups(idLiga, main.equipo, genero);
  if (groups.length === 0) return { created: 0, updated: 0, skipped: 0 };

  const { data: rows } = await rawFrom('fcp_partidos')
    .select('id_partido, id_grupo, equipo_local, equipo_visit, avance, ronda, cuadro, estado, fecha_ida, fecha_vuelta, lugar_ida, lugar_vuelta')
    .in('id_grupo', groups.map((x) => x.idGrupo))
    .like('id_partido', 'fcp_playoff_%');

  const me = normTeam(main.equipo);
  const ties = ((rows ?? []) as {
    id_partido: string;
    equipo_local: string | null;
    equipo_visit: string | null;
    avance: number | null;
    ronda: string | null;
    cuadro: string | null;
    estado: string | null;
    fecha_ida: string | null;
    fecha_vuelta: string | null;
    lugar_ida: string | null;
    lugar_vuelta: string | null;
  }[]).filter(
    (r) => normTeam(r.equipo_local) === me || normTeam(r.equipo_visit) === me,
  );
  if (ties.length === 0) return { created: 0, updated: 0, skipped: 0 };

  /**
   * ¿Cuántas mangas tiene un cruce?
   *
   * No lo dice el reglamento y no se puede deducir de la ronda: de las 348
   * finales que hay en la Federación, 180 se jugaron a ida y vuelta y 153 a
   * partido único. Lo dice el estado del cruce, que es lo que el scraper sabe
   * de verdad: `jugado` = las dos mangas, `jugado_ida` = solo una.
   *
   * Mientras está pendiente no hay forma de saberlo, así que se crea la ida y,
   * si aparece una vuelta, entra en el siguiente volcado (el import no duplica:
   * se salta lo que ya tiene `fcp_id_partido`). Para las rondas normales se
   * siguen creando las dos, que es lo que había y le sirve al club para
   * reservar pista.
   *
   * El sufijo SIEMPRE es `ida`/`vuelta`. Antes las finales se guardaban como
   * `_unica`, y ese identificador no existe en ningún sitio: no hay una sola
   * acta con ese sufijo en toda la Federación, así que el acta de la final no
   * llegaba a aparecer nunca.
   */
  const mangasDe = (t: { estado: string | null; avance: number | null }): ('ida' | 'vuelta')[] => {
    if (t.estado === 'jugado') return ['ida', 'vuelta'];
    if (t.estado === 'jugado_ida') return ['ida'];
    return t.avance === 1 ? ['ida'] : ['ida', 'vuelta'];
  };

  // Las actas de todas las mangas de golpe: de ahí sale el marcador, quién fue
  // local y si está jugada. `fcp_partidos.resultado` no sirve para esto — en la
  // final del usuario dice "3-2" y el acta dice 5-0.
  const legIds = ties.flatMap((t) => mangasDe(t).map((m) => `${t.id_partido}_${m}`));
  const { data: actasRaw } = await rawFrom('fcp_actas')
    .select('id_partido, equipo_local, ganador')
    .in('id_partido', legIds)
    .limit(4000);
  const actaPorManga = new Map<string, { equipoLocal: string | null; local: number; visit: number }>();
  for (const a of (actasRaw ?? []) as {
    id_partido: string;
    equipo_local: string | null;
    ganador: string | null;
  }[]) {
    const acc = actaPorManga.get(a.id_partido) ?? {
      equipoLocal: a.equipo_local,
      local: 0,
      visit: 0,
    };
    if (a.ganador === 'local') acc.local += 1;
    else if (a.ganador === 'visitante') acc.visit += 1;
    acc.equipoLocal = acc.equipoLocal ?? a.equipo_local;
    actaPorManga.set(a.id_partido, acc);
  }

  const season = await SeasonsApi.fetchActiveSeason(teamId);
  if (!season) throw new Error('El equipo no tiene temporada activa.');

  // Las finales volcadas antes de arreglar esto quedaron con la clave `_unica`,
  // que no existe en la Federación. Se renombran a `_ida` en vez de dejarlas
  // huérfanas: así se reconocen abajo y se reparan, en lugar de crear una
  // jornada duplicada al lado de la que ya había.
  const { data: antiguas } = await rawFrom('matchdays')
    .select('id, fcp_id_partido')
    .eq('season_id', season.id)
    .like('fcp_id_partido', 'fcp_playoff_%_unica');
  for (const a of (antiguas ?? []) as { id: string; fcp_id_partido: string }[]) {
    await rawFrom('matchdays')
      .update({ fcp_id_partido: a.fcp_id_partido.replace(/_unica$/, '_ida') })
      .eq('id', a.id);
  }

  const existing = await MatchdaysApi.fetchMatchdays(season.id);
  const yaEstan = new Map<
    string,
    { id: string; finished: boolean; conFecha: boolean; conSitio: boolean }
  >();
  for (const m of existing) {
    const key = (m as { fcp_id_partido?: string | null }).fcp_id_partido;
    if (key)
      yaEstan.set(key, {
        id: m.id,
        finished: m.outcome != null,
        conFecha: !!m.match_date,
        conSitio: !!m.location,
      });
  }
  const already = new Set(yaEstan.keys());
  let jornada = existing.reduce((mx, m) => Math.max(mx, m.jornada_number ?? 0), 0);

  const pos = await regularPositions(idLiga);
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Las jornadas nuevas se numeran POR FECHA, no en el orden en que llegan
  // los cruces (la final iba la primera y la ronda 4, jugada un mes antes,
  // la última). Se recogen aquí y se crean al final, ordenadas.
  const toCreate: {
    fcpPartido: string;
    rivalName: string;
    label: string;
    isHome: boolean;
    datos: Record<string, unknown>;
    fecha: string | null;
    hora: string | null;
    avance: number | null;
    suffix: 'ida' | 'vuelta';
  }[] = [];

  for (const t of ties) {
    const rivalName =
      normTeam(t.equipo_local) === me ? t.equipo_visit : t.equipo_local;
    if (!rivalName) continue; // cruce aún sin rival (ronda futura)
    const myPos = pos.get(me);
    const rivalPos = pos.get(normTeam(rivalName));
    // Peor clasificado = número MAYOR. La ida se juega en su casa.
    const iAmWorse =
      myPos != null && rivalPos != null ? myPos > rivalPos : null;

    const mangas = mangasDe(t);
    const legs: { suffix: 'ida' | 'vuelta'; isHome: boolean }[] = mangas.map((suffix) => ({
      suffix,
      // La ida se juega en casa del PEOR clasificado (normativa IV). Solo es
      // una propuesta: si la manga ya se jugó, manda el acta.
      isHome:
        suffix === 'ida' ? (iAmWorse ?? true) : iAmWorse == null ? true : !iAmWorse,
    }));

    for (const leg of legs) {
      const fcpPartido = `${t.id_partido}_${leg.suffix}`;
      const acta = actaPorManga.get(fcpPartido);
      // Un cruce de una sola manga no lleva «· ida»: es el partido, sin más.
      const label = [t.ronda?.trim() || 'Playoff', mangas.length > 1 ? leg.suffix : null]
        .filter(Boolean)
        .join(' · ');

      // Jugada: el acta dice quién fue local y cuántos partidos ganó cada uno
      // (el marcador de un enfrentamiento es «partidos ganados», de 5).
      const jugada = !!acta;
      const soyLocal = acta?.equipoLocal ? normTeam(acta.equipoLocal) === me : leg.isHome;
      const míos = acta ? (soyLocal ? acta.local : acta.visit) : null;
      const suyos = acta ? (soyLocal ? acta.visit : acta.local) : null;

      // Día, hora y pista de ESA manga. La Federación los publica en la ficha
      // del cruce y el scraper los guarda ahí desde siempre; la jornada entraba
      // sin fecha porque el volcado no los leía.
      const { fecha, hora } = parseFechaLarga(
        leg.suffix === 'ida' ? t.fecha_ida : t.fecha_vuelta,
      );
      const lugar = (leg.suffix === 'ida' ? t.lugar_ida : t.lugar_vuelta) || null;

      const resultado = {
        // Si hay acta, la sede ya no es una propuesta: es un hecho.
        home_unconfirmed: !jugada,
        status: jugada ? 'finished' : 'upcoming',
        is_home: jugada ? soyLocal : leg.isHome,
        score_for: míos,
        score_against: suyos,
        outcome:
          míos == null || suyos == null
            ? null
            : míos > suyos
              ? 'win'
              : míos < suyos
                ? 'loss'
                : 'draw',
      };
      const datos = { ...resultado, match_date: fecha, match_time: hora, location: lugar };

      // Ya estaba: volver a volcar REPARA. Es como llegó este error —las
      // eliminatorias entraban como próximas— y saltárselas dejaría a todo el
      // que ya las importó sin forma de arreglarlo desde la app.
      const previa = yaEstan.get(fcpPartido);
      if (previa) {
        // El resultado lo manda el acta, pero el día y la pista SOLO se
        // rellenan si están vacíos: puede haberlos puesto el club a mano
        // mientras la Federación no los publicaba, y eso no se pisa.
        const parche: Record<string, unknown> = {};
        if (jugada && !previa.finished) Object.assign(parche, resultado);
        if (fecha && !previa.conFecha) {
          parche.match_date = fecha;
          if (hora) parche.match_time = hora;
        }
        if (lugar && !previa.conSitio) parche.location = lugar;
        if (Object.keys(parche).length > 0) {
          await rawFrom('matchdays').update(parche).eq('id', previa.id);
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      toCreate.push({
        fcpPartido,
        rivalName,
        label,
        isHome: jugada ? soyLocal : leg.isHome,
        datos,
        fecha,
        hora,
        avance: t.avance,
        suffix: leg.suffix,
      });
    }
  }

  // Primero lo que tiene fecha, en orden; lo que aún no la tiene va detrás
  // por ronda (avance mayor = ronda más temprana) y la ida antes que la vuelta.
  toCreate.sort((a, b) => {
    if (a.fecha && b.fecha) {
      return a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '');
    }
    if (a.fecha) return -1;
    if (b.fecha) return 1;
    const av = (b.avance ?? 0) - (a.avance ?? 0);
    if (av !== 0) return av;
    return a.suffix === b.suffix ? 0 : a.suffix === 'ida' ? -1 : 1;
  });

  for (const n of toCreate) {
    jornada += 1;
    const md = await MatchdaysApi.createMatchday(season.id, {
      jornada_number: jornada,
      opponent: `${n.rivalName} (${n.label})`,
      is_home: n.isHome,
    });
    // Columnas que `createMatchday` no conoce: el vínculo con la FCP, la
    // marca de sede sin confirmar y el resultado. Sin esto las jornadas de
    // playoff entraban SIEMPRE como próximas, aunque estuvieran jugadas y
    // tuviéramos el acta delante.
    await rawFrom('matchdays')
      .update({ fcp_id_partido: n.fcpPartido, ...n.datos })
      .eq('id', md.id);
    created++;
  }
  return { created, updated, skipped };
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

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

/**
 * «domingo, 17 de mayo de 2026 - 17:00» → { fecha: '2026-05-17', hora: '17:00' }
 *
 * La Federación publica la fecha de los playoffs en castellano y en texto
 * largo, no en formato fecha como la de liga, y por manga: `fecha_ida` y
 * `fecha_vuelta`. Comprobado sobre los 3.167 valores que hay: todos siguen
 * este patrón.
 */
function parseFechaLarga(s: string | null | undefined): {
  fecha: string | null;
  hora: string | null;
} {
  const t = (s ?? '').trim().toLowerCase();
  if (!t) return { fecha: null, hora: null };
  const h = t.match(/(\d{1,2}):(\d{2})/);
  const hora = h ? `${h[1].padStart(2, '0')}:${h[2]}` : null;
  const m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (!m) return { fecha: null, hora };
  const mes = MESES[m[2]];
  if (!mes) return { fecha: null, hora };
  return {
    fecha: `${m[3]}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`,
    hora,
  };
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
  const main = await resolveMainGroupOrPrevious(fcpId);
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
