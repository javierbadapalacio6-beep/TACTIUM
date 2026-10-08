/**
 * Importar equipos de la Federación Cántabra (FCP) — port de
 * `TACTIUM/src/core/services/fcpOnboarding.ts` (buscar + volcar).
 *
 * Lee el catálogo federativo espejado en las tablas `fcp_*` (las mismas que usa
 * el explorador de /federacion) y crea equipos TACTIUM con su plantilla real y
 * sus puntos. Las escrituras pasan por el llamador (guardedWrite).
 *
 * REGLA: esto se comporta IGUAL que la app. Si se cambia una de las dos, se cambia la otra.
 * La agrupación por club vive aparte (`fcp-club-grouping.ts`, código puro) para poder
 * comprobarla contra el catálogo real.
 */
import { supabaseBrowser } from "@/lib/supabase/client";
import { createTeam } from "@/lib/queries";
import { FCP_FEDERATION_CODE } from "@/lib/federations";
import {
  NON_TEAM_ROW,
  categoryOf,
  clubOf,
  genderOf,
  groupByClub,
} from "@/lib/fcp-club-grouping";

const FCP_LEAGUE = "Liga Cántabra de Pádel";

export interface FcpTeamOption {
  id_equipo: number;
  /** Liga/temporada a la que pertenece. */
  id_liga: number | null;
  equipo: string; // "CENTRAL PADEL A"
  club: string; // "CENTRAL PADEL"
  grupo: string;
  gender: string; // masculino | femenino
  category: string | null; // "1ª"…
}
export interface FcpClubGroup {
  club: string;
  teams: FcpTeamOption[];
}

// Se pregunta en cada búsqueda, o sea a cada tecleo, y la respuesta solo cambia cuando la
// Federación publica el calendario de la temporada siguiente: una vez al año.
let ligaCache: { at: number; value: number | null } | null = null;
const LIGA_TTL_MS = 5 * 60 * 1000;

/**
 * Liga ACTUAL = la que se está jugando, NO la más nueva que exista.
 *
 * Antes la web cogía la de mayor id en la clasificación, y eso se rompe en cuanto la
 * Federación abre las inscripciones de la temporada siguiente: esa liga nace con sus equipos
 * meses antes de tener un solo partido, así que un club que importase a mitad de temporada se
 * traía los equipos del año que viene, con sus letras y categorías nuevas. La que se juega es
 * la de mayor id CON PARTIDOS (misma lógica que la app: `fetchCurrentLiga`).
 */
export async function fetchCurrentLiga(): Promise<number | null> {
  if (ligaCache && Date.now() - ligaCache.at < LIGA_TTL_MS) return ligaCache.value;
  const sb = supabaseBrowser();
  const { data } = await sb
    .from("fcp_partidos")
    .select("id_liga")
    .order("id_liga", { ascending: false })
    .limit(1)
    .maybeSingle();
  const value = data ? ((data as { id_liga: number }).id_liga ?? null) : null;
  ligaCache = { at: Date.now(), value };
  return value;
}

// Catálogo de la liga actual: lo mismo para todos y casi nunca cambia, así que se lee una vez
// y se filtra en local (la app hace igual). Cada tecleo del buscador ya no son tres consultas.
let catalogCache: { liga: number; at: number; opts: FcpTeamOption[] } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;

async function loadCatalog(): Promise<FcpTeamOption[]> {
  const currentLiga = await fetchCurrentLiga();
  if (currentLiga == null) return [];
  if (
    catalogCache &&
    catalogCache.liga === currentLiga &&
    Date.now() - catalogCache.at < CATALOG_TTL_MS
  ) {
    return catalogCache.opts;
  }

  const sb = supabaseBrowser();
  const { data: clasif, error } = await sb
    .from("fcp_clasificacion")
    .select("id_equipo, equipo, id_grupo, id_liga")
    .eq("id_liga", currentLiga);
  if (error) throw error;
  const { data: grupos } = await sb
    .from("fcp_grupos")
    .select("id_grupo, nombre, genero")
    .eq("id_liga", currentLiga);
  const gById = new Map(
    ((grupos ?? []) as { id_grupo: string; nombre: string; genero: string }[]).map(
      (g) => [g.id_grupo, g],
    ),
  );

  const seen = new Set<number>();
  const opts: FcpTeamOption[] = [];
  for (const row of (clasif ?? []) as {
    id_equipo: number | null;
    equipo: string | null;
    id_grupo: string | null;
    id_liga: number | null;
  }[]) {
    if (row.id_equipo == null || !row.equipo || seen.has(row.id_equipo)) continue;
    // "EXENTO", "Eliminatoria"… son huecos del cuadro, no equipos.
    if (NON_TEAM_ROW.test(row.equipo.trim())) continue;
    // Saltar grupos de playoff (fase): el equipo se importa por su liga regular.
    if (typeof row.id_grupo === "string" && /^fase/i.test(row.id_grupo)) continue;
    seen.add(row.id_equipo);
    const g = row.id_grupo ? gById.get(row.id_grupo) : undefined;
    opts.push({
      id_equipo: row.id_equipo,
      id_liga: row.id_liga ?? null,
      equipo: row.equipo,
      club: clubOf(row.equipo),
      grupo: g?.nombre ?? "",
      gender: genderOf(g?.genero ?? null),
      category: categoryOf(g?.nombre ?? null),
    });
  }
  catalogCache = { liga: currentLiga, at: Date.now(), opts };
  return opts;
}

/** Busca clubes/equipos federativos por nombre (typeahead), agrupados por club.
 *  Solo la temporada ACTUAL y su liga regular (sin playoff). Clubes que la Federación escribe
 *  con nombres distintos salen fundidos en uno. */
export async function searchFcpClubs(query: string): Promise<FcpClubGroup[]> {
  return groupByClub(await loadCatalog(), query);
}

export interface FcpImportResult {
  teamId: string;
  equipo: string;
  players: number;
}

/**
 * Modo de importación, igual que en la app:
 *
 *  · `owned` → equipos DEL club: `club_id`, con su plantilla. Gestión completa
 *    y consumen cuota del plan.
 *  · `venue` → equipos INVITADOS: juegan en sus pistas sin ser suyos. Se
 *    guarda `venue_club_id`, que da permiso de horario y nada más, y NO se
 *    vuelca la plantilla — son jugadores de otro club y sus datos no pintan
 *    nada en esta cuenta.
 */
export type FcpImportMode = "owned" | "venue";

/** Equipo del club (o independiente) que AÚN NO está vinculado a la Federación:
 *  candidato a ser «sustituido» por un equipo federado al importar, en vez de duplicarlo. */
export interface UnlinkedTeam {
  id: string;
  name: string;
  gender: string | null;
  category: string | null;
  group: string | null;
}

/**
 * Equipos del usuario (del club, o independientes si `clubId` es null) que todavía NO tienen
 * vínculo con la Federación. Se ofrecen para «sustituir» al importar y no duplicar lo creado
 * a mano.
 *
 * Con `clubId` null se piden solo los que son MÍOS y no son invitados de nadie: la RLS deja
 * ver más equipos (donde soy jugador) y los invitados también tienen `club_id` nulo, y
 * ofrecer «sustituir» uno que no es mío acabaría en una escritura rechazada.
 */
export async function fetchUnlinkedClubTeams(clubId: string | null): Promise<UnlinkedTeam[]> {
  const sb = supabaseBrowser();
  let q = sb.from("teams").select("id, name, gender, category, group_name, club_id");
  if (clubId) {
    q = q.eq("club_id", clubId);
  } else {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return [];
    q = q.is("club_id", null).is("venue_club_id", null).eq("owner_id", user.id);
  }
  const { data: teams, error } = await q;
  if (error) throw error;
  const list = (teams ?? []) as {
    id: string;
    name: string;
    gender: string | null;
    category: string | null;
    group_name: string | null;
  }[];
  if (!list.length) return [];
  const { data: links } = await sb
    .from("fcp_team_links")
    .select("team_id")
    .in(
      "team_id",
      list.map((t) => t.id),
    );
  const linked = new Set(((links ?? []) as { team_id: string }[]).map((l) => l.team_id));
  return list
    .filter((t) => !linked.has(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      gender: t.gender,
      category: t.category,
      group: t.group_name,
    }));
}

/**
 * El equipo tuyo creado a mano que más se parece a un equipo federado elegido: mismo género y
 * categoría y que no se haya usado ya; si hay varios, el que lleva en su grupo la letra del
 * grupo federativo (desambigua «A» y «B» del mismo nivel). null si no hay candidato. Misma
 * regla que la app (`FcpImportSheet.doImport`). Quien llama marca el candidato como usado SOLO
 * si el usuario acepta sustituir.
 */
export function buscarSustituto(
  opt: FcpTeamOption,
  candidatos: UnlinkedTeam[],
  usados: Set<string>,
): UnlinkedTeam | null {
  const pool = candidatos.filter(
    (t) =>
      !usados.has(t.id) &&
      (t.gender ?? "") === opt.gender &&
      (t.category ?? "") === (opt.category ?? ""),
  );
  if (!pool.length) return null;
  const fedGroup = (opt.grupo ?? "").toUpperCase();
  return pool.find((t) => t.group && fedGroup.includes(t.group.toUpperCase())) ?? pool[0];
}

/**
 * Equipo YA vinculado a este id federado que sea MÍO en el sentido que toca: del club que
 * importa, invitado de su sede, o el equipo suelto del capitán. null si no hay ninguno. La RLS
 * ya limita lo que se puede ver; esto además evita reutilizar el equipo de otro club.
 *
 * La búsqueda no puede ser global: al mismo equipo federado lo importan varios clubes.
 */
async function findMyLinkedTeam(
  fcpIdEquipo: number,
  clubId: string | null,
  guest: boolean,
): Promise<string | null> {
  const sb = supabaseBrowser();
  const { data: links } = await sb
    .from("fcp_team_links")
    .select("team_id")
    .eq("fcp_id_equipo", fcpIdEquipo)
    .limit(200);
  const ids = ((links ?? []) as { team_id: string | null }[])
    .map((l) => l.team_id)
    .filter((x): x is string => !!x);
  if (ids.length === 0) return null;

  const { data: teams } = await sb
    .from("teams")
    .select("id, club_id, venue_club_id")
    .in("id", ids);
  const rows = (teams ?? []) as {
    id: string;
    club_id: string | null;
    venue_club_id: string | null;
  }[];

  const mine = rows.find((t) => {
    if (guest) return t.venue_club_id === clubId;
    if (clubId) return t.club_id === clubId;
    // Capitán sin club: su equipo suelto, no el invitado de nadie.
    return t.club_id === null && t.venue_club_id === null;
  });
  return mine?.id ?? null;
}

/** Datos oficiales del equipo federado, tal como los pone la app al importar. */
function canonicalOf(t: FcpTeamOption) {
  return {
    name: t.equipo,
    federation: FCP_FEDERATION_CODE,
    league: FCP_LEAGUE,
    category: t.category ?? null,
    gender: t.gender,
  };
}

async function updateTeamRow(
  teamId: string,
  patch: Record<string, string | null>,
): Promise<void> {
  const { error } = await supabaseBrowser().from("teams").update(patch).eq("id", teamId);
  if (error) throw error;
}

/**
 * Deja el equipo vinculado a ESTE id federado, con un solo vínculo (índice único por equipo,
 * 26-09-2026). Tres casos:
 *
 *  · sin vínculo → se inserta;
 *  · ya vinculado a este mismo id → no hay nada que hacer;
 *  · vinculado a OTRO id (p. ej. «Preparar temporada» lo apuntó a la inscripción del año que
 *    viene) → hay que sustituirlo. `fcp_team_links` solo tiene políticas de lectura e
 *    inserción: un `delete` desde el cliente no borra nada y el insert posterior chocaba con
 *    el índice único. Lo hace `apply_fcp_season_update` (SECURITY DEFINER, comprueba que el
 *    equipo es tuyo o de tu club): borra el vínculo viejo, inserta el nuevo y, sin listas de
 *    jugadores, no toca la plantilla.
 */
async function linkTeamToFcp(teamId: string, fcpIdEquipo: number): Promise<void> {
  const sb = supabaseBrowser();
  const { data: cur, error: curErr } = await sb
    .from("fcp_team_links")
    .select("fcp_id_equipo")
    .eq("team_id", teamId)
    .limit(1);
  if (curErr) throw curErr;
  const have = ((cur ?? []) as { fcp_id_equipo: number }[])[0]?.fcp_id_equipo ?? null;
  if (have === fcpIdEquipo) return;

  if (have == null) {
    const { data: t } = await sb.from("teams").select("club_id").eq("id", teamId).maybeSingle();
    const { error } = await sb.from("fcp_team_links").insert({
      fcp_id_equipo: fcpIdEquipo,
      team_id: teamId,
      club_id: (t as { club_id: string | null } | null)?.club_id ?? null,
    });
    if (error) throw error;
    return;
  }

  const { error } = await sb.rpc("apply_fcp_season_update", {
    p_team_id: teamId,
    p_new_fcp_id_equipo: fcpIdEquipo,
  });
  if (error) throw error;
}

/**
 * Crea (o REUTILIZA) un equipo TACTIUM por cada equipo federativo elegido, con su vínculo y su
 * plantilla real volcada (nombre + puntos vía RPC `import_fcp_roster`) y su temporada.
 *
 * `reuse` mapea `fcp_id_equipo → id de un equipo YA creado a mano` que el usuario decidió
 * sustituir: en vez de crear otro, se vincula ese equipo, se actualizan sus datos a los
 * oficiales y se le vuelca la plantilla. Además hay idempotencia: si un equipo federado YA es
 * mío, se reutiliza (no se duplica al reimportar) y se refrescan sus datos y su plantilla.
 */
export async function importFcpTeams(
  clubId: string | null,
  selected: FcpTeamOption[],
  mode: FcpImportMode = "owned",
  reuse: Record<number, string> = {},
): Promise<FcpImportResult[]> {
  const sb = supabaseBrowser();
  const guest = mode === "venue";
  const out: FcpImportResult[] = [];
  for (const t of selected) {
    const canonical = canonicalOf(t);

    // 1) ¿YO ya tengo un equipo vinculado a este id federado? → reutilízalo (reimportar no
    //    duplica) y refresca sus datos oficiales.
    const mineTeamId = await findMyLinkedTeam(t.id_equipo, clubId, guest);

    let teamId: string;
    if (mineTeamId) {
      teamId = mineTeamId;
      await updateTeamRow(teamId, canonical);
      if (guest) await updateTeamRow(teamId, { venue_club_id: clubId });
    } else if (guest) {
      // Invitado: sin club_id (no consume cuota) y con la sede apuntada.
      teamId = await createTeam({
        name: t.equipo,
        federation: FCP_FEDERATION_CODE,
        league: FCP_LEAGUE,
        category: t.category ?? undefined,
        gender: t.gender,
        // Excluyente a propósito: un invitado NO es del club.
        venueClubId: clubId,
      });
      const { error: linkErr } = await sb
        .from("fcp_team_links")
        .insert({ fcp_id_equipo: t.id_equipo, team_id: teamId, club_id: null });
      if (linkErr) throw linkErr;
    } else if (reuse[t.id_equipo]) {
      // 2) El usuario decidió sustituir un equipo suyo creado a mano.
      teamId = reuse[t.id_equipo];
      await updateTeamRow(teamId, { ...canonical, club_id: clubId });
      await linkTeamToFcp(teamId, t.id_equipo);
    } else {
      // 3) Sin coincidencia: crea uno nuevo.
      teamId = await createTeam({
        name: t.equipo,
        federation: FCP_FEDERATION_CODE,
        league: FCP_LEAGUE,
        category: t.category ?? undefined,
        gender: t.gender,
        clubId: clubId ?? undefined,
      });
      const { error: linkErr } = await sb
        .from("fcp_team_links")
        .insert({ fcp_id_equipo: t.id_equipo, team_id: teamId, club_id: clubId });
      if (linkErr) throw linkErr;
    }

    // La plantilla SOLO para equipos propios: en un invitado estaríamos metiendo jugadores de
    // otro club en esta cuenta. También al reimportar: el RPC salta a los ya vinculados y solo
    // añade los nuevos.
    let players = 0;
    if (!guest) {
      const { data: added, error } = await sb.rpc("import_fcp_roster", {
        p_team_id: teamId,
        p_fcp_id_equipo: t.id_equipo,
      });
      if (error) throw error;
      players = (added as number) ?? 0;
    }

    // Vuelca también la temporada (calendario + resultados), y para los invitados también: sin
    // jornadas el equipo se da de alta y no aparece por ningún lado. No bloquea el alta si
    // falla (el equipo ya está vinculado y se puede rehacer). Si el id es una inscripción sin
    // grupos, el RPC puede caer a la temporada anterior; y si ya la tiene en el histórico
    // responde «ya está en tu histórico» y no duplica: ese error se ignora a propósito.
    try {
      await sb.rpc("import_fcp_season", {
        p_team_id: teamId,
        p_fcp_id_equipo: t.id_equipo,
        p_season_name: FCP_LEAGUE,
      });
    } catch {
      /* no bloqueante */
    }

    out.push({ teamId, equipo: t.equipo, players });
  }
  return out;
}

/**
 * Vuelca la plantilla federativa en un equipo QUE YA EXISTE.
 *
 * Distinto de `importFcpTeams`, que CREA equipos: esto es para el capitán que ya tiene su
 * equipo montado en TACTIUM y quiere traerse los jugadores con sus puntos oficiales. Es el
 * «Sustituir» de la app: el equipo pasa a llevar los datos oficiales, un solo vínculo con el
 * equipo federado elegido, su plantilla y su temporada.
 *
 * `import_fcp_roster` comprueba permisos (dueño del equipo o del club) y SALTA a los jugadores
 * ya vinculados, así que repetir no duplica a nadie.
 */
export async function importFcpRosterIntoTeam(
  teamId: string,
  team: FcpTeamOption,
): Promise<number> {
  const sb = supabaseBrowser();

  await updateTeamRow(teamId, canonicalOf(team));
  // Un equipo tiene UN vínculo (ver `linkTeamToFcp`). Antes se hacía un upsert con
  // `ignoreDuplicates` sobre (fcp_id_equipo, team_id): valía con la clave primaria antigua,
  // pero con el índice único por equipo, un equipo ya vinculado a otro id federado fallaba con
  // «duplicate key value violates unique constraint "fcp_team_links_team_unique"».
  await linkTeamToFcp(teamId, team.id_equipo);

  const { data, error } = await sb.rpc("import_fcp_roster", {
    p_team_id: teamId,
    p_fcp_id_equipo: team.id_equipo,
  });
  if (error) throw error;

  // La temporada también, igual que la app al sustituir. No bloquea.
  try {
    await sb.rpc("import_fcp_season", {
      p_team_id: teamId,
      p_fcp_id_equipo: team.id_equipo,
      p_season_name: FCP_LEAGUE,
    });
  } catch {
    /* no bloqueante */
  }

  return (data as number) ?? 0;
}
