"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { IconAlert, IconCheck, IconInfo } from "./Icon";

/* ── Estado vacío ──────────────────────────────────────────────────
   Icono grande en faint, titular en frase, una línea muted, un CTA. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "56px 24px",
      }}
    >
      {icon && (
        <div style={{ color: "var(--text-faint)", marginBottom: 18 }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: 20 }}>{title}</h3>
      {body && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
            maxWidth: "44ch",
            textWrap: "pretty",
          }}
        >
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 22 }}>{action}</div>}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────
   Barras con barrido. Nada de spinners salvo dentro de botones. */
export function Skeleton({
  h = 14,
  w = "100%",
  r = 6,
  style,
}: {
  h?: number;
  w?: number | string;
  r?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      className="skel"
      aria-hidden="true"
      style={{ height: h, width: w, borderRadius: r, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 24 }}>
      <Skeleton h={11} w={120} />
      <div style={{ height: 16 }} />
      <Skeleton h={28} w="60%" />
      <div style={{ height: 20 }} />
      <Skeleton h={12} w="85%" />
      <div style={{ height: 8 }} />
      <Skeleton h={12} w="70%" />
    </div>
  );
}

/* ── Toast ─────────────────────────────────────────────────────────
   Abajo a la derecha en escritorio, arriba en móvil. */
export type ToastTone = "success" | "warning" | "error";

export function Toast({
  tone = "success",
  title,
  body,
  onClose,
}: {
  tone?: ToastTone;
  title: string;
  body?: string;
  onClose?: () => void;
}) {
  const color =
    tone === "success"
      ? "var(--accent)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--error)";
  const Icon = tone === "success" ? IconCheck : IconAlert;

  return (
    <div
      role="status"
      aria-live="polite"
      className="tw-toast card"
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <span style={{ color, display: "flex", flex: "none", marginTop: 1 }}>
        <Icon size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
          {title}
        </span>
        {body && (
          <span
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            {body}
          </span>
        )}
      </span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text-faint)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
            flex: "none",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ── Banner fijo ───────────────────────────────────────────────────*/
export function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "warning" | "error";
  children: ReactNode;
  action?: ReactNode;
}) {
  const color =
    tone === "warning"
      ? "var(--warning)"
      : tone === "error"
        ? "var(--error)"
        : "var(--accent)";
  const bg =
    tone === "warning"
      ? "var(--warning-soft)"
      : tone === "error"
        ? "var(--error-soft)"
        : "var(--accent-10)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 18px",
        borderRadius: 12,
        background: bg,
        border: `1px solid ${color}`,
        color,
        fontSize: 13.5,
        flexWrap: "wrap",
      }}
    >
      <span style={{ display: "flex", flex: "none" }}>
        <IconInfo size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 140 }}>{children}</span>
      {action}
    </div>
  );
}

/** Barra fina fija arriba cuando se pierde la conexión. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="tw-offline" role="status">
      Sin conexión · algunos datos pueden estar desactualizados
    </div>
  );
}
