"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { Reveal } from "@/app/app/ui/Reveal";
import { PhotoPicker } from "../PlayerForm";

// Añadir jugador manual a la plantilla. Réplica web del flujo móvil
// AddPlayersScreen + createPlayer(players.ts): nombre, alias, posición
// Drive/Revés/Ambos, puntos FEP y foto opcional (bucket player-avatars).
// La RLS controla quién puede insertar; aquí solo gateamos UI por owner.

type Side = "Drive" | "Revés" | "Ambos";
const SIDES: Side[] = ["Drive", "Revés", "Ambos"];
const NAME_MAX = 64;
const PTS_MAX = 99999;

const sanitizePts = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return String(Math.min(parseInt(digits, 10) || 0, PTS_MAX));
};

export default function NewPlayerPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const session = useSession();
  const router = useRouter();

  const [teamName, setTeamName] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [side, setSide] = useState<Side>("Drive");
  const [pts, setPts] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;
    getSupabaseApp()
      .from("teams")
      .select("name, owner_id")
      .eq("id", teamId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setCanEdit(false);
          return;
        }
        const t = data as { name: string; owner_id: string };
        setTeamName(t.name);
        setCanEdit(t.owner_id === session.user.id);
      });
  }, [teamId, session.user.id]);

  const nameValid = name.trim().length >= 2;

  const onSubmit = async () => {
    if (!nameValid || saving || !canEdit) return;
    setSaving(true);
    setError(null);
    const sb = getSupabaseApp();
    try {
      const cleanName = name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
      const cleanAlias = alias.trim() ? alias.trim() : null;
      const { data, error: insErr } = await sb
        .from("players")
        .insert({
          team_id: teamId,
          name: cleanName,
          alias: cleanAlias,
          position: side,
          pts: pts.trim() === "" ? 200 : Number(pts),
          available: true,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      const playerId = (data as { id: string }).id;

      // Foto opcional → bucket player-avatars con path {team_id}/{player_id}_{ts}.ext
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["png", "webp", "jpg", "jpeg"].includes(ext)
          ? ext
          : "jpg";
        const path = `${teamId}/${playerId}_${Date.now()}.${safeExt}`;
        const up = await sb.storage
          .from("player-avatars")
          .upload(path, photoFile, {
            contentType: photoFile.type || "image/jpeg",
            upsert: false,
          });
        if (!up.error) {
          const {
            data: { publicUrl },
          } = sb.storage.from("player-avatars").getPublicUrl(path);
          await sb.from("players").update({ photo_url: publicUrl }).eq("id", playerId);
        }
      }

      router.push(`/app/team/${teamId}`);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo añadir.");
      setSaving(false);
    }
  };

  return (
    <>
      <Link
        href={`/app/team/${teamId}`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> PLANTILLA
      </Link>

      <Reveal className="mb-7">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          NUEVO JUGADOR{teamName ? ` · ${teamName.toUpperCase()}` : ""}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Añadir a la plantilla</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Los puntos FEP determinan el orden de las parejas.
        </p>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      {canEdit === false && (
        <div className="mb-5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Solo el capitán del equipo puede añadir jugadores.
        </div>
      )}

      <Reveal delay={60} className="max-w-xl rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-6 flex flex-col gap-5">
        <PhotoPicker
          name={name || "Nuevo"}
          preview={photoPreview}
          disabled={!canEdit}
          onPick={(file, url) => {
            setPhotoFile(file);
            setPhotoPreview(url);
          }}
        />

        <Field label="Nombre">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            disabled={!canEdit}
            autoFocus
            placeholder="Nombre y apellidos"
            className="input"
          />
        </Field>

        <Field label="Alias (opcional)" hint="Cómo se muestra en alineaciones">
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            maxLength={NAME_MAX}
            disabled={!canEdit}
            placeholder="Apodo"
            className="input"
          />
        </Field>

        <Field label="Posición">
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-raised)] border border-[var(--color-hair)]">
            {SIDES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canEdit}
                onClick={() => setSide(s)}
                className={`flex-1 h-10 rounded-lg text-[13px] font-semibold transition ${
                  side === s
                    ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Puntos FEP" hint="Por defecto 200 si lo dejas vacío">
          <input
            value={pts}
            onChange={(e) => setPts(sanitizePts(e.target.value))}
            inputMode="numeric"
            maxLength={5}
            disabled={!canEdit}
            placeholder="200"
            className="input font-mono w-32"
          />
        </Field>

        <button
          onClick={onSubmit}
          disabled={!nameValid || saving || !canEdit}
          className="mt-1 h-12 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[15px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando…" : "Añadir jugador"}
        </button>
      </Reveal>

      <style jsx global>{`
        .input {
          background: var(--color-bg-raised);
          border: 1px solid var(--color-hair-strong);
          border-radius: 12px;
          padding: 12px 14px;
          color: var(--color-text);
          font-size: 14px;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: var(--color-accent-40);
        }
      `}</style>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
        {label}
        {hint && (
          <span className="ml-2 normal-case tracking-normal text-[var(--color-text-faint)]">
            · {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
