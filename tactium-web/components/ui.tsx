"use client";

import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useRef } from "react";

import { IconChevronRight } from "./Icon";

/* ============================================================================
 * Primitivas del panel.
 *
 * Todo lo que aquí hay lee sus valores de `globals.css` (tokens y recetas):
 * un componente no inventa un tamaño ni un color. Si necesita uno que no
 * existe, falta un token, no un `style={{}}`.
 * ==========================================================================*/

/* ── Eyebrow ───────────────────────────────────────────────────────
   Etiqueta de sección en mayúsculas. Discreta por defecto; el acento sólo
   con `tone="accent"`. */
export function Eyebrow({
  children,
  tone = "faint",
  style,
  className,
}: {
  children: ReactNode;
  tone?: "accent" | "faint" | "error";
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={
        "eyebrow" +
        (tone === "accent"
          ? " eyebrow-accent"
          : tone === "error"
            ? " eyebrow-error"
            : "") +
        (className ? " " + className : "")
      }
      style={style}
    >
      {children}
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────*/
export function Card({
  children,
  style,
  danger,
  flush,
  quiet,
  hover,
  className,
  ...rest
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** Hairline en color error — zona de peligro. */
  danger?: boolean;
  /** Sin padding: para tablas y listas que llegan al borde. */
  flush?: boolean;
  /** Borde discontinuo, sin relleno: contenedor de "aún no hay". */
  quiet?: boolean;
  /** Resalta al pasar el ratón (tarjeta-enlace). */
  hover?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className">) {
  return (
    <div
      className={
        "card" +
        (flush ? " card-flush" : "") +
        (quiet ? " card-quiet" : "") +
        (hover ? " card-hover" : "") +
        (className ? " " + className : "")
      }
      style={{
        padding: flush ? 0 : 18,
        ...(danger
          ? { borderColor: "color-mix(in srgb, var(--error) 45%, transparent)" }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Cabecera de tarjeta: título + contador opcional + acciones a la derecha. */
export function CardHead({
  title,
  count,
  children,
  sub,
}: {
  title: ReactNode;
  count?: number | string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="card-head-title">
          {title}
          {count !== undefined && (
            <span className="card-head-count" style={{ marginLeft: 8 }}>
              {count}
            </span>
          )}
        </div>
        {sub && (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Cabecera de pantalla ──────────────────────────────────────────
   Título a 24, subtítulo a 13.5, acciones a la derecha. El antetítulo es
   opcional: la barra superior ya dice dónde estás. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  meta,
  back,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  /** Botones a la derecha (uno principal, resto secundarios). */
  actions?: ReactNode;
  /** Fila de datos cortos bajo el título (categoría · temporada…). */
  meta?: ReactNode[];
  /** Enlace "volver" encima del título. */
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="tw-page-head">
      <div className="tw-page-head-main">
        {back && (
          <Link href={back.href} className="tw-back">
            <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            {back.label}
          </Link>
        )}
        {eyebrow && <Eyebrow style={{ marginBottom: 6 }}>{eyebrow}</Eyebrow>}
        <h1 className="tw-page-title">{title}</h1>
        {lede && <p className="tw-page-sub">{lede}</p>}
        {meta && meta.filter(Boolean).length > 0 && (
          <div className="tw-page-meta">
            {meta.filter(Boolean).map((m, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="dot" aria-hidden="true" />}
                <span>{m}</span>
              </span>
            ))}
          </div>
        )}
        {children}
      </div>
      {actions && <div className="tw-page-actions">{actions}</div>}
    </header>
  );
}

/** Título de bloque fuera de tarjeta, con contador y acción opcional. */
export function SectionHead({
  title,
  count,
  sub,
  children,
  style,
}: {
  title: ReactNode;
  count?: number | string;
  sub?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="section-head" style={style}>
      <div>
        <div className="section-title">
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </div>
        {sub && <div className="section-sub">{sub}</div>}
      </div>
      {children && <div className="tw-page-actions">{children}</div>}
    </div>
  );
}

/* ── Marcador de cifras ───────────────────────────────────────────── */
export function StatRow({
  children,
  style,
  className,
  compact,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** Mitad de alto: para pantallas donde la cifra acompaña, no protagoniza. */
  compact?: boolean;
}) {
  return (
    <div
      className={
        "stat-row" + (compact ? " stat-row--compact" : "") + (className ? " " + className : "")
      }
      style={style}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Sufijo pequeño tras la cifra (%, pts…). */
  unit?: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "accent" | "warning" | "error";
  /** Contenido extra bajo la cifra (barra de progreso, etc.). */
  children?: ReactNode;
}) {
  return (
    <div className={"stat" + (tone ? " stat-" + tone : "")}>
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Progress({
  value,
  tone,
  style,
}: {
  /** 0–100 */
  value: number;
  tone?: "warning";
  style?: CSSProperties;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={"progress" + (tone === "warning" ? " progress-warning" : "")}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={style}
    >
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/* ── Botones ──────────────────────────────────────────────────────
   Un solo componente para <button> y <a>: `href` decide. */
type BtnVariant = "accent" | "ghost" | "quiet" | "tint" | "danger" | "danger-ghost";
type BtnSize = "sm" | "md" | "lg";

interface BtnBase {
  variant?: BtnVariant;
  size?: BtnSize;
  block?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function btnClass(v: BtnVariant, s: BtnSize, block?: boolean, extra?: string) {
  return (
    "btn btn-" +
    v +
    (s === "sm" ? " btn-sm" : s === "lg" ? " btn-lg" : "") +
    (block ? " btn-block" : "") +
    (extra ? " " + extra : "")
  );
}

export function Btn({
  variant = "ghost",
  size = "md",
  block,
  icon,
  children,
  className,
  ...rest
}: BtnBase & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button type="button" className={btnClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function BtnLink({
  variant = "ghost",
  size = "md",
  block,
  icon,
  children,
  className,
  href,
  ...rest
}: BtnBase & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href">) {
  return (
    <Link href={href} className={btnClass(variant, size, block, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

/* ── Chips / estado ─────────────────────────────────────────────── */
export function Chip({
  children,
  tone = "accent",
  plain,
  style,
  className,
}: {
  children: ReactNode;
  tone?: "accent" | "mute" | "warning" | "error" | "info" | "solid";
  /** Sin el punto de estado. */
  plain?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={
        "chip" +
        (tone !== "accent" ? " chip-" + tone : "") +
        (plain ? " chip-plain" : "") +
        (className ? " " + className : "")
      }
      style={style}
    >
      {children}
    </span>
  );
}

/** Tesela de icono para filas y atajos. */
export function IconTile({
  children,
  mute,
  small,
  style,
}: {
  children: ReactNode;
  mute?: boolean;
  small?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={"tile-icon" + (mute ? " tile-icon-mute" : "") + (small ? " tile-icon-sm" : "")}
      style={style}
    >
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  src,
  size = 32,
  style,
}: {
  initials: string;
  src?: string | null;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...style }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        initials
      )}
    </span>
  );
}

/* ── Formularios ───────────────────────────────────────────────── */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  style,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="field" style={style}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  large,
  ...rest
}: { large?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={"input" + (large ? " input-lg" : "") + (className ? " " + className : "")}
      {...rest}
    />
  );
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={"input" + (className ? " " + className : "")} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={"tw-select" + (className ? " " + className : "")} {...rest} />;
}

/** Campo con icono dentro (buscador, etc.). */
export function InputWrap({
  icon,
  children,
  style,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div className={"input-wrap" + (className ? " " + className : "")} style={style}>
      {icon}
      {children}
    </div>
  );
}

/** Control segmentado: una elección entre pocas. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  style,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={style}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={"seg-item" + (on ? " is-on" : "")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Interruptor ───────────────────────────────────────────────────*/
export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={"switch" + (on ? " is-on" : "")}
      style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, flex: "none" }}
    >
      <span />
    </button>
  );
}

/* ── Nota en línea ─────────────────────────────────────────────── */
export function Note({
  tone,
  icon,
  children,
  style,
}: {
  tone?: "accent" | "warning" | "error";
  icon?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={"note" + (tone ? " note-" + tone : "")} style={style}>
      {icon}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

/* ── Tabla ────────────────────────────────────────────────────────
   Tabla real (<table>) con el tono del panel. `dense` para listas largas. */
export function Table({
  children,
  dense,
  style,
  minWidth,
}: {
  children: ReactNode;
  dense?: boolean;
  style?: CSSProperties;
  minWidth?: number;
}) {
  return (
    <div className="tw-table-wrap">
      <table
        className={"tw-table" + (dense ? " tw-table-dense" : "")}
        style={{ minWidth, ...style }}
      >
        {children}
      </table>
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────*/
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  width = 480,
  title,
  lede,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  width?: number;
  /** Con `title` el diálogo pinta su cabecera; sin él, el contenido manda. */
  title?: ReactNode;
  lede?: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);

    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="tw-scrim"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="tw-dialog"
        style={{ maxWidth: width }}
      >
        {title && (
          <div style={{ marginBottom: 18 }}>
            <h2 id={labelledBy} style={{ fontSize: 19 }}>
              {title}
            </h2>
            {lede && (
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                {lede}
              </p>
            )}
          </div>
        )}
        {children}
        {footer && (
          <div
            style={{
              marginTop: 22,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Fila de lista con hairline inferior ───────────────────────────*/
export function Row({
  children,
  last,
  style,
}: {
  children: ReactNode;
  last?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 0",
        borderBottom: last ? "none" : "1px solid var(--line)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Fila de lista con enlace: icono · título/sub · extra · chevron. */
export function ListRow({
  href,
  icon,
  title,
  sub,
  right,
  onClick,
  chevron = true,
  style,
}: {
  href?: string;
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  style?: CSSProperties;
}) {
  const inner = (
    <>
      {icon}
      <span className="list-row-main">
        <span className="list-row-title truncate">{title}</span>
        {sub && <span className="list-row-sub">{sub}</span>}
      </span>
      {right}
      {chevron && (href || onClick) && (
        <span className="list-row-chev">
          <IconChevronRight size={16} />
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="list-row" style={style}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="list-row"
        style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", ...style }}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="list-row" style={style}>
      {inner}
    </div>
  );
}
