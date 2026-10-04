"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { fetchClubTeams } from "@/lib/queries";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  BtnLink,
  Card,
  Chip,
  InputWrap,
  PageHeader,
  Segmented,
  Table,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { IconFlag, IconPlus, IconSearch, IconShield } from "@/components/Icon";
import { Crest } from "@/components/Crest";
import { EASE } from "@/components/entry/motion-bits";

const GENDERS = ["Todos", "Masculino", "Femenino", "Mixto"] as const;
/** Liga Cántabra: 5 parejas por encuentro = 10 jugadores. */
const MATCHDAY_PLAYERS = 10;

interface TeamExtra {
  won: number;
  lost: number;
  players: number;
  hasCaptain: boolean;
  logoUrl: string | null;
  next: { date: string | null; time: string | null; opponent: string; isHome: boolean } | null;
}

function shortDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Lo que cada fila necesita además de la lista: récord contado de verdad
 * (G y P), próxima jornada, jugadores y si tiene capitán aparte de quien
 * gestiona el club (los triggers ya hacen capitán al club). Cuatro consultas
 * para todos los equipos, todas de lectura bajo RLS.
 */
async function fetchExtras(teamIds: string[], myUserId: string | null) {
  const sb = supabaseBrowser();
  const out = new Map<string, TeamExtra>();
  teamIds.forEach((id) =>
    out.set(id, { won: 0, lost: 0, players: 0, hasCaptain: false, logoUrl: null, next: null }),
  );
  if (teamIds.length === 0) return out;
  const [seasonsRes, capsRes, playersRes, teamsRes] = await Promise.all([
    sb.from("seasons").select("id, team_id").in("team_id", teamIds).eq("active", true),
    sb.from("team_members").select("team_id, user_id, role").in("team_id", teamIds).in("role", ["captain", "admin"]),
    sb.from("players").select("team_id").in("team_id", teamIds).eq("active", true),
    sb.from("teams").select("id, logo_url").in("id", teamIds),
  ]);
  for (const c of (capsRes.data ?? []) as { team_id: string; user_id: string }[]) {
    if (c.user_id === myUserId) continue;
    const e = out.get(c.team_id);
    if (e) e.hasCaptain = true;
  }
  for (const p of (playersRes.data ?? []) as { team_id: string }[]) {
    const e = out.get(p.team_id);
    if (e) e.players++;
  }
  for (const t of (teamsRes.data ?? []) as { id: string; logo_url: string | null }[]) {
    const e = out.get(t.id);
    if (e) e.logoUrl = t.logo_url;
  }
  const seasons = (seasonsRes.data ?? []) as { id: string; team_id: string }[];
  if (seasons.length) {
    const teamBySeason = new Map(seasons.map((s) => [s.id, s.team_id]));
    const { data: mds } = await sb
      .from("matchdays")
      .select("season_id, outcome, status, match_date, match_time, opponent, is_home, jornada_number")
      .in("season_id", seasons.map((s) => s.id))
      .order("jornada_number", { ascending: true });
    for (const m of (mds ?? []) as {
      season_id: string;
      outcome: string | null;
      status: string;
      match_date: string | null;
      match_time: string | null;
      opponent: string;
      is_home: boolean;
    }[]) {
      const e = out.get(teamBySeason.get(m.season_id) ?? "");
      if (!e) continue;
      if (m.outcome === "win") e.won++;
      else if (m.outcome === "loss") e.lost++;
      else if (!e.next && m.status !== "finished" && !m.outcome) {
        e.next = { date: m.match_date, time: m.match_time, opponent: m.opponent, isHome: m.is_home };
      }
    }
  }
  return out;
}

export function ClubTeams() {
  const { clubId, user } = useSession();
  const reduce = useReducedMotion();
  const { data, loading, error } = useAsync(
    () => fetchClubTeams(clubId!),
    [clubId],
    !!clubId
  );
  const all = data ?? [];
  const extras = useAsync(
    () => fetchExtras(all.map((t) => t.id), user?.id ?? null),
    [all.map((t) => t.id).join(","), user?.id],
    all.length > 0
  );
  const ex = extras.data;

  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("Todos");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const alertsOf = (id: string, covered: boolean) => {
    const e = ex?.get(id);
    return {
      noCaptain: !!e && !e.hasCaptain,
      notCovered: !covered,
      missing: e ? Math.max(0, MATCHDAY_PLAYERS - e.players) : 0,
    };
  };
  const hasAlert = (id: string, covered: boolean) => {
    const a = alertsOf(id, covered);
    return a.noCaptain || a.notCovered || a.missing > 0;
  };
  const alertCount = all.filter((t) => hasAlert(t.id, t.covered)).length;

  const rows = all.filter((t) => {
    if (onlyAlerts && !hasAlert(t.id, t.covered)) return false;
    if (gender !== "Todos" && (t.gender ?? "").toLowerCase() !== gender.toLowerCase()) return false;
    const q = query.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q);
  });
  const covered = all.filter((t) => t.covered).length;

  if (loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      <PageHeader
        title="Equipos"
        lede="Lo próximo de cada equipo y lo que le falta: capitán, cobertura o jugadores."
        actions={
          <BtnLink href="/club/equipos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Nuevo equipo
          </BtnLink>
        }
      />

      {all.length > 0 && (
        <div className="tw-toolbar">
          <InputWrap icon={<IconSearch size={15} />}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar equipo"
              aria-label="Buscar equipo"
            />
          </InputWrap>
          <Segmented
            label="Género"
            value={gender}
            onChange={setGender}
            options={GENDERS.map((g) => ({ value: g, label: g }))}
          />
          <button
            type="button"
            className={"tw-fcp-chip" + (onlyAlerts ? " is-on" : "")}
            aria-pressed={onlyAlerts}
            onClick={() => setOnlyAlerts((v) => !v)}
          >
            Con avisos · {alertCount}
          </button>
          <span className="tw-toolbar-spacer" />
          <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            {covered} de {all.length} cubiertos
          </span>
        </div>
      )}

      {!clubId ? (
        <Card>
          <EmptyState icon={<IconShield size={22} />} title="Sin club activo" />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState icon={<IconShield size={22} />} title="No se pudieron cargar los equipos" body={error} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconShield size={22} />}
            title={all.length === 0 ? "Aún no hay equipos" : "Sin coincidencias"}
            body={
              all.length === 0
                ? "Da de alta el primero o tráelos de la Federación con su plantilla."
                : "Prueba con otro filtro o nombre."
            }
            action={
              all.length === 0 ? (
                <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <BtnLink href="/club/equipos/nuevo" variant="accent" icon={<IconPlus size={14} />}>
                    Nuevo equipo
                  </BtnLink>
                  <BtnLink href="/club/importar" icon={<IconFlag size={14} />}>
                    Traer de la Federación
                  </BtnLink>
                </span>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card flush>
          <Table>
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Próxima jornada</th>
                <th className="num">Récord</th>
                <th>Avisos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const e = ex?.get(t.id);
                const a = alertsOf(t.id, t.covered);
                return (
                  <motion.tr
                    key={t.id}
                    initial={reduce ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 12) * 0.04 }}
                  >
                    <td>
                      <Link
                        href={`/club/equipos/${t.id}`}
                        className="cell-main"
                        style={{ color: "inherit", display: "flex", alignItems: "center", gap: 10 }}
                      >
                        <Crest src={e?.logoUrl} size={30} />
                        <span style={{ minWidth: 0 }}>
                          <span className="truncate" style={{ display: "block" }}>
                            {t.name}
                          </span>
                          <span className="cell-sub" style={{ display: "block", fontWeight: 400 }}>
                            {[t.category ?? "Sin categoría", t.gender, e ? `${e.players} jug.` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="cell-muted">
                      {e?.next ? (
                        <>
                          <span style={{ color: "var(--text)" }}>
                            {shortDate(e.next.date)}
                            {e.next.time ? ` · ${e.next.time.slice(0, 5)}` : ""}
                          </span>{" "}
                          vs {e.next.opponent}
                          {e.next.isHome ? " · Local" : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num mono">
                      {e && e.won + e.lost > 0 ? (
                        <>
                          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{e.won}G</span> {e.lost}P
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                        {a.noCaptain && <Chip tone="warning">Sin capitán</Chip>}
                        {a.notCovered && <Chip tone="mute">No cubierto</Chip>}
                        {a.missing > 0 && <Chip tone="mute">Faltan {a.missing}</Chip>}
                        {!a.noCaptain && !a.notCovered && a.missing === 0 && e && <Chip>Al día</Chip>}
                      </span>
                    </td>
                    <td>
                      <div className="tw-table-actions">
                        <BtnLink href={`/club/equipos/${t.id}`} size="sm" variant="quiet">
                          {a.noCaptain ? "Invitar capitán" : "Gestionar"}
                        </BtnLink>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
