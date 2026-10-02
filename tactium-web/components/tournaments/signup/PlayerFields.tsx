"use client";

import { useEffect, useRef, useState } from "react";

import { resolveFcpPlayer } from "@/lib/queries";
import { Field, Input } from "@/components/ui";
import { IconCheck } from "@/components/Icon";
import { isFullName, looksLikeEmail, phoneDigits } from "./helpers";

/** Datos de un jugador en la ficha. Los guarda el formulario padre. */
export interface PlayerDraft {
  name: string;
  /** Nombre COMPLETO tal cual figura en la Federación. Solo cuando se confirma
   *  la coincidencia (a mano o sola, si hay una única). Es el que se guarda. */
  fedName: string | null;
  /** Género REAL (FCP), para validar la división del torneo. */
  fedGender: "M" | "F" | null;
  /** Sin ficha FCP: puntos y nivel cuentan como 0 y no se piden. */
  noFed: boolean;
  pts: string;
  level: string;
  email: string;
  phone: string;
}

export type PlayerErrors = Partial<
  Record<"name" | "pts" | "level" | "email" | "phone", string>
>;

// Sugerencia de la Federación (dato REAL de fcp_jugadores). Igual que el chip
// FcpSuggest de la app: al escribir el nombre buscamos en la FCP y proponemos
// puntos + categoría de la mejor coincidencia.
export type FcpHint = {
  pts: number;
  level: string;
  // De dónde sale la categoría: liga, circuito o ambas (cuenta la mejor).
  origen: "liga" | "circuito" | "ambos" | null;
  // Solo juega circuito: no tiene puntos de liga (los que cuentan) → 0.
  soloCircuito: boolean;
  matched: string;
  genero: "M" | "F" | null;
  equipo: string | null;
};

/** Busca en la FCP el nombre escrito (debounced) y devuelve HASTA 4 candidatos
 *  (para distinguir homónimos por club/puntos), junto con la búsqueda a la que
 *  corresponden: así no se aplica una coincidencia de un nombre ya editado. */
function useFcpHints(query: string): { hints: FcpHint[]; forQuery: string } {
  const [state, setState] = useState<{ hints: FcpHint[]; forQuery: string }>({
    hints: [],
    forQuery: "",
  });
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setState({ hints: [], forQuery: q });
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const rows = await resolveFcpPlayer(q);
        if (!alive) return;
        setState({
          forQuery: q,
          hints: rows.slice(0, 4).map((r) => ({
            pts: r.puntos ?? 0,
            soloCircuito: r.nivelLiga == null,
            // La MEJOR categoría del jugador: liga o circuito (no "ABS").
            level: r.categoriaDiv ?? "",
            origen: r.origenNivel,
            matched: r.name,
            genero: r.genero ?? null,
            equipo: r.equipo ?? null,
          })),
        });
      } catch {
        if (alive) setState({ hints: [], forQuery: q });
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);
  return state;
}

const hintPatch = (h: FcpHint): Partial<PlayerDraft> => ({
  fedName: h.matched,
  fedGender: h.genero,
  pts: String(h.pts),
  level: h.level,
});

/** Botón con aspecto de enlace (acciones secundarias dentro de un campo). */
export function LinkBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="link-action"
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

/**
 * Campos de un jugador: nombre con buscador de la Federación, «no juego
 * federado», puntos, nivel (si las reglas lo usan), email y teléfono.
 *
 * Si la Federación devuelve UNA sola coincidencia se aplica sola (nombre
 * oficial, puntos y nivel) y se muestra confirmada con «No soy yo». Con
 * varias, el jugador elige la suya por club y puntos.
 */
export function PlayerFields({
  idPrefix,
  self,
  value,
  onChange,
  showLevel,
  requireEmail,
  showPhone,
  errors,
}: {
  idPrefix: string;
  /** true = la ficha de quien se inscribe (textos en 2ª persona). */
  self: boolean;
  value: PlayerDraft;
  onChange: (patch: Partial<PlayerDraft>) => void;
  showLevel: boolean;
  requireEmail: boolean;
  showPhone: boolean;
  errors?: PlayerErrors;
}) {
  const { hints, forQuery } = useFcpHints(value.noFed ? "" : value.name);
  // Coincidencias descartadas con «No soy yo»: no se vuelven a aplicar solas.
  const [rejected, setRejected] = useState<Set<string>>(() => new Set());
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Una sola coincidencia para el nombre escrito → se aplica sola.
  useEffect(() => {
    if (value.noFed || value.fedName) return;
    if (hints.length !== 1 || forQuery !== value.name.trim()) return;
    const h = hints[0];
    if (rejected.has(h.matched)) return;
    onChangeRef.current(hintPatch(h));
  }, [hints, forQuery, value.name, value.noFed, value.fedName, rejected]);

  const visible = hints.filter((h) => !rejected.has(h.matched));
  const e = errors ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field
        label={self ? "Tu nombre y apellidos" : "Nombre y apellidos"}
        htmlFor={`${idPrefix}-name`}
        error={e.name}
      >
        <Input
          id={`${idPrefix}-name`}
          type="text"
          autoComplete={self ? "name" : "off"}
          value={value.name}
          aria-invalid={!!e.name}
          onChange={(ev) =>
            // Editar a mano descarta la confirmación de la Federación (y sus
            // puntos/nivel: eran de esa persona).
            onChange(
              value.fedName
                ? {
                    name: ev.target.value,
                    fedName: null,
                    fedGender: null,
                    pts: "",
                    level: "",
                  }
                : { name: ev.target.value },
            )
          }
          placeholder="Nombre y apellidos"
        />

        {!value.noFed && value.fedName && (
          <div
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--bg-card-2)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ color: "var(--accent)", display: "inline-flex" }}>
              <IconCheck size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                {value.fedName}
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>
                Encontrado en la Federación
                {value.pts !== "" ? (
                  <>
                    {" · "}
                    <span className="mono">{value.pts}</span> pts
                  </>
                ) : null}
                {value.level ? ` · nivel ${value.level}` : ""}
              </span>
            </span>
            <LinkBtn
              onClick={() => {
                const was = value.fedName;
                if (was) setRejected((s) => new Set(s).add(was));
                onChange({ fedName: null, fedGender: null, pts: "", level: "" });
              }}
            >
              {self ? "No soy yo" : "No es"}
            </LinkBtn>
          </div>
        )}

        {!value.noFed && !value.fedName && visible.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 8 }}>
              {visible.length > 1
                ? self
                  ? "Hay varios con ese nombre en la Federación. ¿Cuál eres?"
                  : "Hay varios con ese nombre en la Federación. ¿Cuál es?"
                : "¿Es esta persona de la Federación?"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {visible.map((h, i) => (
                <button
                  key={`${h.matched}-${i}`}
                  type="button"
                  onClick={() => onChange({ name: h.matched, ...hintPatch(h) })}
                  className="tw-fcp-chip"
                  style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
                >
                  <span style={{ fontWeight: 600 }}>{h.matched}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                    {h.soloCircuito ? "sin puntos de liga" : `${h.pts} pts`}
                    {h.level ? ` · ${h.level}` : ""}
                    {h.level && h.origen && h.origen !== "ambos" ? ` (${h.origen})` : ""}
                    {h.equipo ? ` · ${h.equipo}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>

      {/* No federado: enlace en vez de casilla; deshacerlo es otro enlace. */}
      {value.noFed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          <span>
            {self ? "No juegas federado" : "No juega federado"}: cuenta{" "}
            <span className="mono">0</span> puntos.
          </span>
          <LinkBtn onClick={() => onChange({ noFed: false })}>
            {self ? "Sí juego federado" : "Sí juega federado"}
          </LinkBtn>
        </div>
      ) : (
        <div>
          <LinkBtn
            onClick={() =>
              onChange({
                noFed: true,
                pts: "",
                level: "",
                fedName: null,
                fedGender: null,
              })
            }
          >
            {self
              ? "No juego federado (cuenta 0 puntos)"
              : "No juega federado (cuenta 0 puntos)"}
          </LinkBtn>
        </div>
      )}

      {!value.noFed && (
        <div className="tw-form-grid">
          <Field
            label={self ? "Tus puntos" : "Sus puntos"}
            htmlFor={`${idPrefix}-pts`}
            error={e.pts}
          >
            <Input
              id={`${idPrefix}-pts`}
              type="text"
              inputMode="numeric"
              value={value.pts}
              aria-invalid={!!e.pts}
              onChange={(ev) => onChange({ pts: ev.target.value.replace(/\D/g, "") })}
              className="mono"
            />
          </Field>
          {showLevel && (
            <Field
              label={self ? "Tu nivel (liga o circuito)" : "Su nivel (liga o circuito)"}
              htmlFor={`${idPrefix}-level`}
              error={e.level}
            >
              <Input
                id={`${idPrefix}-level`}
                type="text"
                value={value.level}
                aria-invalid={!!e.level}
                onChange={(ev) => onChange({ level: ev.target.value })}
              />
            </Field>
          )}
        </div>
      )}

      <div className="tw-form-grid">
        <Field
          label={self ? "Tu email" : "Su email"}
          hint={
            requireEmail
              ? "Te enviaremos aquí la confirmación."
              : "Opcional. Si lo pones, le llega también la confirmación."
          }
          htmlFor={`${idPrefix}-email`}
          error={e.email}
        >
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete={self ? "email" : "off"}
            value={value.email}
            aria-invalid={!!e.email}
            onChange={(ev) => onChange({ email: ev.target.value })}
            placeholder={self ? "tu@email.com" : "pareja@email.com"}
          />
        </Field>
        {showPhone && (
          <Field
            label="Tu teléfono"
            hint="Para que el club pueda avisarte."
            htmlFor={`${idPrefix}-phone`}
            error={e.phone}
          >
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              autoComplete="tel"
              value={value.phone}
              aria-invalid={!!e.phone}
              onChange={(ev) => onChange({ phone: ev.target.value })}
              placeholder="600 000 000"
              className="mono"
            />
          </Field>
        )}
      </div>
    </div>
  );
}

/** Errores de la ficha de un jugador (paso 1 / compañero de la 2ª categoría). */
export function validatePlayer(
  p: PlayerDraft,
  opts: {
    self: boolean;
    showLevel: boolean;
    requireEmail: boolean;
    requirePhone: boolean;
  },
): PlayerErrors {
  const e: PlayerErrors = {};
  if (!p.fedName && !isFullName(p.name))
    e.name = opts.self
      ? "Escribe tu nombre y al menos un apellido."
      : "Escribe su nombre y al menos un apellido.";
  if (!p.noFed && p.pts.trim() === "")
    e.pts = opts.self
      ? "Indica tus puntos o marca que no juegas federado."
      : "Indica sus puntos o marca que no juega federado.";
  if (opts.showLevel && !p.noFed && p.level.trim() === "")
    e.level = "Indica el nivel (liga o circuito).";
  if (opts.requireEmail || p.email.trim() !== "") {
    if (!looksLikeEmail(p.email)) e.email = "Escribe un email válido.";
  }
  if (opts.requirePhone && phoneDigits(p.phone) < 9)
    e.phone = "Escribe un teléfono de al menos 9 cifras.";
  return e;
}
