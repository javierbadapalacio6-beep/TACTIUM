"use client";

import { Fragment } from "react";

import { Card, CardHead, Chip, Note } from "@/components/ui";
import { IconAlert } from "@/components/Icon";
import type { Franja } from "./helpers";

/** Barra de progreso de 3 segmentos del asistente. */
export function StepBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-label={`Paso ${step} de ${total}`}
      style={{ display: "flex", gap: 6, marginBottom: 16 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            background: i < step ? "var(--accent)" : "var(--hair-strong)",
            transition: "background var(--dur-fast) var(--ease)",
          }}
        />
      ))}
    </div>
  );
}

/** Tarjeta-radio del panel: fondo `--bg-card-2`, y al activarse `--accent-10`
 *  con borde `--accent-40`. Radio 10. `disabled` = no elegible (atenuada). */
export function RadioCard({
  on,
  onClick,
  children,
  title,
  right,
  disabled,
}: {
  on: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: children ? "12px 14px" : "10px 14px",
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        background: on ? "var(--accent-10)" : "var(--bg-card-2)",
        border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition:
          "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "none",
          width: 16,
          height: 16,
          borderRadius: 999,
          border: `1.5px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {on && (
          <span
            style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }}
          />
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: on ? 700 : 600 }}>
          {title}
        </span>
        {children && (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            {children}
          </span>
        )}
      </span>
      {right}
    </button>
  );
}

/** Rejilla de disponibilidad: el jugador marca las horas que NO puede, en
 *  franjas de 1 h, hasta el tope del torneo. Al llegar al tope se avisa. */
export function AvailabilityGrid({
  days,
  slots,
  blocked,
  cap,
  onToggle,
}: {
  days: string[];
  slots: Franja[];
  blocked: Set<string>;
  cap: number | null;
  onToggle: (key: string) => void;
}) {
  const atCap = cap != null && blocked.size >= cap;
  return (
    <Card flush style={{ marginBottom: 16 }}>
      <CardHead
        title="¿Cuándo no podéis jugar?"
        sub="Marca las horas en las que no podéis. El club lo tendrá en cuenta al montar el horario."
      >
        <Chip tone={atCap ? "warning" : "mute"} plain>
          <span className="mono">
            {cap != null ? `${blocked.size}/${cap}` : blocked.size}
          </span>{" "}
          h
        </Chip>
      </CardHead>

      <div className="card-body">
        {atCap && (
          <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
            {cap === 0
              ? "Este torneo no permite quitar horas: tenéis que poder jugar en cualquier franja."
              : `Has llegado al máximo de ${cap} ${cap === 1 ? "hora" : "horas"} que permite el torneo. Desmarca una para elegir otra.`}
          </Note>
        )}
        <div style={{ overflowX: "auto" }}>
          <div
            className="tw-avail-slots"
            style={{
              gridTemplateColumns: `58px repeat(${slots.length}, minmax(38px, 1fr))`,
              minWidth: slots.length > 6 ? "max-content" : undefined,
            }}
          >
            <span />
            {slots.map((s) => (
              <span
                key={s.label}
                className="mono"
                style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}
              >
                {s.label.slice(0, 5)}
              </span>
            ))}

            {days.map((d) => (
              <Fragment key={d}>
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--text-faint)", alignSelf: "center" }}
                >
                  {d}
                </span>
                {slots.map((s) => {
                  const key = `${d} ${s.label}`;
                  const on = blocked.has(key);
                  const locked = !on && atCap;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${d} de ${s.label}${on ? " · no podemos" : ""}`}
                      onClick={() => onToggle(key)}
                      style={{
                        padding: "11px 4px",
                        borderRadius: 10,
                        fontSize: 12,
                        cursor: locked ? "not-allowed" : "pointer",
                        opacity: locked ? 0.5 : 1,
                        background: on ? "var(--error-soft)" : "var(--bg-card-2)",
                        color: on ? "var(--error)" : "var(--text-faint)",
                        border: `1px solid ${
                          on
                            ? "color-mix(in srgb, var(--error) 40%, transparent)"
                            : "var(--line)"
                        }`,
                        transition:
                          "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
                      }}
                    >
                      {on ? "✕" : "·"}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
