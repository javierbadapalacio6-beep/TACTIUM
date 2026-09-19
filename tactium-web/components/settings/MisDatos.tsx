"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useSession } from "@/lib/session";
import {
  deleteMyAvatar,
  exportMyData,
  updateMyProfile,
  uploadMyAvatar,
} from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow } from "@/components/ui";
import { Toast } from "@/components/states";
import { IconChevronRight, IconDownload } from "@/components/Icon";

/**
 * Mis datos (RGPD) y edición del perfil.
 *
 * La exportación NO se arma en cliente con lo que se ve en pantalla: eso no es
 * portabilidad, es una captura. Se pide el volcado completo al servidor con la
 * RPC `export_my_data`, la misma que usa la app.
 */
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--hair-strong)",
  background: "var(--bg-card)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

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
        { label: "Rol", value: user?.roleLabel || role, mono: false },
        {
          label: "Equipos a los que perteneces",
          value: String(teams.length),
          mono: true,
        },
        {
          label: "Club",
          value: clubId ? "Sí" : "No",
          mono: true,
        },
        { label: "ID interno", value: user?.id || "—", mono: true },
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

  const initials = (user?.initials ?? "··").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <Eyebrow>TU PERFIL</Eyebrow>
        <h2 style={{ margin: "14px 0 20px", fontSize: 24 }}>
          Cómo te ven los demás
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            paddingBottom: 22,
            marginBottom: 22,
            borderBottom: "1px solid var(--hair)",
          }}
        >
          {user?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.avatarUrl}
              alt="Tu foto de perfil"
              width={72}
              height={72}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--hair-strong)",
              }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--primary-dim)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {initials}
            </span>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              style={{ padding: "11px 18px", fontSize: 13.5 }}
            >
              {avatarBusy ? "Subiendo…" : user?.avatarUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            {user?.avatarUrl && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void removeAvatar()}
                disabled={avatarBusy}
                style={{ padding: "11px 18px", fontSize: 13.5 }}
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <label style={{ display: "block" }}>
            <span
              className="mono"
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              NOMBRE
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre y apellidos"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "block" }}>
            <span
              className="mono"
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              NOMBRE DE USUARIO
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="sin espacios, único"
              style={inputStyle}
            />
          </label>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => void saveProfile()}
            disabled={!profileDirty || savingProfile}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            {savingProfile ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </Card>

      <Card>
        <Eyebrow>MIS DATOS</Eyebrow>
        <h2 style={{ margin: "14px 0 20px", fontSize: 24 }}>
          Resumen de tus datos
        </h2>

        <div
          style={{
            borderRadius: 12,
            background: "var(--bg-card-2)",
            overflow: "hidden",
          }}
        >
          {rows.map((d, i) => (
            <div
              key={d.label}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr",
                gap: 20,
                padding: "12px 18px",
                borderBottom:
                  i === rows.length - 1
                    ? "none"
                    : "1px solid var(--hair)",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                }}
              >
                {d.label}
              </span>
              <span
                className={d.mono ? "mono" : undefined}
                style={
                  d.mono
                    ? { fontSize: 13, letterSpacing: "0.08em" }
                    : { fontSize: 13.5 }
                }
              >
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <Card
          style={{
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Eyebrow>EXPORTAR</Eyebrow>
            <div
              style={{
                marginTop: 12,
                fontSize: 13.5,
                color: "var(--text-muted)",
                maxWidth: "36ch",
                textWrap: "pretty",
              }}
            >
              Un archivo con todo lo que guardamos de ti.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-accent"
            onClick={exportJson}
            disabled={downloading}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            <IconDownload size={15} />
            Descargar mis datos como JSON
          </button>
        </Card>

        <Card style={{ padding: 24 }}>
          <Eyebrow>POLÍTICAS</Eyebrow>
          <div style={{ marginTop: 16 }}>
            <Link
              href="/legal/terminos"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid var(--hair)",
                color: "var(--text)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5 }}>
                Términos del servicio
              </span>
              <span style={{ color: "var(--text-faint)", display: "flex" }}>
                <IconChevronRight size={15} />
              </span>
            </Link>
            <Link
              href="/legal/privacidad"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                color: "var(--text)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13.5 }}>
                Política de privacidad
              </span>
              <span style={{ color: "var(--text-faint)", display: "flex" }}>
                <IconChevronRight size={15} />
              </span>
            </Link>
          </div>
        </Card>
      </div>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
