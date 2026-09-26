"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabaseBrowser } from "./supabase/client";

/**
 * Sesión real contra Supabase.
 *
 * El rol NO se elige: se DERIVA de lo que el usuario es en la base de datos,
 * con la misma jerarquía que la app móvil:
 *
 *   club    → pertenece a `club_members` (el único club_role es 'admin')
 *   capitan → tiene `team_members.role` en ('captain','admin')
 *   jugador → pertenece a algún equipo como 'player'
 *   suelto  → no pertenece a ningún equipo, o `profiles.solo_mode`
 *
 * Todas esas consultas van bajo RLS, así que sólo devuelven lo del propio
 * usuario aunque alguien manipule el cliente.
 */
export type Role = "capitan" | "club" | "jugador" | "suelto";

export const ROLE_LABELS: Record<Role, string> = {
  capitan: "Capitán",
  club: "Club · admin",
  jugador: "Jugador de equipo",
  suelto: "Jugador suelto",
};

/** Rótulo corto del rol, en frase normal (el panel ya no usa MAYÚSCULAS). */
const ROLE_SHORT: Record<Role, string> = {
  capitan: "Capitán",
  club: "Club · admin",
  jugador: "Jugador",
  suelto: "Jugador",
};

export interface TeamRef {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  clubId: string | null;
  role: string;
}

export interface ClubRef {
  id: string;
  name: string;
}

export interface SessionUser {
  id: string;
  name: string;
  /** Nombre corto único (`profiles.username`). null si aún no ha puesto uno. */
  username: string | null;
  initials: string;
  email: string | null;
  avatarUrl: string | null;
  roleLabel: string;
  roleIsPrivileged: boolean;
}

interface SessionValue {
  /** null = no hay sesión. */
  user: SessionUser | null;
  /** Rol con el que se está usando la app (puede ser elegido, ver `setRole`). */
  role: Role;
  /** Los roles que el usuario REALMENTE tiene, de más a menos privilegio. */
  availableRoles: Role[];
  /** Cambia de rol. Se ignora si el usuario no tiene ese rol de verdad. */
  setRole: (role: Role) => void;
  teams: TeamRef[];
  activeTeam: TeamRef | null;
  setActiveTeam: (id: string) => void;
  /** Todos los clubes que administra el usuario, por nombre. */
  clubs: ClubRef[];
  /** El club sobre el que actúan las pantallas de club. */
  clubId: string | null;
  setActiveClub: (id: string) => void;
  /** false mientras se resuelve la sesión y el rol. */
  ready: boolean;
  /** Recarga perfil, equipos y clubes (tras editar el perfil, por ejemplo). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const ACTIVE_TEAM_KEY = "tactium-active-team";
const ACTIVE_CLUB_KEY = "tactium-active-club";
const ACTIVE_ROLE_KEY = "tactium-active-role";

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "··"
  );
}

export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  /**
   * Lo que el servidor sabe de la sesión al pintar. `null` = visitante: el
   * contexto nace ya resuelto y la portada pública se renderiza en servidor
   * (antes llegaba un spinner hasta que el cliente preguntaba a Supabase).
   * Con usuario se espera a cargar perfil y roles, como siempre.
   */
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [derivedRole, setDerivedRole] = useState<Role>("suelto");
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [roleOverride, setRoleOverride] = useState<Role | null>(null);
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [clubs, setClubs] = useState<ClubRef[]>([]);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [ready, setReady] = useState(initialUser === null);

  const loadFor = useCallback(async (authUser: User | null) => {
    const sb = supabaseBrowser();

    if (!authUser) {
      setUser(null);
      setDerivedRole("suelto");
      setAvailableRoles([]);
      setRoleOverride(null);
      setTeams([]);
      setClubs([]);
      setActiveClubId(null);
      setReady(true);
      return;
    }

    // Perfil, equipos y clubes en paralelo: son independientes entre sí.
    const [profileRes, membershipRes, clubRes] = await Promise.all([
      sb
        .from("profiles")
        .select("full_name, email, avatar_url, solo_mode, username")
        .eq("id", authUser.id)
        .maybeSingle(),
      sb
        .from("team_members")
        .select("role, teams(id, name, category, gender, club_id)")
        .eq("user_id", authUser.id),
      sb
        .from("club_members")
        .select("club_id, clubs(id, name)")
        .eq("user_id", authUser.id),
    ]);

    const profile = profileRes.data;
    const name =
      profile?.full_name?.trim() ||
      profile?.username?.trim() ||
      authUser.email?.split("@")[0] ||
      "Jugador";

    // `teams` llega como objeto embebido; el tipado de PostgREST lo da como
    // array cuando la relación es ambigua, así que se normaliza.
    const rows = (membershipRes.data ?? []) as unknown as {
      role: string;
      teams: {
        id: string;
        name: string;
        category: string | null;
        gender: string | null;
        club_id: string | null;
      } | null;
    }[];

    const myTeams: TeamRef[] = rows
      .filter((r) => r.teams)
      .map((r) => ({
        id: r.teams!.id,
        name: r.teams!.name,
        category: r.teams!.category,
        gender: r.teams!.gender,
        clubId: r.teams!.club_id,
        role: r.role,
      }));

    // Antes se cogía `clubRes.data[0].club_id` sin ordenar: con dos clubes te
    // tocaba el que devolviera Postgres y no había forma de cambiarlo. Ahora se
    // cargan todos y el usuario elige (la elección se guarda en el navegador).
    const clubRows = (clubRes.data ?? []) as unknown as {
      club_id: string;
      clubs: { id: string; name: string } | { id: string; name: string }[] | null;
    }[];
    const myClubs: ClubRef[] = clubRows
      .map((r) => {
        const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs;
        return c ? { id: c.id, name: c.name } : null;
      })
      .filter((c): c is ClubRef => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    const myClub = myClubs[0]?.id ?? null;
    const isCaptain = myTeams.some(
      (t) => t.role === "captain" || t.role === "admin"
    );

    const derived: Role = myClub
      ? "club"
      : isCaptain
        ? "capitan"
        : myTeams.length > 0
          ? "jugador"
          : "suelto";

    setUser({
      id: authUser.id,
      name,
      username: profile?.username ?? null,
      initials: initialsOf(name),
      email: profile?.email ?? authUser.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      roleLabel: ROLE_SHORT[derived],
      roleIsPrivileged: derived === "capitan" || derived === "club",
    });
    setDerivedRole(derived);

    // Quien administra un club Y es capitán de un equipo hace dos trabajos
    // distintos; la jerarquía sola le dejaba encerrado en la vista de club.
    const roles: Role[] = [];
    if (myClubs.length > 0) roles.push("club");
    if (isCaptain) roles.push("capitan");
    if (myTeams.length > 0) roles.push("jugador");
    if (roles.length === 0) roles.push("suelto");
    setAvailableRoles(roles);

    let storedRole: string | null = null;
    try {
      storedRole = localStorage.getItem(ACTIVE_ROLE_KEY);
    } catch {
      /* sin persistencia */
    }
    setRoleOverride(
      storedRole && roles.includes(storedRole as Role)
        ? (storedRole as Role)
        : null
    );
    setTeams(myTeams);
    setClubs(myClubs);

    let storedClub: string | null = null;
    try {
      storedClub = localStorage.getItem(ACTIVE_CLUB_KEY);
    } catch {
      /* sin persistencia */
    }
    setActiveClubId(
      storedClub && myClubs.some((c) => c.id === storedClub)
        ? storedClub
        : myClub
    );

    // Equipo activo: el guardado si sigue siendo suyo, si no el primero.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACTIVE_TEAM_KEY);
    } catch {
      /* sin persistencia */
    }
    setActiveTeamId(
      stored && myTeams.some((t) => t.id === stored)
        ? stored
        : (myTeams[0]?.id ?? null)
    );
    setReady(true);
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    let alive = true;

    sb.auth.getUser().then(({ data }) => {
      if (alive) void loadFor(data.user ?? null);
    });

    // Recarga el contexto en login, logout y refresco de token.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (alive) void loadFor(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadFor]);

  const setRole = useCallback((next: Role) => {
    setRoleOverride(next);
    try {
      localStorage.setItem(ACTIVE_ROLE_KEY, next);
    } catch {
      /* sin persistencia */
    }
  }, []);

  const setActiveClub = useCallback((id: string) => {
    setActiveClubId(id);
    try {
      localStorage.setItem(ACTIVE_CLUB_KEY, id);
    } catch {
      /* sin persistencia */
    }
  }, []);

  const setActiveTeam = useCallback((id: string) => {
    setActiveTeamId(id);
    try {
      localStorage.setItem(ACTIVE_TEAM_KEY, id);
    } catch {
      /* sin persistencia */
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabaseBrowser().auth.getUser();
    await loadFor(data.user ?? null);
  }, [loadFor]);

  const signOut = useCallback(async () => {
    try {
      await supabaseBrowser().auth.signOut();
    } catch {
      /* aunque falle, forzamos el estado deslogueado con la recarga */
    }
    // Recarga completa a la portada con el flag ?signedout=1: limpia el estado
    // del servidor (cookies) y dispara el aviso "Sesión cerrada" en el destino.
    if (typeof window !== "undefined") window.location.href = "/?signedout=1";
  }, []);

  // El override sólo vale si sigue siendo un rol suyo: si le quitan de capitán,
  // no puede quedarse mirando una vista que ya no le corresponde.
  const role: Role = useMemo(
    () =>
      roleOverride && availableRoles.includes(roleOverride)
        ? roleOverride
        : derivedRole,
    [roleOverride, availableRoles, derivedRole]
  );

  // El rótulo tiene que seguir al rol ELEGIDO, no al derivado: si no, cambias a
  // capitán, el menú cambia y el cartel sigue diciendo «CLUB · ADMIN».
  const shownUser = useMemo(
    () =>
      user
        ? {
            ...user,
            roleLabel: ROLE_SHORT[role],
            roleIsPrivileged: role === "capitan" || role === "club",
          }
        : null,
    [user, role]
  );

  const clubId = useMemo(
    () =>
      clubs.find((c) => c.id === activeClubId)?.id ?? clubs[0]?.id ?? null,
    [clubs, activeClubId]
  );

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? teams[0] ?? null,
    [teams, activeTeamId]
  );

  return (
    <SessionContext.Provider
      value={{
        user: shownUser,
        role,
        availableRoles,
        setRole,
        teams,
        activeTeam,
        setActiveTeam,
        clubs,
        clubId,
        setActiveClub,
        ready,
        refresh,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
