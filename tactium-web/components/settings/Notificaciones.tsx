"use client";

import { useEffect, useState } from "react";

import { fetchNotificationsEnabled, setNotificationsEnabled } from "@/lib/account-queries";
import { guardedWrite } from "@/lib/writes";
import { Btn, Card, CardHead, IconTile, Toggle } from "@/components/ui";
import { Toast } from "@/components/states";
import { IconBrowser } from "@/components/Icon";

type PermState = "default" | "granted" | "denied" | "unsupported";

function readPermission(): PermState {
  if (typeof window === "undefined" || !("Notification" in window))
    return "unsupported";
  return Notification.permission as PermState;
}

/**
 * Avisos: UN interruptor real, el mismo que la app
 * (`profiles.notifications_enabled`). Antes había 4 interruptores por tipo
 * que no guardaban nada; se quitan hasta que existan en la base.
 */
export function Notificaciones() {
  const [master, setMaster] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNotificationsEnabled()
      .then((v) => !cancelled && setMaster(v))
      .catch(() => !cancelled && setMaster(true));
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleMaster() {
    if (master === null || saving) return;
    const next = !master;
    setMaster(next); // optimista
    setSaving(true);
    const res = await guardedWrite("guardar los avisos", () => setNotificationsEnabled(next));
    setSaving(false);
    if (!res.ok) {
      setMaster(!next);
      setToast(res.blocked ? res.reason : "No se ha podido guardar. Inténtalo de nuevo.");
    }
  }

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
      <CardHead
        title="Avisos del equipo"
        sub="Convocatoria, alineación publicada y recordatorios para confirmar tu disponibilidad. Llegan al móvil."
      >
        <Toggle
          on={!!master}
          disabled={master === null || saving}
          onChange={() => void toggleMaster()}
          label="Avisos del equipo"
        />
      </CardHead>

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
      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </Card>
  );
}
