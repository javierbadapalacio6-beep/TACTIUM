"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import {
  CATS,
  GROUPS,
  GENDERS,
  FEDERATIONS,
  type TeamGender,
} from "@/app/app/create/federations";

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

// Crear un equipo dentro del club. Replica CreateTeamFromClubScreen: la
// federación se HEREDA del club (read-only); el género por defecto es
// 'masculino' (igual que createTeam del móvil cuando no se marca otro).
export function CreateTeamDialog({
  clubId,
  clubName,
  clubFederation,
  onClose,
  onCreated,
}: {
  clubId: string;
  clubName: string;
  clubFederation: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const session = useSession();
  const [name, setName] = useState("");
  const [league, setLeague] = useState("");
  const [cat, setCat] = useState("");
  const [gender, setGender] = useState<TeamGender | null>(null);

  // La federación se HEREDA del club (read-only). Resolvemos su nombre legible
  // a partir del código guardado en clubs.federation, como hace el móvil.
  const clubFed = useMemo(
    () => FEDERATIONS.find((f) => f.code === clubFederation) ?? null,
    [clubFederation],
  );
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  const valid = useMemo(
    () =>
      Boolean(name.trim() && league.trim() && cat && (!hasGroup || group)),
    [name, league, cat, group, hasGroup],
  );

  const handleSave = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    // Reverse trial: crear equipos del club es libre (estructura). El gate de
    // cobertura del plan se aplica al operar cada equipo, no al crearlo.
    const { error: insErr } = await getSupabaseApp()
      .from("teams")
      .insert({
        owner_id: session.user.id,
        name: name.trim(),
        federation: clubFederation || null,
        league: league.trim() || null,
        category: cat || null,
        group_name: hasGroup ? group || null : null,
        gender: gender ?? "masculino",
        club_id: clubId,
      });
    if (insErr) {
      setError(insErr.message);
      setSubmitting(false);
      return;
    }
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        onClick={submitting ? undefined : onClose}
      />
      <div
        className={`relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] p-6 transition-all duration-200 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)]">
          CLUB · {clubName.toUpperCase()}
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-1">
          Nuevo equipo
        </h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5 mb-5">
          Pertenecerá a {clubName}. Podrás asignarle capitán después desde la
          app móvil.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
            {error}
          </div>
        )}

        <Field label="Nombre del equipo">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-3.5 py-3">
            <span className="w-[5px] h-5 rounded bg-[var(--color-accent)] shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Equipo A"
              autoFocus
              className="flex-1 bg-transparent outline-none text-[16px] font-semibold placeholder:text-[var(--color-text-faint)]"
            />
          </div>
        </Field>

        <Field label="Federación">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] px-3.5 py-3 opacity-90">
            <div className="min-w-0">
              {clubFed ? (
                <>
                  <p className="text-[14px] font-semibold truncate">
                    {clubFed.name}
                  </p>
                  <p className="font-mono text-[11px] text-[var(--color-text-faint)] mt-0.5 truncate">
                    {clubFed.region} · {clubFed.shortName}
                  </p>
                </>
              ) : (
                <span className="text-[14px] text-[var(--color-text-faint)]">
                  {clubFederation || "El club no tiene federación asignada"}
                </span>
              )}
            </div>
            <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-[var(--color-text-faint)]">
              HEREDADA DEL CLUB
            </span>
          </div>
        </Field>

        <Field label="Liga">
          <input
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            placeholder="Liga por equipos absoluta"
            className="w-full rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-3.5 py-3 text-[14px] font-medium outline-none placeholder:text-[var(--color-text-faint)]"
          />
        </Field>

        <Field label="Categoría">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CATS.map((c) => {
              const sel = cat === c;
              return (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`shrink-0 w-14 h-12 rounded-xl border text-[17px] font-semibold transition ${
                    sel
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-black"
                      : "bg-[var(--color-bg-card)] border-[var(--color-hair-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Género">
          <div className="flex gap-1.5">
            {GENDERS.map((g) => {
              const sel = gender === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setGender(g.id)}
                  className={`flex-1 h-12 rounded-xl border text-[14px] font-semibold transition ${
                    sel
                      ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-black"
                      : "bg-[var(--color-bg-card)] border-[var(--color-hair-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-faint)] uppercase">
              Grupo
            </span>
            <button
              onClick={() => setHasGroup((v) => !v)}
              className={`font-mono text-[11px] px-2.5 py-1 rounded-full border transition ${
                hasGroup
                  ? "text-[var(--color-accent)] border-[var(--color-accent-40)]"
                  : "text-[var(--color-text-muted)] border-[var(--color-hair-strong)]"
              }`}
            >
              {hasGroup ? "Sí" : "Sin grupos"}
            </button>
          </div>
          {hasGroup && (
            <div className="flex gap-1.5">
              {GROUPS.map((g) => {
                const sel = group === g;
                return (
                  <button
                    key={g}
                    onClick={() => setGroup(g)}
                    className={`flex-1 h-12 rounded-xl border text-[17px] font-semibold transition ${
                      sel
                        ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-black"
                        : "bg-[var(--color-bg-card)] border-[var(--color-hair-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-40)]"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 h-12 rounded-xl border border-[var(--color-hair-strong)] text-[14px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!valid || submitting}
            className="flex-[1.5] h-12 rounded-xl bg-[var(--color-accent)] text-black text-[15px] font-bold transition hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Creando…" : "Crear equipo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-faint)] uppercase mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
