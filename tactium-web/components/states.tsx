"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { IconAlert, IconCheck, IconInfo } from "./Icon";

/* ── Estado vacío ──────────────────────────────────────────────────
   Icono en tesela, titular en frase, una línea muted, un CTA. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: compact ? "28px 20px" : "48px 24px",
      }}
    >
      {icon && (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "var(--bg-card-2)",
            border: "1px solid var(--line)",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: 16 }}>{title}</h3>
      {body && (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
            maxWidth: "44ch",
          }}
        >
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────*/
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
    <div className="card" style={{ padding: 18 }}>
      <Skeleton h={11} w={120} />
      <div style={{ height: 14 }} />
      <Skeleton h={24} w="55%" />
      <div style={{ height: 18 }} />
      <Skeleton h={12} w="85%" />
      <div style={{ height: 8 }} />
      <Skeleton h={12} w="70%" />
    </div>
  );
}

/** Esqueleto de una pantalla de panel: cabecera + cifras + tabla. */
export function SkeletonPage() {
  return (
    <div className="tw-page">
      <div style={{ marginBottom: 24 }}>
        <Skeleton h={24} w={260} />
        <div style={{ height: 10 }} />
        <Skeleton h={12} w={360} />
      </div>
      <div className="card" style={{ padding: 18, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton h={11} w={90} />
            <div style={{ height: 12 }} />
            <Skeleton h={26} w={64} />
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", gap: 16, padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            <Skeleton h={14} w="34%" />
            <Skeleton h={14} w="20%" />
            <Skeleton h={14} w="16%" />
          </div>
        ))}
      </div>
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
  const bg =
    tone === "success"
      ? "var(--accent-10)"
      : tone === "warning"
        ? "var(--warning-soft)"
        : "var(--error-soft)";
  const Icon = tone === "success" ? IconCheck : IconAlert;

  return (
    <div role="status" aria-live="polite" className="tw-toast">
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: bg,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon size={15} />
      </span>
      <span style={{ flex: 1, minWidth: 0, paddingTop: 5 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>
          {title}
        </span>
        {body && (
          <span
            style={{
              display: "block",
              marginTop: 3,
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
          className="btn-icon btn"
          style={{ width: 28, minHeight: 28, fontSize: 16, lineHeight: 1 }}
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
  return (
    <div
      className={
        "note" +
        (tone === "warning" ? " note-warning" : tone === "error" ? " note-error" : " note-accent")
      }
      style={{ alignItems: "center", flexWrap: "wrap" }}
    >
      <IconInfo size={16} />
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
