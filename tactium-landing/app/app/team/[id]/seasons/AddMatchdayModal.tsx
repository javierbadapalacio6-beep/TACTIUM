"use client";

import { useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { ModalShell, type Season } from "./SeasonsManager";

// Alta MANUAL de una jornada dentro de una temporada activa. Replica
// AddMatchdaySheet de la app móvil:
//  - rival (obligatorio), local/visitante, lugar, fecha, hora (opcionales)
//  - inserta con jornada_number temporal = nextJornadaNumber
//  - tras insertar llama al RPC renumber_season_matchdays para reordenar por
//    fecha (las jornadas retroactivas se "encajan" cronológicamente).
// NB: las tandas (selector dependiente de federación/pistas) se omiten en web
// por ahora — opcional y no bloqueante; se gestionan desde la app móvil.
export function AddMatchdayModal({
  season,
  nextJornadaNumber,
  onClose,
  onCreated,
}: {
  season: Season;
  nextJornadaNumber: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = opponent.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const sb = getSupabaseApp();
    try {
      const { error: insErr } = await sb.from("matchdays").insert({
        season_id: season.id,
        jornada_number: nextJornadaNumber,
        opponent: opponent.trim(),
        match_date: matchDate || null,
        match_time: matchTime || null,
        is_home: isHome,
        location: location.trim() || null,
      });
      if (insErr) throw insErr;

      // Reordena J01..JNN por fecha asc (NULL al final). Mismas reglas que
      // la app: si la fecha es retroactiva, encaja en su posición.
      const { error: rpcErr } = await sb.rpc("renumber_season_matchdays", {
        target_season: season.id,
      });
      if (rpcErr) throw rpcErr;

      onCreated();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo crear.");
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)]">
        NUEVA JORNADA · J{String(nextJornadaNumber).padStart(2, "0")}
      </p>
      <h3 className="text-xl font-bold tracking-tight mt-1">Añadir jornada</h3>
      <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
        {season.name}
      </p>

      <Field label="RIVAL">
        <input
          autoFocus
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="Club Visitante"
          className="w-full bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
        />
      </Field>

      <p className="font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-faint)] mt-5 mb-2">
        LOCALIZACIÓN
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { home: true, label: "Local", sub: "En nuestras pistas" },
          { home: false, label: "Visitante", sub: "Fuera de casa" },
        ].map((o) => {
          const sel = isHome === o.home;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => setIsHome(o.home)}
              className={`px-4 py-3 rounded-xl border text-left transition ${
                sel
                  ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                  : "bg-[var(--color-bg-card)] border-[var(--color-hair-strong)] hover:border-[var(--color-accent-40)]"
              }`}
            >
              <span
                className={`block text-[15px] font-semibold ${
                  sel
                    ? "text-[var(--color-text-inverse)]"
                    : "text-[var(--color-text)]"
                }`}
              >
                {o.label}
              </span>
              <span
                className={`block font-mono text-[10px] mt-0.5 ${
                  sel ? "text-black/60" : "text-[var(--color-text-faint)]"
                }`}
              >
                {o.sub}
              </span>
            </button>
          );
        })}
      </div>

      <Field label="LUGAR (OPCIONAL)">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Ej. Club Pádel Indoor, Pista 3"
          className="w-full bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="FECHA">
          <input
            type="date"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="w-full bg-transparent text-[15px] text-[var(--color-text)] outline-none [color-scheme:dark]"
          />
        </Field>
        <Field label="HORA">
          <input
            type="time"
            value={matchTime}
            onChange={(e) => setMatchTime(e.target.value)}
            className="w-full bg-transparent text-[15px] text-[var(--color-text)] outline-none [color-scheme:dark]"
          />
        </Field>
      </div>

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
          {submitting ? "Creando…" : "Crear jornada"}
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
        {children}
      </div>
    </div>
  );
}
