"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Perfiles públicos y sugerencias de gente a la que seguir.
 *
 * El perfil de otro usuario no se lee de `profiles` (la RLS solo deja el
 * propio): se pide a la RPC `get_public_user_profile(target uuid)`, la misma
 * que usa la ficha pública `/u/:id`.
 */

export interface PublicPerson {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

/** Ruta de la ficha pública. La página `/u/[username]` recibe el id del
 *  usuario (es lo que espera la RPC). */
export const profileHref = (userId: string) => `/u/${userId}`;

/**
 * Perfiles públicos de varios usuarios, en paralelo. Un fallo en uno (o la
 * RPC entera) no rompe nada: ese usuario simplemente no viene en el mapa.
 */
export async function fetchPublicPeople(userIds: string[]): Promise<Map<string, PublicPerson>> {
  const ids = [...new Set(userIds.filter(Boolean))].slice(0, 60);
  const out = new Map<string, PublicPerson>();
  if (ids.length === 0) return out;
  const sb = supabaseBrowser();
  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        const { data, error } = await sb.rpc("get_public_user_profile", { target: id });
        if (error) return null;
        const p = (Array.isArray(data) ? data[0] : data) as
          | { username?: string | null; full_name?: string | null; avatar_url?: string | null }
          | null;
        if (!p) return null;
        return {
          id,
          username: p.username?.trim() || null,
          fullName: p.full_name?.trim() || null,
          avatarUrl: p.avatar_url ?? null,
        } satisfies PublicPerson;
      } catch {
        return null;
      }
    })
  );
  for (const r of rows) if (r) out.set(r.id, r);
  return out;
}

/* ── Gente que conoces ─────────────────────────────────────────── */
export interface PersonSuggestion {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  /** De dónde le conoces: compañero de equipo o miembro de tu club. */
  source: "team" | "club";
  /** Ya le sigues (se pinta «Siguiendo»). La lista excluye a quien ya sigues,
   *  pero el estado se mantiene al pulsar «Seguir». */
  following: boolean;
}

/**
 * Compañeros de tus equipos (fichas con cuenta `players.user_id` y
 * `team_members`) y miembros de tus clubes con cuenta, sin ti y sin quien ya
 * sigues. Orden: equipo primero, luego club. Máximo `limit` (8 por defecto).
 *
 * Cada consulta que falle (RLS, red) cuenta como vacía: la sección es un
 * extra, nunca debe tumbar el feed.
 */
export async function fetchPeopleYouKnow(
  me: string,
  teamIds: string[],
  clubIds: string[],
  limit = 8,
): Promise<PersonSuggestion[]> {
  const sb = supabaseBrowser();
  const safe = async <T,>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
    try {
      const { data, error } = await p;
      return error ? [] : (data ?? []);
    } catch {
      return [];
    }
  };

  // Clubes: los que administras más los de tus equipos.
  const teamClubs =
    teamIds.length > 0
      ? await safe<{ club_id: string | null }>(
          sb.from("teams").select("club_id").in("id", teamIds)
        )
      : [];
  const allClubs = [
    ...new Set([...clubIds, ...teamClubs.map((t) => t.club_id).filter((c): c is string => !!c)]),
  ];

  const [players, members, clubMembers, follows] = await Promise.all([
    teamIds.length > 0
      ? safe<{ user_id: string | null; name: string | null }>(
          sb.from("players").select("user_id, name").in("team_id", teamIds).not("user_id", "is", null)
        )
      : Promise.resolve([]),
    teamIds.length > 0
      ? safe<{ user_id: string | null }>(
          sb.from("team_members").select("user_id").in("team_id", teamIds)
        )
      : Promise.resolve([]),
    allClubs.length > 0
      ? safe<{ user_id: string | null }>(
          sb.from("club_members").select("user_id").in("club_id", allClubs)
        )
      : Promise.resolve([]),
    safe<{ target_id: string }>(
      sb.from("follows").select("target_id").eq("follower_id", me).eq("target_type", "user")
    ),
  ]);

  const followed = new Set(follows.map((f) => f.target_id));
  const fichaName = new Map<string, string>();
  for (const p of players) if (p.user_id && p.name && !fichaName.has(p.user_id)) fichaName.set(p.user_id, p.name);

  const ordered: { id: string; source: "team" | "club" }[] = [];
  const seen = new Set<string>([me]);
  const push = (id: string | null, source: "team" | "club") => {
    if (!id || seen.has(id) || followed.has(id)) return;
    seen.add(id);
    ordered.push({ id, source });
  };
  for (const p of players) push(p.user_id, "team");
  for (const m of members) push(m.user_id, "team");
  for (const m of clubMembers) push(m.user_id, "club");

  // Se piden algunos perfiles de más por si alguno falla.
  const pick = ordered.slice(0, limit + 4);
  const people = await fetchPublicPeople(pick.map((p) => p.id)).catch(
    () => new Map<string, PublicPerson>()
  );

  const out: PersonSuggestion[] = [];
  for (const p of pick) {
    const prof = people.get(p.id);
    const name = prof?.fullName || prof?.username || fichaName.get(p.id) || null;
    // Sin perfil público ni ficha no hay nada que enseñar ni a dónde enlazar.
    if (!prof || !name) continue;
    out.push({
      id: p.id,
      name,
      username: prof.username,
      avatarUrl: prof.avatarUrl,
      source: p.source,
      following: false,
    });
    if (out.length >= limit) break;
  }
  return out;
}
