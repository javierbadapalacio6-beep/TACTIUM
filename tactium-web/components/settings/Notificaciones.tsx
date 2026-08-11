"use client";

import { useState } from "react";

import { NOTIF_PREFS } from "@/lib/account-data";
import { Card, Eyebrow, Toggle } from "@/components/ui";
import { IconBrowser } from "@/components/Icon";

type PermState = "default" | "granted" | "denied" | "unsupported";

function readPermission(): PermState {
  if (typeof window === "undefined" || !("Notification" in window))
    return "unsupported";
  return Notification.permission as PermState;
}

export function Notificaciones() {
  const [master, setMaster] = useState(true);
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(NOTIF_PREFS.map((n) => [n.key, n.on]))
  );
  // Se lee de forma perezosa en el primer render del cliente: `Notification`
  // no existe en el servidor.
  const [perm, setPerm] = useState<PermState>(readPermission);
  const [asking, setAsking] = useState(false);

  async function askPermission() {
    if (perm !== "default") return;
    setAsking(true);
    try {
      const res = await Notification.requestPermission();
      setPerm(res as PermState);
    } catch {
      /* El navegador puede rechazar la petición fuera de un gesto de usuario. */
    } finally {
      setAsking(false);
    }
  }

  const permLabel =
    perm === "granted"
      ? "Permitidos"
      : perm === "denied"
        ? "Bloqueados"
        : perm === "unsupported"
          ? "No disponible"
          : asking
            ? "Esperando…"
            : "Dar permiso";

  const permIsCta = perm === "default" && !asking;

  return (
    <Card>
      <Eyebrow>NOTIFICACIONES</Eyebrow>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 18,
          borderRadius: 12,
          background: "var(--bg-card-2)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            Notificaciones del equipo
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            Activar o desactivar las notificaciones del equipo
          </div>
        </div>
        <Toggle
          on={master}
          onChange={() => setMaster((v) => !v)}
          label="Notificaciones del equipo"
        />
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {NOTIF_PREFS.map((n, i) => {
          const on = master && prefs[n.key];
          return (
            <div
              key={n.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "15px 0",
                borderBottom:
                  i === NOTIF_PREFS.length - 1
                    ? "none"
                    : "1px solid var(--hair)",
                opacity: master ? 1 : 0.4,
                transition: "opacity var(--dur-base) var(--ease)",
              }}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
                {n.label}
              </span>
              <Toggle
                on={!!on}
                disabled={!master}
                label={n.label}
                onChange={() =>
                  setPrefs((p) => ({ ...p, [n.key]: !p[n.key] }))
                }
              />
            </div>
          );
        })}
      </div>

      {/* Propio de la web: los avisos del navegador necesitan permiso. */}
      <div
        style={{
          marginTop: 22,
          padding: 18,
          borderRadius: 12,
          border: "1px solid var(--hair-strong)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "var(--accent-10)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <IconBrowser size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>
            Avisos del navegador
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            {perm === "denied"
              ? "Los has bloqueado · cámbialo en los ajustes del navegador"
              : perm === "unsupported"
                ? "Este navegador no los admite"
                : "Solo en este navegador · hay que dar permiso"}
          </div>
        </div>
        <button
          type="button"
          className={"btn " + (permIsCta ? "btn-accent" : "btn-ghost")}
          disabled={!permIsCta}
          onClick={askPermission}
          style={{ padding: "10px 18px", fontSize: 13, flex: "none" }}
        >
          {permLabel}
        </button>
      </div>
    </Card>
  );
}
