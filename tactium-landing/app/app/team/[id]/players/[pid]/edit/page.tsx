"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { Reveal } from "@/app/app/ui/Reveal";
import { PhotoPicker } from "../../PlayerForm";

// Editar jugador + dar de baja / borrar. Réplica de players.ts:
//   - updatePlayer (nombre, alias, posición, pts, photo_url)
//   - "Baja" = update active:false (sigue en histórico, no en alineables)
//   - "Borrar" = delete (cascada server-side)
// Gating UI por owner; RLS hace el control real.

type Side = "Drive" | "Revés" | "Ambos";
const SIDES: Side[] = ["Drive", "Revés", "Ambos"];
const NAME_MAX = 64;
const PTS_MAX = 99999;

const sanitizePts = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return String(Math.min(parseInt(digits, 10) || 0, PTS_MAX));
};

interface PlayerRow {
  id: string;
  name: string;
  alias: string | null;
  position: Side;
  pts: number;
  photo_url: string | null;
  active: boolean;
  user_id: string | null;
}

export default function EditPlayerPage() {
  const params = useParams<{ id: string; pid: string }>();
  const { id: teamId, pid } = params;
  const session = useSession();
  const router = useRouter();

  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [side, setSide] = useState<Side>("Drive");
  const [pts, setPts] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!teamId || !pid) return;
    const sb = getSupabaseApp();
    (async () => {
      try {
        const team = await sb
          .from("teams")
          .select("owner_id")
          .eq("id", teamId)
          .single();
        if (team.error) throw team.error;
        setCanEdit((team.data as { owner_id: string }).owner_id === session.user.id);

        const p = await sb
          .from("players")
          .select("id, name, alias, position, pts, photo_url, active, user_id")
          .eq("id", pid)
          .single();
        if (p.error) throw p.error;
        const row = p.data as PlayerRow;
        setPlayer(row);
        setName(row.name);
        setAlias(row.alias ?? "");
        setSide(row.position);
        setPts(String(row.pts));
      } catch (e) {
        setLoadError((e as { message?: string })?.message ?? "Error al cargar.");
      }
    })();
  }, [teamId, pid, session.user.id]);

  const nameValid = name.trim().length >= 2;

  const onSave = async () => {
    if (!nameValid || saving || !canEdit || !player) return;
    setSaving(true);
    setError(null);
    const sb = getSupabaseApp();
    try {
      let photoUrl: string | null | undefined = undefined;

      if (removePhoto && !photoFile) {
        photoUrl = null;
      }
      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["png", "webp", "jpg", "jpeg"].includes(ext) ? ext : "jpg";
        const path = `${teamId}/${player.id}_${Date.now()}.${safeExt}`;
        const up = await sb.storage
          .from("player-avatars")
          .upload(path, photoFile, {
            contentType: photoFile.type || "image/jpeg",
            upsert: false,
          });
        if (up.error) throw up.error;
        photoUrl = sb.storage.from("player-avatars").getPublicUrl(path).data.publicUrl;
      }

      const patch: Record<string, unknown> = {
        name: name.trim().replace(/\s+/g, " ").slice(0, NAME_MAX),
        alias: alias.trim() ? alias.trim() : null,
        position: side,
        pts: pts.trim() === "" ? 0 : Number(pts),
      };
      if (photoUrl !== undefined) patch.photo_url = photoUrl;

      const { error: updErr } = await sb.from("players").update(patch).eq("id", player.id);
      if (updErr) throw updErr;
      router.push(`/app/team/${teamId}`);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo guardar.");
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!player || working || !canEdit) return;
    setWorking(true);
    setError(null);
    try {
      const next = !player.active;
      const { error: e } = await getSupabaseApp()
        .from("players")
        .update({ active: next })
        .eq("id", player.id);
      if (e) throw e;
      setPlayer({ ...player, active: next });
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo cambiar.");
    } finally {
      setWorking(false);
    }
  };

  const onDelete = async () => {
    if (!player || working || !canEdit) return;
    setWorking(true);
    setError(null);
    try {
      const { error: e } = await getSupabaseApp()
        .from("players")
        .delete()
        .eq("id", player.id);
      if (e) throw e;
      router.push(`/app/team/${teamId}`);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo borrar.");
      setWorking(false);
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

      {loadError && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {loadError}
        </div>
      )}

      <Reveal className="mb-7">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          EDITAR JUGADOR
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {player ? player.name : "…"}
        </h1>
        {player && !player.active && (
          <span className="inline-block mt-2 font-mono text-[10px] tracking-[0.12em] text-[var(--color-warning)] border border-[var(--color-warning)]/40 rounded px-2 py-0.5">
            DE BAJA
          </span>
        )}
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      {player && !canEdit && (
        <div className="mb-5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
          Solo el capitán del equipo puede editar jugadores.
        </div>
      )}

      {!player && !loadError && (
        <div className="max-w-xl h-80 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse" />
      )}

      {player && (
        <Reveal delay={60} className="max-w-xl rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-6 flex flex-col gap-5">
          <PhotoPicker
            name={name || player.name}
            preview={photoPreview}
            current={removePhoto ? null : player.photo_url}
            disabled={!canEdit}
            onPick={(file, url) => {
              setPhotoFile(file);
              setPhotoPreview(url);
              setRemovePhoto(false);
            }}
            onRemove={() => {
              setPhotoFile(null);
              setPhotoPreview(null);
              setRemovePhoto(true);
            }}
          />
          {player.user_id && (
            <p className="-mt-2 text-[12px] text-[var(--color-text-faint)]">
              Cuenta vinculada · si el jugador subió foto en su perfil, prevalece la suya.
            </p>
          )}

          <Field label="Nombre">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              disabled={!canEdit}
              className="input"
            />
          </Field>

          <Field label="Alias (opcional)">
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

          <Field label="Puntos FEP">
            <input
              value={pts}
              onChange={(e) => setPts(sanitizePts(e.target.value))}
              inputMode="numeric"
              maxLength={5}
              disabled={!canEdit}
              className="input font-mono w-32"
            />
          </Field>

          <button
            onClick={onSave}
            disabled={!nameValid || saving || !canEdit}
            className="mt-1 h-12 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[15px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>

          {canEdit && (
            <div className="mt-2 pt-5 border-t border-[var(--color-hair)] flex flex-col gap-3">
              <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-faint)] uppercase">
                Zona peligrosa
              </p>
              <button
                onClick={toggleActive}
                disabled={working}
                className="h-11 rounded-xl border border-[var(--color-hair-strong)] text-[14px] font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] hover:border-[var(--color-warning)] disabled:opacity-40"
              >
                {player.active ? "Dar de baja (mantiene histórico)" : "Reactivar jugador"}
              </button>

              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={working}
                  className="h-11 rounded-xl border border-[var(--color-error)]/40 text-[14px] font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error)]/10 disabled:opacity-40"
                >
                  Borrar jugador definitivamente
                </button>
              ) : (
                <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/5 p-4 flex flex-col gap-3">
                  <p className="text-[13px] text-[var(--color-text)]">
                    ¿Seguro? Se borrará al jugador y su histórico. Esta acción no se
                    puede deshacer.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={onDelete}
                      disabled={working}
                      className="flex-1 h-10 rounded-lg bg-[var(--color-error)] text-white text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-40"
                    >
                      {working ? "Borrando…" : "Sí, borrar"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={working}
                      className="flex-1 h-10 rounded-lg border border-[var(--color-hair-strong)] text-[13px] font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Reveal>
      )}

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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-muted)] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
