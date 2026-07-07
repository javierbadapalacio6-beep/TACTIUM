"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { Reveal } from "@/app/app/ui/Reveal";

// ── Tipos locales (cliente Supabase sin tipar) ──────────────────────────────
interface PlayerRow {
  id: string;
  name: string;
  alias: string | null;
  pts: number | null;
  position: string | null;
  photo_url: string | null;
  active: boolean | null;
}

interface AvailabilityRow {
  player_id: string;
  available: boolean;
}

// Estado tri-estado por jugador en una jornada concreta:
//  - "yes": existe fila con available = true
//  - "no":  existe fila con available = false
//  - "none": no hay fila → sin responder
type Status = "yes" | "no" | "none";

type Filter = "all" | "yes" | "no" | "none";

interface PageData {
  jornada: number | null;
  opponent: string | null;
  date: string | null;
  isHome: boolean | null;
  players: PlayerRow[];
  status: Record<string, Status>;
  canEdit: boolean;
  seasonActive: boolean;
}

const displayName = (p: PlayerRow) =>
  p.alias && p.alias.trim() ? p.alias.trim() : p.name;

const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const fmtDate = (d: string | null) => {
  if (!d) return "Sin fecha";
  const [, m, day] = d.split("-");
  return day && m ? `${day}/${m}` : d;
};

export default function AvailabilityPage() {
  const params = useParams<{ id: string; mid: string }>();
  const { id: teamId, mid } = params;
  const session = useSession();

  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!teamId || !mid) return;
    const sb = getSupabaseApp();
    (async () => {
      try {
        const md = await sb
          .from("matchdays")
          .select("jornada_number, match_date, opponent, is_home, season_id")
          .eq("id", mid)
          .single();
        if (md.error) throw md.error;

        const season = await sb
          .from("seasons")
          .select("team_id, active")
          .eq("id", md.data.season_id)
          .single();
        if (season.error) throw season.error;

        const team = await sb
          .from("teams")
          .select("owner_id")
          .eq("id", season.data.team_id)
          .single();
        if (team.error) throw team.error;

        const plRes = await sb
          .from("players")
          .select("id, name, alias, pts, position, photo_url, active")
          .eq("team_id", teamId)
          .eq("active", true)
          .order("pts", { ascending: false, nullsFirst: false });
        if (plRes.error) throw plRes.error;

        const avRes = await sb
          .from("availability")
          .select("player_id, available")
          .eq("matchday_id", mid);
        if (avRes.error) throw avRes.error;

        const status: Record<string, Status> = {};
        ((avRes.data ?? []) as AvailabilityRow[]).forEach((a) => {
          status[a.player_id] = a.available ? "yes" : "no";
        });

        const seasonActive = season.data.active !== false;
        const isOwner = team.data.owner_id === session.user.id;

        setData({
          jornada: md.data.jornada_number,
          opponent: md.data.opponent,
          date: md.data.match_date,
          isHome: md.data.is_home,
          players: (plRes.data ?? []) as PlayerRow[],
          status,
          canEdit: seasonActive && isOwner,
          seasonActive,
        });
      } catch (e) {
        setError((e as { message?: string })?.message ?? "Error al cargar.");
      }
    })();
  }, [teamId, mid, session.user.id]);

  const counts = useMemo(() => {
    if (!data) return { yes: 0, no: 0, none: 0, total: 0 };
    let yes = 0;
    let no = 0;
    let none = 0;
    data.players.forEach((p) => {
      const s = data.status[p.id] ?? "none";
      if (s === "yes") yes += 1;
      else if (s === "no") no += 1;
      else none += 1;
    });
    return { yes, no, none, total: data.players.length };
  }, [data]);

  const pct = counts.total ? Math.round((counts.yes / counts.total) * 100) : 0;

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.players.filter((p) => {
      const s = data.status[p.id] ?? "none";
      if (filter === "all") return true;
      return s === filter;
    });
  }, [data, filter]);

  // Fija (o limpia) la disponibilidad de un jugador para esta jornada.
  // next === "none" borra la fila → vuelve a "sin responder".
  const setStatus = async (playerId: string, next: Status) => {
    if (!data || !data.canEdit || savingId) return;
    const prev = data.status[playerId] ?? "none";
    if (prev === next) return;

    // Optimista
    setData((d) =>
      d ? { ...d, status: { ...d.status, [playerId]: next } } : d,
    );
    setSavingId(playerId);
    const sb = getSupabaseApp();
    try {
      if (next === "none") {
        const { error } = await sb
          .from("availability")
          .delete()
          .eq("matchday_id", mid)
          .eq("player_id", playerId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("availability").upsert(
          {
            matchday_id: mid,
            player_id: playerId,
            available: next === "yes",
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "matchday_id,player_id" },
        );
        if (error) throw error;
      }
    } catch (e) {
      // Revertir
      setData((d) =>
        d ? { ...d, status: { ...d.status, [playerId]: prev } } : d,
      );
      setError((e as { message?: string })?.message ?? "No se pudo guardar.");
    } finally {
      setSavingId(null);
    }
  };

  // Marca como disponibles a todos los que aún no han respondido.
  const markAll = async () => {
    if (!data || !data.canEdit || savingId) return;
    const pending = data.players.filter(
      (p) => (data.status[p.id] ?? "none") !== "yes",
    );
    if (pending.length === 0) return;

    const prevStatus = { ...data.status };
    const optimistic = { ...data.status };
    pending.forEach((p) => {
      optimistic[p.id] = "yes";
    });
    setData((d) => (d ? { ...d, status: optimistic } : d));
    setSavingId("__all__");
    const sb = getSupabaseApp();
    try {
      const rows = pending.map((p) => ({
        matchday_id: mid,
        player_id: p.id,
        available: true,
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await sb
        .from("availability")
        .upsert(rows, { onConflict: "matchday_id,player_id" });
      if (error) throw error;
    } catch (e) {
      setData((d) => (d ? { ...d, status: prevStatus } : d));
      setError((e as { message?: string })?.message ?? "No se pudo guardar.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <Link
        href={`/app/team/${teamId}/matchday/${mid}`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> JORNADA
      </Link>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      <Reveal className="mb-7 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
            DISPONIBILIDAD {data?.jornada ? `· J${data.jornada}` : ""}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            ¿Quién juega esta jornada?
          </h1>
          {data && (
            <p className="font-mono text-[12px] text-[var(--color-text-muted)] mt-2 truncate">
              {data.opponent || "Rival por definir"} · {fmtDate(data.date)} ·{" "}
              {data.isHome === false ? "Fuera" : "Casa"}
            </p>
          )}
        </div>
        {data?.canEdit && (
          <button
            type="button"
            onClick={markAll}
            disabled={savingId !== null || counts.yes === counts.total}
            className="shrink-0 rounded-lg border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] px-3.5 py-2 font-mono text-[12px] font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent-25)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Marcar todo
          </button>
        )}
      </Reveal>

      {data && !data.canEdit && (
        <div className="mb-5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          {!data.seasonActive
            ? "Temporada archivada — solo lectura."
            : "Solo el capitán del equipo puede fijar la disponibilidad."}
        </div>
      )}

      {/* Loading */}
      {!data && !error && (
        <div className="flex flex-col gap-3">
          <div className="h-24 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Resumen */}
          <Reveal className="mb-5 rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-5 transition hover:border-[var(--color-accent-40)]">
            <div className="flex items-center gap-5">
              <Ring pct={pct} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-2xl font-extrabold tracking-tight">
                  <span className="text-[var(--color-accent)]">
                    {counts.yes}
                  </span>
                  <span className="text-[var(--color-text-faint)]">
                    {" "}
                    / {counts.total}
                  </span>
                </p>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                  jugadores disponibles
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
                  <span className="text-[var(--color-accent)]">
                    {counts.yes} sí
                  </span>
                  <span className="text-[var(--color-error)]">
                    {counts.no} no
                  </span>
                  <span className="text-[var(--color-text-faint)]">
                    {counts.none} sin responder
                  </span>
                </div>
              </div>
              <TactiumMark className="hidden sm:block w-8 h-8 opacity-20 shrink-0" />
            </div>
          </Reveal>

          {/* Filtros */}
          <Reveal
            as="div"
            delay={60}
            className="mb-4 flex gap-1 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] p-1"
          >
            {(
              [
                ["all", "Todos"],
                ["yes", "Disp."],
                ["no", "Bajas"],
                ["none", "Sin resp."],
              ] as [Filter, string][]
            ).map(([f, label]) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold transition ${
                    active
                      ? "bg-[var(--color-bg-raised)] text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </Reveal>

          {/* Lista */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {data.players.length === 0
                  ? "No hay jugadores en la plantilla."
                  : "Ningún jugador en este filtro."}
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {filtered.map((p, idx) => {
                const name = displayName(p);
                const s = data.status[p.id] ?? "none";
                const isSaving = savingId === p.id;
                return (
                  <Reveal
                    as="li"
                    key={p.id}
                    delay={Math.min(idx * 40, 240)}
                    className={`flex items-center gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 transition hover:border-[var(--color-accent-40)] hover:bg-[var(--color-bg-card-2)] ${
                      isSaving ? "opacity-60" : ""
                    }`}
                  >
                    <Avatar name={name} photo={p.photo_url} />
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold tracking-tight truncate block">
                        {name}
                      </span>
                      <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                        {[p.position, p.pts != null ? `${p.pts} pts` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    {data.canEdit ? (
                      <StatusToggle
                        value={s}
                        disabled={savingId !== null}
                        onChange={(next) => setStatus(p.id, next)}
                      />
                    ) : (
                      <StatusBadge value={s} />
                    )}
                  </Reveal>
                );
              })}
            </ol>
          )}
        </>
      )}
    </>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function Ring({ pct }: { pct: number }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-hair-strong)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[13px] font-bold">
        {pct}%
      </span>
    </div>
  );
}

const STATUS_META: Record<
  Status,
  { label: string; cls: string }
> = {
  yes: {
    label: "Disponible",
    cls: "text-[var(--color-accent)] border-[var(--color-accent-40)] bg-[var(--color-accent-10)]",
  },
  no: {
    label: "No disponible",
    cls: "text-[var(--color-error)] border-[var(--color-error)]/40 bg-[var(--color-error)]/10",
  },
  none: {
    label: "Sin responder",
    cls: "text-[var(--color-text-faint)] border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)]",
  },
};

function StatusBadge({ value }: { value: Status }) {
  const m = STATUS_META[value];
  return (
    <span
      className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] ${m.cls}`}
    >
      {m.label.toUpperCase()}
    </span>
  );
}

// Segmented control de 3 estados: Sí / No / —
function StatusToggle({
  value,
  disabled,
  onChange,
}: {
  value: Status;
  disabled: boolean;
  onChange: (s: Status) => void;
}) {
  const opts: { key: Status; label: string; active: string }[] = [
    {
      key: "yes",
      label: "Sí",
      active:
        "bg-[var(--color-accent)] text-[var(--color-bg)] border-[var(--color-accent)]",
    },
    {
      key: "no",
      label: "No",
      active:
        "bg-[var(--color-error)] text-[var(--color-bg)] border-[var(--color-error)]",
    },
    {
      key: "none",
      label: "—",
      active:
        "bg-[var(--color-bg-raised)] text-[var(--color-text)] border-[var(--color-hair-strong)]",
    },
  ];
  return (
    <div className="shrink-0 flex gap-1">
      {opts.map((o) => {
        const isActive = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.key)}
            aria-pressed={isActive}
            className={`h-8 min-w-9 rounded-lg border px-2.5 font-mono text-[12px] font-semibold transition disabled:cursor-not-allowed ${
              isActive
                ? o.active
                : "border-[var(--color-hair-strong)] bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
            } ${disabled && !isActive ? "opacity-40" : ""}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photo}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-[var(--color-hair-strong)]"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full shrink-0 grid place-items-center bg-[var(--color-bg-raised)] border border-[var(--color-hair-strong)] font-mono text-[11px] text-[var(--color-text-muted)]">
      {initials(name)}
    </div>
  );
}
