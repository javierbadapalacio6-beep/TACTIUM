"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ROLE_LABELS, useSession } from "@/lib/session";
import {
  deleteMyAvatar,
  exportMyData,
  updateMyProfile,
  uploadMyAvatar,
} from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import {
  Avatar,
  Btn,
  Card,
  CardHead,
  Field,
  Input,
  ListRow,
} from "@/components/ui";
import { Toast } from "@/components/states";
import { IconDownload, IconFile, IconLock } from "@/components/Icon";

/**
 * Mis datos (RGPD) y edición del perfil.
 *
 * La exportación NO se arma en cliente con lo que se ve en pantalla: eso no es
 * portabilidad, es una captura. Se pide el volcado completo al servidor con la
 * RPC `export_my_data`, la misma que usa la app.
 */
export function MisDatos() {
  const { user, role, teams, clubId, refresh } = useSession();
  const [downloading, setDownloading] = useState(false);

  const [fullName, setFullName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // La sesión llega asíncrona: sin esto los campos nacen vacíos y al escribir
  // se pisarían con los valores que lleguen después.
  useEffect(() => {
    setFullName(user?.name ?? "");
    setUsername(user?.username ?? "");
  }, [user?.name, user?.username]);

  const profileDirty =
    fullName.trim() !== (user?.name ?? "") ||
    (username.trim() || null) !== (user?.username ?? null);

  async function saveProfile() {
    if (savingProfile || !profileDirty) return;
    setSavingProfile(true);
    const res = await guardedWrite("guardar el perfil", () =>
      updateMyProfile({ fullName, username: username.trim() || null }),
    );
    setSavingProfile(false);
    if (res.ok) {
      await refresh();
      setToast("Perfil guardado");
    } else setToast(res.reason);
  }

  async function pickAvatar(file: File | undefined) {
    if (!file || avatarBusy) return;
    setAvatarBusy(true);
    const res = await guardedWrite("cambiar la foto", () => uploadMyAvatar(file));
    setAvatarBusy(false);
    if (res.ok) {
      await refresh();
      setToast("Foto actualizada");
    } else setToast(res.reason);
  }

  async function removeAvatar() {
    if (avatarBusy) return;
    setAvatarBusy(true);
    const res = await guardedWrite("quitar la foto", deleteMyAvatar);
    setAvatarBusy(false);
    if (res.ok) {
      await refresh();
      setToast("Foto quitada");
    } else setToast(res.reason);
  }

  // Datos REALES de la sesión (no maqueta). Un usuario nuevo ve lo suyo (o
  // vacío), nunca los de una cuenta demo.
  const rows = useMemo(
    () =>
      [
        { label: "Nombre", value: user?.name || "—", mono: false },
        { label: "Email", value: user?.email || "—", mono: false },
        { label: "Rol", value: ROLE_LABELS[role] ?? role, mono: false },
        {
          label: "Equipos a los que perteneces",
          value: String(teams.length),
          mono: true,
        },
        { label: "Club", value: clubId ? "Sí" : "No", mono: false },
        { label: "Identificador interno", value: user?.id || "—", mono: true },
      ] as { label: string; value: string; mono: boolean }[],
    [user, role, teams, clubId],
  );

  async function exportJson() {
    if (downloading) return;
    setDownloading(true);
    try {
      const datos = await exportMyData();
      const payload = {
        exportadoEl: new Date().toISOString(),
        origen: "TACTIUM web",
        datos,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mis-datos-tactium.json";
      a.click();
      // Liberamos el object URL: si no, el blob se queda en memoria toda la sesión.
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast(
        e instanceof Error ? e.message : "No se han podido exportar tus datos",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Perfil ────────────────────────────────────────────────── */}
      <Card flush>
        <CardHead title="Tu perfil" sub="Cómo te ven los demás en TACTIUM" />
        <div className="card-body">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              paddingBottom: 18,
              marginBottom: 18,
              borderBottom: "1px solid var(--line)",
            }}
          >
            <Avatar initials={user?.initials ?? "··"} src={user?.avatarUrl} size={64} />

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                {user?.name ?? "Tu cuenta"}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
                JPG, PNG o WebP. Se recorta en cuadrado.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  void pickAvatar(e.target.files?.[0]);
                  // Sin esto, elegir el mismo archivo dos veces no dispara change.
                  e.target.value = "";
                }}
              />
              <Btn onClick={() => fileRef.current?.click()} disabled={avatarBusy}>
                {avatarBusy ? "Subiendo…" : user?.avatarUrl ? "Cambiar foto" : "Subir foto"}
              </Btn>
              {user?.avatarUrl && (
                <Btn variant="quiet" onClick={() => void removeAvatar()} disabled={avatarBusy}>
                  Quitar
                </Btn>
              )}
            </div>
          </div>

          <div className="tw-form-grid">
            <Field label="Nombre" htmlFor="perfil-nombre">
              <Input
                id="perfil-nombre"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre y apellidos"
              />
            </Field>

            <Field
              label="Nombre de usuario"
              htmlFor="perfil-usuario"
              hint="Sin espacios y único. Es el que se ve en tu perfil público."
            >
              <Input
                id="perfil-usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tunombre"
              />
            </Field>
          </div>
        </div>
        <div className="card-foot" style={{ justifyContent: "flex-end" }}>
          <Btn
            variant="accent"
            onClick={() => void saveProfile()}
            disabled={!profileDirty || savingProfile}
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </Btn>
        </div>
      </Card>

      {/* ── Resumen de datos ──────────────────────────────────────── */}
      <Card flush>
        <CardHead title="Resumen de tus datos" />
        <div className="card-body">
          <dl className="kv" style={{ margin: 0, gridTemplateColumns: "minmax(140px, 220px) minmax(0, 1fr)" }}>
            {rows.map((d) => (
              <div key={d.label} style={{ display: "contents" }}>
                <dt>{d.label}</dt>
                <dd className={d.mono ? "mono" : undefined} style={{ wordBreak: "break-all" }}>
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {/* ── Exportar y políticas ──────────────────────────────────── */}
      <Card flush>
        <CardHead title="Portabilidad y políticas" />
        <ListRow
          icon={
            <span className="tile-icon">
              <IconDownload size={16} />
            </span>
          }
          title="Descargar mis datos"
          sub="Un archivo JSON con todo lo que guardamos de ti."
          chevron={false}
          right={
            <Btn size="sm" variant="accent" onClick={exportJson} disabled={downloading}>
              {downloading ? "Preparando…" : "Descargar"}
            </Btn>
          }
        />
        <ListRow
          href="/legal/terminos"
          icon={
            <span className="tile-icon tile-icon-mute">
              <IconFile size={16} />
            </span>
          }
          title="Términos del servicio"
        />
        <ListRow
          href="/legal/privacidad"
          icon={
            <span className="tile-icon tile-icon-mute">
              <IconLock size={16} />
            </span>
          }
          title="Política de privacidad"
        />
      </Card>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
