"use client";

import { useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { ModalShell, type Season, type SeasonPhase } from "./SeasonsManager";

const PHASE_OPTIONS: { id: SeasonPhase; label: string; sub: string }[] = [
  { id: "liga", label: "Liga regular", sub: "Jornadas en orden" },
  { id: "playoff", label: "Playoff", sub: "Eliminatorias" },
  { id: "mixto", label: "Liga + Playoff", sub: "Formato completo" },
];

// Alta de temporada. Replica CreateSeasonSheet de la app móvil:
//  - nombre por defecto "Temporada YY/YY+1"
//  - formato (liga/playoff/mixto)
//  - número de jornadas OPCIONAL (1..99, null si vacío)
//  - se crea activa (active=true)
//  - si choca con la temporada activa existente (unique index
//    one_active_season_per_team / 23505) → ofrece cerrar la previa y reintentar.
export function CreateSeasonModal({
  teamId,
  teamCategory,
  hasActive,
  activeSeason,
  onClose,
  onCreated,
}: {
  teamId: string;
  teamCategory: string | null;
  hasActive: boolean;
  activeSeason: Season | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const yr = new Date().getFullYear();
  const [name, setName] = useState(
    `Temporada ${String(yr).slice(2)}/${String(yr + 1).slice(2)}`,
  );
  const [phase, setPhase] = useState<SeasonPhase>("liga");
  const [matchdaysStr, setMatchdaysStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cuando detectamos conflicto con la activa, mostramos el panel de
  // confirmación "cerrar previa y crear".
  const [conflict, setConflict] = useState<Season | null>(null);

  const matchdaysNum =
    matchdaysStr.trim() === "" ? null : Number(matchdaysStr);
  const matchdaysValid =
    matchdaysStr.trim() === "" ||
    (matchdaysNum !== null &&
      Number.isFinite(matchdaysNum) &&
      matchdaysNum >= 1 &&
      matchdaysNum <= 99);

  const canSubmit = name.trim().length > 0 && matchdaysValid && !submitting;

  const insert = async () => {
    const { error } = await getSupabaseApp()
      .from("seasons")
      .insert({
        team_id: teamId,
        name: name.trim(),
        category: teamCategory ?? null,
        phase,
        total_matchdays: matchdaysNum,
        active: true,
      });
    if (error) throw error;
  };

  const isActiveConflict = (e: { code?: string; message?: string }) =>
    e?.code === "23505" ||
    (e?.message ?? "").includes("one_active_season_per_team");

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await insert();
      onCreated();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (isActiveConflict(err)) {
        // Si ya conocemos la activa desde el padre la usamos; si no, la
        // pedimos para mostrar su nombre en el panel de confirmación.
        let current = activeSeason;
        if (!current) {
          const { data } = await getSupabaseApp()
            .from("seasons")
            .select(
              "id, team_id, name, category, phase, total_matchdays, active, start_date, end_date, created_at",
            )
            .eq("team_id", teamId)
            .eq("active", true)
            .maybeSingle();
          current = (data as Season | null) ?? null;
        }
        if (current) {
          setConflict(current);
        } else {
          setError(
            "Ya hay una temporada activa. Ciérrala antes de crear otra.",
          );
        }
      } else {
        setError(err?.message ?? "No se pudo crear la temporada.");
      }
      setSubmitting(false);
    }
  };

  // Cerrar la previa (active=false + end_date=hoy) y reintentar el insert.
  const closeAndCreate = async () => {
    if (!conflict || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { error: closeErr } = await getSupabaseApp()
        .from("seasons")
        .update({ active: false, end_date: today })
        .eq("id", conflict.id);
      if (closeErr) throw closeErr;
      await insert();
      onCreated();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo crear.");
      setSubmitting(false);
    }
  };

  // ── Panel de conflicto ──
  if (conflict) {
    return (
      <ModalShell onClose={onClose}>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-warning)]">
          TEMPORADA ACTIVA
        </p>
        <h3 className="text-xl font-bold tracking-tight mt-1">
          Ya hay una en curso
        </h3>
        <p className="text-[14px] text-[var(--color-text-muted)] mt-3 leading-relaxed">
          Tienes{" "}
          <span className="text-[var(--color-text)]">{conflict.name}</span> en
          curso. ¿Quieres cerrarla y crear{" "}
          <span className="text-[var(--color-text)]">{name.trim()}</span> como
          nueva temporada activa?
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[var(--color-error)]">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setConflict(null)}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] text-[var(--color-text)] font-semibold text-[14px] transition hover:bg-[var(--color-bg-card-2)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={closeAndCreate}
            disabled={submitting}
            className="flex-[1.4] h-11 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[14px] transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creando…" : "Cerrar y crear nueva"}
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Formulario ──
  return (
    <ModalShell onClose={onClose}>
      <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)]">
        NUEVA
      </p>
      <h3 className="text-xl font-bold tracking-tight mt-1">Crear temporada</h3>

      {hasActive && (
        <p className="mt-3 text-[12px] text-[var(--color-text-muted)] rounded-lg border border-[var(--color-hair)] bg-[var(--color-bg-card)] px-3 py-2">
          Ya tienes una temporada activa. Al crear una nueva podrás cerrar la
          anterior.
        </p>
      )}

      <Field label="NOMBRE">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full bg-transparent text-[16px] font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
        />
      </Field>

      <p className="font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-faint)] mt-5 mb-2">
        FORMATO
      </p>
      <div className="flex flex-col gap-2">
        {PHASE_OPTIONS.map((p) => {
          const sel = phase === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPhase(p.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition ${
                sel
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-10)]"
                  : "border-[var(--color-hair)] bg-[var(--color-bg-card)] hover:border-[var(--color-hair-strong)]"
              }`}
            >
              <span
                className={`w-[18px] h-[18px] rounded-full grid place-items-center border-[1.5px] shrink-0 ${
                  sel
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                    : "border-[var(--color-hair-strong)]"
                }`}
              >
                {sel && <span className="w-2 h-2 rounded-full bg-black" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold">
                  {p.label}
                </span>
                <span className="block font-mono text-[10px] text-[var(--color-text-faint)] mt-0.5">
                  {p.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Field
        label={
          phase === "playoff"
            ? "NÚMERO DE ELIMINATORIAS · OPCIONAL"
            : "NÚMERO DE JORNADAS · OPCIONAL"
        }
      >
        <input
          inputMode="numeric"
          value={matchdaysStr}
          onChange={(e) =>
            setMatchdaysStr(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))
          }
          placeholder={phase === "playoff" ? "ej. 4" : "ej. 18"}
          className="w-full bg-transparent text-[16px] font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
        />
      </Field>

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          disabled={submitting}
          className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] text-[var(--color-text)] font-semibold text-[14px] transition hover:bg-[var(--color-bg-card-2)] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex-[1.4] h-11 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[14px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Creando…" : "Crear temporada"}
        </button>
      </div>
    </ModalShell>
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
    <div className="mt-5">
      <p className="font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-faint)] mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3">
        <span className="w-1.5 h-[18px] rounded-full bg-[var(--color-accent)] shrink-0" />
        {children}
      </div>
    </div>
  );
}
