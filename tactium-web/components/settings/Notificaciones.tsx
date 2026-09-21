"use client";

import { useState } from "react";

import { NOTIF_PREFS } from "@/lib/account-data";
import { Btn, Card, CardHead, IconTile, Toggle } from "@/components/ui";
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
    <Card flush>
      <CardHead title="Notificaciones del equipo" sub="Activar o desactivar los avisos del equipo">
        <Toggle
          on={master}
          onChange={() => setMaster((v) => !v)}
          label="Notificaciones del equipo"
        />
      </CardHead>

      {NOTIF_PREFS.map((n) => {
        const on = master && prefs[n.key];
        return (
          <div
            key={n.key}
            className="list-row"
            style={{
              opacity: master ? 1 : 0.4,
              transition: "opacity var(--dur-base) var(--ease)",
            }}
          >
            <span className="list-row-main" style={{ fontSize: 14, fontWeight: 500 }}>
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

      {/* Propio de la web: los avisos del navegador necesitan permiso. */}
      <div className="card-foot" style={{ flexWrap: "wrap" }}>
        <IconTile mute={!permIsCta}>
          <IconBrowser size={16} />
        </IconTile>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Avisos del navegador
          </div>
          <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
            {perm === "denied"
              ? "Los has bloqueado. Cámbialo en los ajustes del navegador."
              : perm === "unsupported"
                ? "Este navegador no los admite."
                : "Solo en este navegador. Hay que dar permiso."}
          </div>
        </div>
        <Btn
          size="sm"
          variant={permIsCta ? "accent" : "ghost"}
          disabled={!permIsCta}
          onClick={askPermission}
        >
          {permLabel}
        </Btn>
      </div>
    </Card>
  );
}
