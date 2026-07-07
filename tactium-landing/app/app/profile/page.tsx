"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { TiltCard } from "@/app/app/TiltCard";
import { Reveal } from "@/app/app/ui/Reveal";

// ─────────────────────────────────────────────────────────────────────────
// PERFIL (web) — réplica de ProfileScreen + MyDataScreen de la app móvil.
//
// Adaptaciones web (reglas del proyecto):
//  · Foto: <input type="file" accept="image/*"> en vez de cámara nativa.
//    El upload replica avatar.ts: bucket 'avatars', path {uid}/avatar_{ts}.ext,
//    cleanup de archivos antiguos, y profiles.avatar_url con la URL pública.
//  · Exportar: RPC export_my_data → descarga de un Blob JSON (Share sheet en
//    móvil no existe en web).
//  · Eliminar cuenta: RPC delete_my_account con DOBLE confirmación, avisando
//    de que la suscripción de tienda sigue activa; tras borrar, signOut.
//  · Sin compras in-app: no se muestra gestión/activación de suscripción.
// ─────────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  notifications_enabled: boolean;
  created_at: string;
}

const BUCKET = "avatars";

function detectExt(name: string): { ext: string; contentType: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return { ext: "png", contentType: "image/png" };
  if (lower.endsWith(".webp")) return { ext: "webp", contentType: "image/webp" };
  return { ext: "jpg", contentType: "image/jpeg" };
}

function initialsOf(s: string): string {
  return (
    s
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function ProfilePage() {
  const session = useSession();
  const userId = session.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edición de nombre.
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Avatar.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Notificaciones.
  const [togglingNotif, setTogglingNotif] = useState(false);

  // Exportar.
  const [exporting, setExporting] = useState(false);

  // Eliminar cuenta (doble confirmación con texto de seguridad).
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Toast efímero.
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );
  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    getSupabaseApp()
      .from("profiles")
      .select("id, email, full_name, avatar_url, notifications_enabled, created_at")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          return;
        }
        const p = data as Profile | null;
        setProfile(p);
        setName(p?.full_name ?? "");
      });
  }, [userId]);

  // ─── Nombre ──────────────────────────────────────────────────────────
  const saveName = async () => {
    const next = name.trim();
    if (!profile || savingName || next === (profile.full_name ?? "")) return;
    setSavingName(true);
    const { error } = await getSupabaseApp()
      .from("profiles")
      .update({ full_name: next || null })
      .eq("id", userId);
    setSavingName(false);
    if (error) {
      showToast("err", "No se pudo guardar el nombre.");
      return;
    }
    setProfile({ ...profile, full_name: next || null });
    showToast("ok", "Nombre actualizado");
  };

  // ─── Avatar ──────────────────────────────────────────────────────────
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Permite re-elegir el mismo archivo tras un fallo.
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !profile) return;

    setAvatarBusy(true);
    try {
      const sb = getSupabaseApp();
      const { ext, contentType } = detectExt(file.name);
      const filename = `avatar_${Date.now()}.${ext}`;
      const path = `${userId}/${filename}`;

      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(path, file, { contentType, upsert: false });
      if (upErr) throw upErr;

      // Cleanup de avatars antiguos (no fatal si falla).
      try {
        const { data: files } = await sb.storage.from(BUCKET).list(userId);
        const oldPaths = (files ?? [])
          .filter((f) => f.name !== filename)
          .map((f) => `${userId}/${f.name}`);
        if (oldPaths.length > 0) await sb.storage.from(BUCKET).remove(oldPaths);
      } catch {
        /* ruido en storage, ignorable */
      }

      const {
        data: { publicUrl },
      } = sb.storage.from(BUCKET).getPublicUrl(path);

      const { error: updErr } = await sb
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (updErr) throw updErr;

      setProfile({ ...profile, avatar_url: publicUrl });
      showToast("ok", "Foto actualizada");
    } catch (err) {
      showToast("err", (err as Error)?.message ?? "No se pudo subir la foto.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!profile || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const sb = getSupabaseApp();
      const { data: files } = await sb.storage.from(BUCKET).list(userId);
      if (files && files.length > 0) {
        await sb.storage
          .from(BUCKET)
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
      const { error } = await sb
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (error) throw error;
      setProfile({ ...profile, avatar_url: null });
      showToast("ok", "Foto eliminada");
    } catch (err) {
      showToast("err", (err as Error)?.message ?? "No se pudo eliminar.");
    } finally {
      setAvatarBusy(false);
    }
  };

  // ─── Notificaciones ──────────────────────────────────────────────────
  const toggleNotif = async () => {
    if (!profile || togglingNotif) return;
    const next = !profile.notifications_enabled;
    setTogglingNotif(true);
    // Optimista.
    setProfile({ ...profile, notifications_enabled: next });
    const { error } = await getSupabaseApp()
      .from("profiles")
      .update({ notifications_enabled: next })
      .eq("id", userId);
    setTogglingNotif(false);
    if (error) {
      setProfile({ ...profile, notifications_enabled: !next });
      showToast("err", "No se pudo cambiar.");
    }
  };

  // ─── Exportar (RPC export_my_data → descarga JSON) ───────────────────
  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { data, error } = await getSupabaseApp().rpc("export_my_data");
      if (error) throw error;
      const json = JSON.stringify(data ?? {}, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tactium-mis-datos-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("ok", "Datos descargados");
    } catch (err) {
      showToast("err", (err as Error)?.message ?? "No se pudieron exportar.");
    } finally {
      setExporting(false);
    }
  };

  // ─── Eliminar cuenta (RPC delete_my_account) ─────────────────────────
  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    const { error } = await getSupabaseApp().rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      showToast("err", error.message ?? "No se pudo eliminar la cuenta.");
      return;
    }
    // Tras borrar, el JWT queda huérfano → cerramos sesión (vuelve a Login).
    await getSupabaseApp().auth.signOut();
  };

  const displayName =
    profile?.full_name?.trim() ||
    (session.user.user_metadata?.full_name as string | undefined) ||
    session.user.email?.split("@")[0] ||
    "Capitán";

  const nameChanged =
    !!profile && name.trim() !== (profile.full_name ?? "");

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      <Reveal>
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          PERFIL
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">Tu cuenta</h1>
      </Reveal>

      {error && (
        <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          No se pudo cargar tu perfil: {error}
        </div>
      )}

      {!profile && !error && (
        <div className="flex flex-col gap-4">
          <div className="h-40 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse" />
          <div className="h-24 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse" />
          <div className="h-24 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse" />
        </div>
      )}

      {profile && (
        <div className="flex flex-col gap-8">
          {/* ── Avatar + identidad ───────────────────────────────────── */}
          <Reveal>
          <TiltCard className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)]">
            <div className="p-6 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative shrink-0">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover border-2 border-[var(--color-accent-40)]"
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-full grid place-items-center border-2 border-[var(--color-accent-40)] text-2xl font-bold text-[var(--color-accent)]"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-accent-10), var(--color-bg-card-2))",
                    }}
                  >
                    {initialsOf(displayName)}
                  </div>
                )}
                {avatarBusy && (
                  <div className="absolute inset-0 grid place-items-center rounded-full bg-[var(--color-bg)]/60">
                    <span className="font-mono text-[10px] tracking-widest text-[var(--color-accent)]">
                      …
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h2 className="text-xl font-bold tracking-tight truncate">
                  {displayName}
                </h2>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-1 truncate">
                  {profile.email ?? session.user.email ?? "—"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickFile}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarBusy}
                    className="text-[13px] font-medium px-3.5 h-9 rounded-full border border-[var(--color-accent-40)] text-[var(--color-accent)] transition hover:bg-[var(--color-accent-10)] disabled:opacity-50"
                  >
                    {profile.avatar_url ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {profile.avatar_url && (
                    <button
                      onClick={removeAvatar}
                      disabled={avatarBusy}
                      className="text-[13px] font-medium px-3.5 h-9 rounded-full border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] hover:border-[var(--color-text)] disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </TiltCard>
          </Reveal>

          {/* ── Editar nombre ────────────────────────────────────────── */}
          <Reveal delay={40} as="section">
            <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-text-faint)] mb-3">
              NOMBRE
            </p>
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                  }}
                  maxLength={80}
                  placeholder="Tu nombre completo"
                  className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg)] px-4 text-[15px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent-40)]"
                />
                <button
                  onClick={saveName}
                  disabled={!nameChanged || savingName}
                  className="h-11 px-5 rounded-xl font-semibold text-[14px] bg-[var(--color-accent)] text-[var(--color-bg)] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingName ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </Reveal>

          {/* ── Notificaciones ───────────────────────────────────────── */}
          <Reveal delay={80} as="section">
            <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-text-faint)] mb-3">
              PREFERENCIAS
            </p>
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">Notificaciones</p>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">
                  Avisos de jornadas, alineaciones y resultados.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={profile.notifications_enabled}
                aria-label="Notificaciones"
                onClick={toggleNotif}
                disabled={togglingNotif}
                className={`relative shrink-0 w-12 h-7 rounded-full transition border disabled:opacity-60 ${
                  profile.notifications_enabled
                    ? "bg-[var(--color-accent-25)] border-[var(--color-accent-40)]"
                    : "bg-[var(--color-bg-raised)] border-[var(--color-hair-strong)]"
                }`}
              >
                <span
                  className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all ${
                    profile.notifications_enabled
                      ? "left-[22px] bg-[var(--color-accent)]"
                      : "left-1 bg-[var(--color-text-faint)]"
                  }`}
                />
              </button>
            </div>
          </Reveal>

          {/* ── Exportar mis datos ───────────────────────────────────── */}
          <Reveal delay={120} as="section">
            <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-text-faint)] mb-3">
              MIS DATOS
            </p>
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">
                    Exportar mis datos
                  </p>
                  <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5 max-w-md">
                    Descarga en JSON todos los datos que TACTIUM guarda sobre ti
                    (derecho de portabilidad, RGPD Art. 20).
                  </p>
                </div>
                <button
                  onClick={exportData}
                  disabled={exporting}
                  className="shrink-0 h-11 px-5 rounded-xl font-semibold text-[14px] border border-[var(--color-accent-40)] text-[var(--color-accent)] transition hover:bg-[var(--color-accent-10)] disabled:opacity-50"
                >
                  {exporting ? "Generando…" : "Descargar JSON"}
                </button>
              </div>
            </div>
          </Reveal>

          {/* ── Cerrar sesión ────────────────────────────────────────── */}
          <Reveal delay={160}>
          <button
            onClick={() => getSupabaseApp().auth.signOut()}
            className="w-full h-12 rounded-xl border border-[var(--color-error)]/40 text-[var(--color-error)] font-semibold text-[15px] transition hover:bg-[var(--color-error)]/10"
          >
            Cerrar sesión
          </button>
          </Reveal>

          {/* ── Zona de peligro · eliminar cuenta ────────────────────── */}
          <Reveal delay={200} as="section" className="mt-4">
            <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-error)] opacity-70 mb-3">
              ZONA DE PELIGRO
            </p>
            <div className="rounded-2xl border border-[var(--color-error)]/25 bg-[var(--color-error)]/5 p-5">
              {deleteStep === 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight text-[var(--color-error)]">
                      Eliminar cuenta
                    </p>
                    <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5 max-w-md">
                      Borra tu perfil, equipos, jornadas, alineaciones,
                      resultados e invitaciones. Esta acción es irreversible.
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteStep(1)}
                    className="shrink-0 h-11 px-5 rounded-xl font-semibold text-[14px] border border-[var(--color-error)]/40 text-[var(--color-error)] transition hover:bg-[var(--color-error)]/10"
                  >
                    Eliminar cuenta
                  </button>
                </div>
              )}

              {deleteStep === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-semibold tracking-tight text-[var(--color-error)]">
                      ¿Seguro al 100%?
                    </p>
                    <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                      No podremos recuperar tus datos. Si tienes una suscripción
                      activa en App Store o Google Play,{" "}
                      <strong className="text-[var(--color-text)]">
                        seguirá activa
                      </strong>
                      : cancélala desde la tienda para dejar de pagar.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDeleteStep(0);
                        setConfirmText("");
                      }}
                      className="h-10 px-4 rounded-xl font-medium text-[14px] border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setDeleteStep(2)}
                      className="h-10 px-4 rounded-xl font-semibold text-[14px] border border-[var(--color-error)]/40 text-[var(--color-error)] transition hover:bg-[var(--color-error)]/10"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {deleteStep === 2 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="font-semibold tracking-tight text-[var(--color-error)]">
                      Confirmación final
                    </p>
                    <p className="text-[13px] text-[var(--color-text-muted)] mt-1">
                      Escribe{" "}
                      <span className="font-mono text-[var(--color-error)]">
                        ELIMINAR
                      </span>{" "}
                      para borrar tu cuenta de forma permanente.
                    </p>
                  </div>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="ELIMINAR"
                    autoFocus
                    className="h-11 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-bg)] px-4 text-[15px] text-[var(--color-text)] outline-none transition focus:border-[var(--color-error)]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setDeleteStep(0);
                        setConfirmText("");
                      }}
                      disabled={deleting}
                      className="h-10 px-4 rounded-xl font-medium text-[14px] border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] disabled:opacity-50"
                    >
                      Volver
                    </button>
                    <button
                      onClick={deleteAccount}
                      disabled={confirmText.trim() !== "ELIMINAR" || deleting}
                      className="h-10 px-4 rounded-xl font-semibold text-[14px] bg-[var(--color-error)] text-[var(--color-bg)] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Eliminando…" : "Sí, eliminar mi cuenta"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          <div className="flex items-center justify-center gap-2 pt-2 pb-6 opacity-50">
            <TactiumMark size={16} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-faint)]">
              TACTIUM · PANEL
            </span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-[13px] font-medium border backdrop-blur-md animate-[fadeIn_.2s_ease] ${
            toast.kind === "ok"
              ? "border-[var(--color-accent-40)] bg-[var(--color-accent-10)] text-[var(--color-accent)]"
              : "border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)]"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
