"use client";

import { useEffect, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

// Confirmación fuerte de borrado de club. Borrado IRREVERSIBLE en cascada vía
// RPC delete_club (SECURITY DEFINER): valida que el caller es owner y bloquea
// si el club tiene una suscripción premium activa (hay que cancelarla en la
// tienda primero). El botón solo se activa al escribir EXACTO el nombre.
export function DeleteClubDialog({
  clubName,
  clubId,
  onCancel,
  onDeleted,
}: {
  clubName: string;
  clubId: string;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  const matches =
    text.trim() === clubName.trim() && clubName.trim().length > 0;

  const handleConfirm = async () => {
    if (!matches || loading) return;
    setLoading(true);
    setError(null);
    const { error: rpcErr } = await getSupabaseApp().rpc("delete_club", {
      p_club_id: clubId,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setLoading(false);
      return;
    }
    onDeleted();
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
        onClick={loading ? undefined : onCancel}
      />
      <div
        className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] p-6 transition-all duration-200 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-error)]">
          ZONA DE PELIGRO
        </p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-1.5">
          Borrar club
        </h2>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)] mt-2.5">
          Esto eliminará{" "}
          <span className="font-bold text-[var(--color-text)]">{clubName}</span>{" "}
          y TODO su contenido de forma permanente: equipos, temporadas,
          jornadas, alineaciones, actas y los accesos de sus capitanes y
          jugadores. No se puede deshacer.
        </p>

        <p className="text-[13px] text-[var(--color-text-muted)] mt-5 mb-2">
          Escribe{" "}
          <span className="font-bold text-[var(--color-text)]">{clubName}</span>{" "}
          para confirmar
        </p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder={clubName}
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-3.5 py-3 text-[15px] outline-none placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-error)]/60"
        />

        {error && (
          <div className="mt-4 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!matches || loading}
          className="w-full h-13 mt-5 py-3.5 rounded-xl bg-[var(--color-error)] text-white text-[15px] font-bold transition hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Borrando…" : "Borrar club para siempre"}
        </button>
        {!loading && (
          <button
            onClick={onCancel}
            className="w-full text-center text-[13px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition mt-4"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
