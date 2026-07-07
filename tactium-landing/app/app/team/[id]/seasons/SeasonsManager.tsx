"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { Reveal } from "@/app/app/ui/Reveal";
import { CreateSeasonModal } from "./CreateSeasonModal";
import { AddMatchdayModal } from "./AddMatchdayModal";
import { ImportCalendarModal } from "./ImportCalendarModal";

// ─── Tipos locales (el cliente Supabase no está tipado) ──────────────
export type SeasonPhase = "liga" | "playoff" | "mixto";

export interface Season {
  id: string;
  team_id: string;
  name: string;
  category: string | null;
  phase: SeasonPhase;
  total_matchdays: number | null;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  owner_id: string | null;
  league: string | null;
  category: string | null;
}

// Conteo de jornadas por temporada (para "Crear nueva jornada" → número y
// para mostrar progreso en la card activa).
type MatchdayCounts = Record<string, number>;

const phaseShort = (p: SeasonPhase) =>
  p === "mixto" ? "L+P" : p === "playoff" ? "P" : "L";
const phaseLabel = (p: SeasonPhase) =>
  p === "mixto" ? "LIGA + PLAYOFF" : p === "playoff" ? "PLAYOFF" : "LIGA";

const seasonMeta = (team: Team | null) =>
  team
    ? [team.name, team.league, team.category].filter(Boolean).join(" · ") || "—"
    : "—";

export function SeasonsManager({ teamId }: { teamId: string }) {
  const session = useSession();

  const [team, setTeam] = useState<Team | null>(null);
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [counts, setCounts] = useState<MatchdayCounts>({});
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<Season | null>(null);
  const [importingTo, setImportingTo] = useState<Season | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<Season | null>(null);

  const isOwner = !!team && team.owner_id === session.user.id;

  const load = useCallback(async () => {
    setError(null);
    const sb = getSupabaseApp();
    try {
      const [teamRes, seasonsRes] = await Promise.all([
        sb
          .from("teams")
          .select("id, name, owner_id, league, category")
          .eq("id", teamId)
          .single(),
        sb
          .from("seasons")
          .select(
            "id, team_id, name, category, phase, total_matchdays, active, start_date, end_date, created_at",
          )
          .eq("team_id", teamId)
          .order("active", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (teamRes.error) throw teamRes.error;
      if (seasonsRes.error) throw seasonsRes.error;

      setTeam(teamRes.data as Team);
      const list = (seasonsRes.data ?? []) as Season[];
      setSeasons(list);

      // Conteo de jornadas por temporada (en paralelo).
      if (list.length > 0) {
        const entries = await Promise.all(
          list.map(async (s) => {
            const { count } = await sb
              .from("matchdays")
              .select("id", { count: "exact", head: true })
              .eq("season_id", s.id);
            return [s.id, count ?? 0] as const;
          }),
        );
        setCounts(Object.fromEntries(entries));
      } else {
        setCounts({});
      }
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Error al cargar.");
      setSeasons([]);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () => (seasons ?? []).filter((s) => s.active),
    [seasons],
  );
  const past = useMemo(
    () => (seasons ?? []).filter((s) => !s.active),
    [seasons],
  );

  // ── Cerrar (archivar) temporada ──
  // Replica seasons.ts → closeSeason: active=false + end_date=hoy. No borra
  // jornadas; quedan visibles en solo lectura. La RLS controla el permiso
  // real; aquí sólo gateamos la UI por owner.
  const doClose = async (s: Season) => {
    if (closingId) return;
    setClosingId(s.id);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await getSupabaseApp()
        .from("seasons")
        .update({ active: false, end_date: today })
        .eq("id", s.id);
      if (error) throw error;
      setConfirmClose(null);
      await load();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo cerrar.");
    } finally {
      setClosingId(null);
    }
  };

  // ── Loading skeleton ──
  if (!seasons || !team) {
    return (
      <>
        <Header onCreate={null} canCreate={false} />
        <div className="flex flex-col gap-3 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
        {error && <ErrorBanner text={error} />}
      </>
    );
  }

  // Índice base para escalonar la entrada (Reveal) de la lista por debajo de
  // la cabecera y del aviso de permisos.
  let revealIdx = 0;
  const nextDelay = () => Math.min(revealIdx++, 6) * 40;

  return (
    <>
      <Reveal>
        <Header
          onCreate={isOwner ? () => setCreating(true) : null}
          canCreate={isOwner}
        />
      </Reveal>

      {error && <ErrorBanner text={error} />}

      {!isOwner && (
        <Reveal delay={40}>
          <div className="mt-5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
            Solo el capitán del equipo puede crear o gestionar temporadas.
          </div>
        </Reveal>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {/* Temporada activa */}
        {active.map((s) => (
          <Reveal key={s.id} delay={nextDelay()}>
            <ActiveSeasonCard
              season={s}
              team={team}
              matchdayCount={counts[s.id] ?? 0}
              isOwner={isOwner}
              closing={closingId === s.id}
              onAddMatchday={() => setAddingTo(s)}
              onImport={() => setImportingTo(s)}
              onClose={() => setConfirmClose(s)}
            />
          </Reveal>
        ))}

        {/* Vacío total */}
        {seasons.length === 0 && (
          <Reveal delay={nextDelay()}>
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
              <h2 className="text-lg font-bold">Sin temporadas</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                Crea la primera temporada para empezar a planificar jornadas e
                importar tu calendario.
              </p>
              {isOwner && (
                <button
                  onClick={() => setCreating(true)}
                  className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[14px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90"
                >
                  + Crear temporada
                </button>
              )}
            </div>
          </Reveal>
        )}

        {/* Histórico */}
        {past.length > 0 && (
          <>
            <Reveal delay={nextDelay()}>
              <div className="flex items-center justify-between mt-4 mb-1">
                <span className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-text-faint)]">
                  HISTÓRICO
                </span>
                <span className="font-mono text-[11px] text-[var(--color-text-faint)]">
                  {past.length} temp.
                </span>
              </div>
            </Reveal>
            {past.map((s) => (
              <Reveal key={s.id} delay={nextDelay()}>
                <PastSeasonCard
                  season={s}
                  team={team}
                  matchdayCount={counts[s.id] ?? 0}
                />
              </Reveal>
            ))}
          </>
        )}

        {/* Crear otra (cuando ya hay alguna) */}
        {isOwner && seasons.length > 0 && (
          <Reveal delay={nextDelay()}>
            <button
              onClick={() => setCreating(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-[var(--color-hair-strong)] text-[var(--color-accent)] font-semibold text-[14px] transition hover:border-[var(--color-accent-40)] hover:bg-[var(--color-accent-10)]"
            >
              + Crear nueva temporada
            </button>
          </Reveal>
        )}
      </div>

      {/* ── Modales ── */}
      {creating && (
        <CreateSeasonModal
          teamId={teamId}
          teamCategory={team.category}
          hasActive={active.length > 0}
          activeSeason={active[0] ?? null}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {addingTo && (
        <AddMatchdayModal
          season={addingTo}
          nextJornadaNumber={(counts[addingTo.id] ?? 0) + 1}
          onClose={() => setAddingTo(null)}
          onCreated={() => {
            setAddingTo(null);
            load();
          }}
        />
      )}

      {importingTo && (
        <ImportCalendarModal
          season={importingTo}
          teamName={team.name}
          existingCount={counts[importingTo.id] ?? 0}
          onClose={() => setImportingTo(null)}
          onImported={() => {
            setImportingTo(null);
            load();
          }}
        />
      )}

      {/* Confirmación de cierre */}
      {confirmClose && (
        <ConfirmCloseModal
          season={confirmClose}
          busy={closingId === confirmClose.id}
          onCancel={() => setConfirmClose(null)}
          onConfirm={() => doClose(confirmClose)}
        />
      )}
    </>
  );
}

// ─── Header ──────────────────────────────────────────────────────────
function Header({
  onCreate,
  canCreate,
}: {
  onCreate: (() => void) | null;
  canCreate: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          TEMPORADAS
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Gestión de temporadas
        </h1>
        <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">
          Crea ligas y playoffs, archiva temporadas y carga tu calendario.
        </p>
      </div>
      {canCreate && onCreate && (
        <button
          onClick={onCreate}
          aria-label="Crear temporada"
          className="shrink-0 w-10 h-10 grid place-items-center rounded-xl bg-[var(--color-accent-10)] border border-[var(--color-accent-40)] text-[var(--color-accent)] text-xl leading-none transition hover:bg-[var(--color-accent-25)]"
        >
          +
        </button>
      )}
    </div>
  );
}

// ─── Active season card ──────────────────────────────────────────────
function ActiveSeasonCard({
  season,
  team,
  matchdayCount,
  isOwner,
  closing,
  onAddMatchday,
  onImport,
  onClose,
}: {
  season: Season;
  team: Team;
  matchdayCount: number;
  isOwner: boolean;
  closing: boolean;
  onAddMatchday: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const pct =
    season.total_matchdays && season.total_matchdays > 0
      ? Math.min(
          100,
          Math.round((matchdayCount / season.total_matchdays) * 100),
        )
      : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--color-accent-40)] p-5"
      style={{
        background:
          "linear-gradient(135deg, var(--color-bg-card-2), var(--color-bg-card))",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full opacity-30 blur-2xl"
        style={{ background: "var(--color-accent-25)" }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
          <span className="font-mono text-[11px] tracking-[0.15em] font-semibold text-[var(--color-accent)]">
            ACTIVA · {phaseShort(season.phase)}
          </span>
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight">{season.name}</h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
          {seasonMeta(team)}
        </p>

        {/* Progreso */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-[var(--color-hair)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-700"
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)] shrink-0">
            {matchdayCount}
            {season.total_matchdays ? `/${season.total_matchdays}` : ""} jorn.
          </span>
        </div>

        {/* Acciones (solo owner) */}
        {isOwner && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={onAddMatchday}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[13px] transition hover:opacity-90"
            >
              + Añadir jornada
            </button>
            <button
              onClick={onImport}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[var(--color-hair-strong)] text-[var(--color-text)] font-semibold text-[13px] transition hover:border-[var(--color-accent-40)] hover:text-[var(--color-accent)]"
            >
              Importar calendario
            </button>
            <button
              onClick={onClose}
              disabled={closing}
              className="ml-auto inline-flex items-center h-9 px-4 rounded-lg border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 text-[var(--color-error)] font-semibold text-[13px] transition hover:bg-[var(--color-error)]/10 disabled:opacity-50"
            >
              {closing ? "Cerrando…" : "Cerrar temporada"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Past season card ────────────────────────────────────────────────
function PastSeasonCard({
  season,
  team,
  matchdayCount,
}: {
  season: Season;
  team: Team;
  matchdayCount: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] px-4 py-3.5 transition hover:border-[var(--color-accent-40)] hover:bg-[var(--color-bg-card-2)]">
      <div className="w-10 h-10 shrink-0 grid place-items-center rounded-lg bg-[var(--color-bg-raised)] font-mono text-[11px] font-semibold text-[var(--color-text)]">
        {phaseShort(season.phase)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold tracking-tight truncate">
          {season.name}
        </div>
        <p className="font-mono text-[11px] text-[var(--color-text-faint)] mt-0.5 truncate">
          {seasonMeta(team)}
          {season.end_date ? ` · cerrada ${season.end_date}` : ""}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-faint)]">
        {matchdayCount} jorn.
      </span>
    </div>
  );
}

// ─── Confirm close modal ─────────────────────────────────────────────
function ConfirmCloseModal({
  season,
  busy,
  onCancel,
  onConfirm,
}: {
  season: Season;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-error)]">
        ARCHIVAR
      </p>
      <h3 className="text-xl font-bold tracking-tight mt-1">
        Cerrar temporada
      </h3>
      <p className="text-[14px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
        La temporada <span className="text-[var(--color-text)]">{season.name}</span>{" "}
        pasará al histórico. No podrás añadir jornadas nuevas ni editar
        alineaciones, pero los resultados pendientes podrás registrarlos cuando
        quieras. Las jornadas y resultados quedan visibles en solo lectura.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] text-[var(--color-text)] font-semibold text-[14px] transition hover:bg-[var(--color-bg-card-2)] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex-[1.2] h-11 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)] font-semibold text-[14px] transition hover:bg-[var(--color-error)]/15 disabled:opacity-50"
        >
          {busy ? "Cerrando…" : "Cerrar temporada"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────
function ErrorBanner({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="mt-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]"
    >
      {text}
    </div>
  );
}

// Modal genérico reutilizado por los hijos (export para no duplicar).
export function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Keyframes locales (no podemos tocar globals.css) usados por modales
          y cards de esta área. */}
      <style>{`
@keyframes tactiumFadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes tactiumSlideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
.tactium-fade-in { animation: tactiumFadeIn .35s ease both }
.tactium-slide-up { animation: tactiumSlideUp .25s ease both }
`}</style>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm tactium-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] p-6 shadow-2xl tactium-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center sm:hidden mb-4">
          <TactiumMark size={26} />
        </div>
        {children}
      </div>
    </div>
  );
}
