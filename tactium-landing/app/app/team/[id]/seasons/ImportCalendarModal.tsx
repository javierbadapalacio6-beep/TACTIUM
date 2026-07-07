"use client";

import { useRef, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { ModalShell, type Season } from "./SeasonsManager";

// Estructura que devuelve la edge function `parse-image` en modo calendar.
// Igual que ScannedMatchday en imageRecognition.ts de la app móvil.
interface ScannedMatchday {
  jornada_number?: number;
  opponent: string;
  match_date?: string; // YYYY-MM-DD
  match_time?: string; // HH:MM
  is_home: boolean;
}
interface ParseResponse {
  items?: ScannedMatchday[];
  error?: string;
}

type Phase = "pick" | "scanning" | "review";

// Importación de calendario por imagen. Adaptación web del ScanSheet móvil:
//  - en vez de cámara nativa → <input type="file" accept="image/*"> (admite
//    "tomar foto" en móviles que exponen la cámara al file picker).
//  - lee el archivo a base64 (sin prefijo data:) y lo manda a la MISMA edge
//    function `parse-image` con { mode:'calendar', image, mime, team_name }.
//  - muestra las jornadas detectadas para revisar/editar/descartar antes de
//    insertarlas en bloque. Tras el insert masivo llama una vez al RPC
//    renumber_season_matchdays (igual que handleBulkMatchdays + el trigger BD).
export function ImportCalendarModal({
  season,
  teamName,
  existingCount,
  onClose,
  onImported,
}: {
  season: Season;
  teamName: string;
  existingCount: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [rows, setRows] = useState<ScannedMatchday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPhase("scanning");
    try {
      const { base64, mime } = await fileToBase64(file);
      const { data, error: fnErr } = await getSupabaseApp().functions.invoke(
        "parse-image",
        { body: { mode: "calendar", image: base64, mime, team_name: teamName } },
      );
      if (fnErr) throw fnErr;
      const res = data as ParseResponse | null;
      if (!res) throw new Error("Respuesta vacía del reconocimiento.");
      if (res.error) throw new Error(res.error);
      const items = (res.items ?? []).filter((m) => m.opponent?.trim());
      if (items.length === 0) {
        setError(
          "No se detectaron jornadas en la imagen. Prueba con una captura más nítida del calendario.",
        );
        setPhase("pick");
        return;
      }
      setRows(items.map((m) => ({ ...m, opponent: m.opponent.trim() })));
      setPhase("review");
    } catch (e) {
      setError(
        (e as { message?: string })?.message ??
          "No se pudo procesar la imagen.",
      );
      setPhase("pick");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const update = (i: number, patch: Partial<ScannedMatchday>) =>
    setRows((r) => r.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const removeRow = (i: number) =>
    setRows((r) => r.filter((_, idx) => idx !== i));

  // Inserta todas las jornadas detectadas. jornada_number temporal único por
  // inserción (existingCount+1+i); el RPC posterior reordena por fecha.
  const confirm = async () => {
    if (saving || rows.length === 0) return;
    setSaving(true);
    setError(null);
    const sb = getSupabaseApp();
    try {
      const payload = rows.map((m, i) => ({
        season_id: season.id,
        jornada_number: existingCount + 1 + i,
        opponent: m.opponent.trim(),
        match_date: m.match_date || null,
        match_time: m.match_time || null,
        is_home: m.is_home,
      }));
      const { error: insErr } = await sb.from("matchdays").insert(payload);
      if (insErr) throw insErr;
      const { error: rpcErr } = await sb.rpc("renumber_season_matchdays", {
        target_season: season.id,
      });
      if (rpcErr) throw rpcErr;
      onImported();
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo importar.");
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)]">
        IMPORTAR CALENDARIO
      </p>
      <h3 className="text-xl font-bold tracking-tight mt-1">
        Escanear calendario
      </h3>
      <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
        {season.name}
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {/* ── Selector ── */}
      {phase === "pick" && (
        <div className="mt-5">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border border-dashed border-[var(--color-hair-strong)] text-[var(--color-text-muted)] transition hover:border-[var(--color-accent-40)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-10)]"
          >
            <span className="text-2xl">📷</span>
            <span className="text-[14px] font-semibold">
              Subir foto del calendario
            </span>
            <span className="font-mono text-[10px] tracking-wide text-[var(--color-text-faint)]">
              JPG / PNG · captura de la app de tu federación
            </span>
          </button>
          <p className="mt-3 text-[12px] text-[var(--color-text-faint)] leading-relaxed">
            Detectaremos rival, fecha, hora y local/visitante de cada jornada.
            Podrás revisar y corregir antes de guardar.
          </p>
        </div>
      )}

      {/* ── Procesando ── */}
      {phase === "scanning" && (
        <div className="mt-5 flex flex-col items-center justify-center gap-3 py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-hair-strong)] border-t-[var(--color-accent)] animate-spin" />
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Analizando la imagen…
          </p>
        </div>
      )}

      {/* ── Revisión ── */}
      {phase === "review" && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-faint)]">
              {rows.length} JORNADA{rows.length === 1 ? "" : "S"} DETECTADA
              {rows.length === 1 ? "" : "S"}
            </span>
            <button
              onClick={() => {
                setRows([]);
                setPhase("pick");
              }}
              className="font-mono text-[11px] text-[var(--color-accent)] hover:underline"
            >
              Cambiar imagen
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-1">
            {rows.map((m, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={m.opponent}
                    onChange={(e) => update(i, { opponent: e.target.value })}
                    placeholder="Rival"
                    className="flex-1 min-w-0 bg-transparent text-[14px] font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    aria-label="Descartar jornada"
                    className="shrink-0 w-6 h-6 grid place-items-center rounded-full border border-[var(--color-hair-strong)] text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] transition text-[13px] leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <input
                    type="date"
                    value={m.match_date ?? ""}
                    onChange={(e) =>
                      update(i, { match_date: e.target.value || undefined })
                    }
                    className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-hair)] px-2 py-1.5 font-mono text-[12px] text-[var(--color-text)] outline-none [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={m.match_time ?? ""}
                    onChange={(e) =>
                      update(i, { match_time: e.target.value || undefined })
                    }
                    className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-hair)] px-2 py-1.5 font-mono text-[12px] text-[var(--color-text)] outline-none [color-scheme:dark]"
                  />
                  <button
                    onClick={() => update(i, { is_home: !m.is_home })}
                    className={`px-3 py-1.5 rounded-lg font-mono text-[11px] tracking-wide border transition ${
                      m.is_home
                        ? "border-[var(--color-accent-40)] text-[var(--color-accent)] bg-[var(--color-accent-10)]"
                        : "border-[var(--color-hair-strong)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {m.is_home ? "CASA" : "FUERA"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] text-[var(--color-text)] font-semibold text-[14px] transition hover:bg-[var(--color-bg-card-2)] disabled:opacity-50"
        >
          Cancelar
        </button>
        {phase === "review" && (
          <button
            onClick={confirm}
            disabled={saving || rows.length === 0}
            className="flex-[1.6] h-11 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[14px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40"
          >
            {saving
              ? "Importando…"
              : `Importar ${rows.length} jornada${rows.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    </ModalShell>
  );
}

// Lee un File a base64 SIN el prefijo `data:<mime>;base64,` — la edge
// function espera el base64 crudo (igual que ImagePicker.base64 en móvil).
function fileToBase64(
  file: File,
): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve({
        base64: comma >= 0 ? result.slice(comma + 1) : result,
        mime: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
  });
}
