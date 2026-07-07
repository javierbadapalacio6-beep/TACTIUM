"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { Reveal } from "@/app/app/ui/Reveal";

// Escanear ranking FEP → reconocimiento → previsualizar → añadir en bloque.
// Réplica del flujo móvil ScanSheet(mode:'ranking') + imageRecognition.ts +
// bulkUpsertPlayers:
//   - Edge function 'parse-image' con { mode:'ranking', image:base64, mime }
//     devuelve { items: ScannedPlayer[] }.
//   - UPSERT por nombre normalizado contra la plantilla existente: actualiza
//     pts (y position si el OCR aporta una != 'Ambos'), o inserta nuevo.
// Adaptación web: la cámara nativa pasa a <input type="file" accept="image/*">.

type Side = "Drive" | "Revés" | "Ambos";
interface ScannedPlayer {
  name: string;
  pts?: number;
  position?: Side;
}
interface ExistingPlayer {
  id: string;
  name: string;
  pts: number;
  position: Side;
}
interface Row extends ScannedPlayer {
  include: boolean;
}

// trim + lowercase + sin acentos + colapsar espacios (igual que bulkUpsertPlayers)
const normMatch = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

const fileToBase64 = (file: File): Promise<{ base64: string; mime: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // dataURL → "data:<mime>;base64,<payload>"
      const comma = result.indexOf(",");
      resolve({ base64: result.slice(comma + 1), mime: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });

export default function ScanPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const session = useSession();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [teamName, setTeamName] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [existing, setExisting] = useState<ExistingPlayer[]>([]);

  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    const sb = getSupabaseApp();
    (async () => {
      try {
        const team = await sb
          .from("teams")
          .select("name, owner_id")
          .eq("id", teamId)
          .single();
        if (team.error) throw team.error;
        const t = team.data as { name: string; owner_id: string };
        setTeamName(t.name);
        setCanEdit(t.owner_id === session.user.id);

        const pl = await sb
          .from("players")
          .select("id, name, pts, position")
          .eq("team_id", teamId)
          .eq("active", true);
        if (pl.error) throw pl.error;
        setExisting((pl.data ?? []) as ExistingPlayer[]);
      } catch (e) {
        setError((e as { message?: string })?.message ?? "Error al cargar.");
      }
    })();
  }, [teamId, session.user.id]);

  const onPickFile = async (file: File) => {
    setError(null);
    setDone(null);
    setRows(null);
    setImgPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const { base64, mime } = await fileToBase64(file);
      const { data, error: fnErr } = await getSupabaseApp().functions.invoke(
        "parse-image",
        { body: { mode: "ranking", image: base64, mime, team_name: teamName } },
      );
      if (fnErr) throw fnErr;
      const payload = data as { items?: ScannedPlayer[]; error?: string };
      if (payload?.error) throw new Error(payload.error);
      const items = payload?.items ?? [];
      if (items.length === 0) {
        setError(
          "No se reconoció ningún jugador. Prueba con una captura más nítida del ranking.",
        );
      }
      setRows(items.map((it) => ({ ...it, include: true })));
    } catch (e) {
      setError(
        (e as { message?: string })?.message ??
          "No se pudo procesar la imagen.",
      );
    } finally {
      setScanning(false);
    }
  };

  const matchFor = (name: string) => {
    const key = normMatch(name);
    return existing.find((p) => normMatch(p.name) === key) ?? null;
  };

  const selected = (rows ?? []).filter((r) => r.include);
  const newCount = selected.filter((r) => !matchFor(r.name)).length;
  const updCount = selected.length - newCount;

  const onConfirm = async () => {
    if (!canEdit || saving || selected.length === 0) return;
    setSaving(true);
    setError(null);
    const sb = getSupabaseApp();
    try {
      let added = 0;
      let updated = 0;
      for (const r of selected) {
        const match = matchFor(r.name);
        if (match) {
          const patch: { pts: number; position?: Side } = {
            pts: r.pts ?? match.pts,
          };
          if (r.position && r.position !== "Ambos" && r.position !== match.position) {
            patch.position = r.position;
          }
          const { error: e } = await sb
            .from("players")
            .update(patch)
            .eq("id", match.id);
          if (e) throw e;
          updated++;
        } else {
          const { error: e } = await sb.from("players").insert({
            team_id: teamId,
            name: r.name.trim(),
            pts: r.pts ?? 0,
            position: r.position ?? "Ambos",
            available: true,
          });
          if (e) throw e;
          added++;
        }
      }
      const parts: string[] = [];
      if (added > 0) parts.push(`${added} ${added === 1 ? "nuevo" : "nuevos"}`);
      if (updated > 0)
        parts.push(`${updated} ${updated === 1 ? "actualizado" : "actualizados"}`);
      setDone(`Plantilla actualizada · ${parts.join(" · ")}`);
      setTimeout(() => router.push(`/app/team/${teamId}`), 1200);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo guardar.");
      setSaving(false);
    }
  };

  return (
    <>
      <Link
        href={`/app/team/${teamId}`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> EQUIPO
      </Link>

      <Reveal className="mb-7">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          ESCANEAR RANKING{teamName ? ` · ${teamName.toUpperCase()}` : ""}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Importar plantilla desde una imagen
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-lg">
          Sube una captura del ranking FEP (o PDF/foto). Reconoceremos los
          jugadores y sus puntos para añadirlos en bloque. Si un jugador ya
          existe, se actualizan sus puntos.
        </p>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}
      {done && (
        <div className="mb-5 rounded-xl border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] px-4 py-3 text-[13px] text-[var(--color-accent)]">
          {done}
        </div>
      )}

      {!canEdit && (
        <div className="mb-5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Solo el capitán del equipo puede importar jugadores.
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        disabled={!canEdit || scanning}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Drop / preview */}
        <button
          type="button"
          disabled={!canEdit || scanning}
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-5 text-left transition hover:border-[var(--color-accent-40)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {imgPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgPreview}
              alt="Captura del ranking"
              className="w-full rounded-xl object-cover max-h-72 border border-[var(--color-hair)]"
            />
          ) : (
            <div className="aspect-[3/4] grid place-items-center text-center">
              <div>
                <div className="text-3xl mb-2">⬆</div>
                <p className="text-[14px] font-semibold">Subir captura</p>
                <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
                  Imagen o PDF del ranking
                </p>
              </div>
            </div>
          )}
          {imgPreview && (
            <p className="mt-3 text-center font-mono text-[11px] text-[var(--color-accent)]">
              {scanning ? "Reconociendo…" : "Cambiar imagen"}
            </p>
          )}
        </button>

        {/* Preview de resultados */}
        <div>
          {scanning && (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
                />
              ))}
            </div>
          )}

          {!scanning && rows && rows.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-muted)]">
                  {rows.length} RECONOCIDOS · {selected.length} SELECCIONADOS
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((r, idx) => {
                  const match = matchFor(r.name);
                  return (
                    <Reveal
                      as="li"
                      key={idx}
                      delay={Math.min(idx * 30, 240)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition ${
                        r.include
                          ? "border-[var(--color-hair-strong)] bg-[var(--color-bg-card)]"
                          : "border-[var(--color-hair)] bg-[var(--color-bg-raised)] opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={r.include}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setRows((rs) =>
                            (rs ?? []).map((x, i) =>
                              i === idx ? { ...x, include: e.target.checked } : x,
                            ),
                          )
                        }
                        className="w-4 h-4 accent-[var(--color-accent)] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold tracking-tight truncate block">
                          {r.name}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                          {[r.position, r.pts != null ? `${r.pts} pts` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[9px] tracking-[0.1em] rounded px-1.5 py-0.5 border ${
                          match
                            ? "text-[var(--color-warning)] border-[var(--color-warning)]/40"
                            : "text-[var(--color-accent)] border-[var(--color-accent-40)]"
                        }`}
                      >
                        {match ? "ACTUALIZA" : "NUEVO"}
                      </span>
                    </Reveal>
                  );
                })}
              </ul>

              {canEdit && (
                <button
                  onClick={onConfirm}
                  disabled={saving || selected.length === 0}
                  className="mt-5 h-12 px-6 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[15px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving
                    ? "Guardando…"
                    : `Añadir ${selected.length} ${
                        selected.length === 1 ? "jugador" : "jugadores"
                      }${
                        updCount > 0
                          ? ` (${newCount} nuevos · ${updCount} actualizan)`
                          : ""
                      }`}
                </button>
              )}
            </>
          )}

          {!scanning && !rows && !imgPreview && (
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Sube una imagen a la izquierda para empezar.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
