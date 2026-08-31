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

const ROLE_EYEBROW: Record<Role, string> = {
  capitan: "CAPITÁN",
  club: "CLUB · ADMIN",
  jugador: "JUGADOR",
  suelto: "JUGADOR",
};

export interface TeamRef {
  id: string;
  name: string;
  category: string | null;
  gender: string | null;
  clubId: string | null;
  role: string;
}

export interface SessionUser {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  avatarUrl: string | null;
  roleLabel: string;
  roleIsPrivileged: boolean;
}

interface SessionValue {
  /** null = no hay sesión. */
  user: SessionUser | null;
  role: Role;
  teams: TeamRef[];
  activeTeam: TeamRef | null;
  setActiveTeam: (id: string) => void;
  clubId: string | null;
  /** false mientras se resuelve la sesión y el rol. */
  ready: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const ACTIVE_TEAM_KEY = "tactium-active-team";

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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [role, setRole] = useState<Role>("suelto");
  const [teams, setTeams] = useState<TeamRef[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const loadFor = useCallback(async (authUser: User | null) => {
    const sb = supabaseBrowser();

    if (!authUser) {
      setUser(null);
      setRole("suelto");
      setTeams([]);
      setClubId(null);
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
      sb.from("club_members").select("club_id").eq("user_id", authUser.id),
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

    const myClub = clubRes.data?.[0]?.club_id ?? null;
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
      initials: initialsOf(name),
      email: profile?.email ?? authUser.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      roleLabel: ROLE_EYEBROW[derived],
      roleIsPrivileged: derived === "capitan" || derived === "club",
    });
    setRole(derived);
    setTeams(myTeams);
    setClubId(myClub);

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

  const setActiveTeam = useCallback((id: string) => {
    setActiveTeamId(id);
    try {
      localStorage.setItem(ACTIVE_TEAM_KEY, id);
    } catch {
      /* sin persistencia */
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabaseBrowser().auth.signOut();
    } catch {
      /* aunque falle, forzamos el estado deslogueado con la recarga */
    }
    // Recarga completa a la portada: da feedback claro y limpia el estado del
    // servidor (cookies de sesión). Sin esto, el botón "no hacía nada" visible.
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) ?? teams[0] ?? null,
    [teams, activeTeamId]
  );

  return (
    <SessionContext.Provider
      value={{
        user,
        role,
        teams,
        activeTeam,
        setActiveTeam,
        clubId,
        ready,
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
