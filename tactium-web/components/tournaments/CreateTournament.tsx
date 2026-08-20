"use client";

import { useState } from "react";
import Link from "next/link";

import {
  CATEGORIES,
  GENDERS,
  MATCH_FORMATS,
  TYPE_NOTE,
  type TournamentType,
} from "@/lib/tournament-data";
import { createTournament, fetchClubTournaments } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow, Toggle } from "@/components/ui";
import { IconCheck, IconCopy, IconUpload } from "@/components/Icon";

/** Estado del torneo → etiqueta (torneos reales, no la maqueta). */
const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Inscripción abierta",
  in_progress: "En juego",
  finished: "Finalizado",
  canceled: "Cancelado",
};

/** Fecha corta es-ES para la lista. */
function shortDate(iso: string | null): string {
  if (!iso) return "Sin fechas";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? "Sin fechas"
    : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Mapeo del asistente (labels legibles) al modelo de la BD.
const TYPE_TO_FORMAT: Record<TournamentType, string> = {
  Americano: "americano",
  Cuadro: "ko",
  "Grupos + Cuadro": "groups_ko",
  "Cuadro con consolación": "ko_consolation",
};
const MATCH_TO_DB: Record<string, string> = {
  "3 sets": "bo3_full",
  "2 sets + súper tie-break": "bo3_stb",
  "Set único a 9": "bo1",
};
const GENDER_TO_DB: Record<string, string> = {
  Masculino: "masculino",
  Femenino: "femenino",
  Mixto: "mixto",
};

const STEPS = [
  { n: 1, label: "PASO 1 · BÁSICOS", note: "Lo esencial del torneo" },
  { n: 2, label: "PASO 2 · CATEGORÍAS Y GÉNEROS", note: "Quién puede jugar" },
  { n: 3, label: "PASO 3 · FECHAS", note: "Cuándo se juega" },
  { n: 4, label: "PASO 4 · CUOTA Y REGLAS", note: "Dinero y formato" },
];

const TYPES = Object.keys(TYPE_NOTE) as TournamentType[];

function Label({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </span>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid var(--hair-strong)",
        background: "var(--bg-card-2)",
        color: "var(--text)",
        fontSize: 14,
        outline: "none",
        fontFamily: "'Satoshi', sans-serif",
        ...style,
      }}
    />
  );
}

/** Chips de selección múltiple. */
function ChipPicker({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((v) => v !== o) : [...value, o])
            }
            className="btn"
            style={{
              padding: "9px 16px",
              fontSize: 13,
              fontWeight: on ? 700 : 500,
              background: on ? "var(--accent-10)" : "transparent",
              color: on ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
            }}
          >
            {on && <IconCheck size={13} />}
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function CreateTournament() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<TournamentType>("Grupos + Cuadro");
  const [cats, setCats] = useState<string[]>(["1ª", "2ª"]);
  const [genders, setGenders] = useState<string[]>(["Masculino"]);
  const [seeded, setSeeded] = useState(true);
  const [format, setFormat] = useState<string>(MATCH_FORMATS[1]);
  const [fee, setFee] = useState("");
  const [fee2, setFee2] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("3");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [created, setCreated] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { clubId } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Torneos reales del club (incluye borradores; se recarga al crear uno).
  const { data: clubTournaments } = useAsync(
    () => (clubId ? fetchClubTournaments(clubId) : Promise.resolve([])),
    [clubId, created],
  );
  const tournaments = clubTournaments ?? [];
  const drafts = tournaments.filter((t) => t.status === "draft");

  async function submit() {
    if (busy) return;
    if (!clubId) {
      setErr("Necesitas un club para crear torneos.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear el torneo", () =>
      createTournament({
        clubId,
        name: name.trim(),
        format: TYPE_TO_FORMAT[type],
        matchFormat: MATCH_TO_DB[format] ?? "bo3_stb",
        genders: genders
          .map((g) => GENDER_TO_DB[g])
          .filter((g): g is string => !!g),
        categories: cats,
        seedingMode: seeded ? "points" : "federative",
        entryFee: fee ? parseFloat(fee) : null,
        entryFee2: fee2 ? parseFloat(fee2) : null,
        paymentDeadlineDays:
          fee && parseFloat(fee) > 0 && deadlineDays
            ? parseInt(deadlineDays, 10)
            : null,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      }),
    );
    setBusy(false);
    if (res.ok) {
      setCreatedCode(res.data.code);
      setCreated(true);
    } else setErr(res.reason);
  }

  const canNext = step !== 1 || name.trim().length > 2;

  if (created) {
    const code = createdCode;
    return (
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <Card style={{ textAlign: "center", padding: 40 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "var(--accent-10)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <IconCheck size={22} />
          </span>
          <h1 style={{ fontSize: 26 }}>Torneo creado</h1>
          <p
            style={{
              margin: "12px 0 24px",
              fontSize: 13.5,
              color: "var(--text-muted)",
            }}
          >
            Compártelo para que se apunten desde la app.
          </p>

          <Eyebrow>CÓDIGO DE INSCRIPCIÓN</Eyebrow>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              padding: "20px 24px",
              borderRadius: 14,
              background: "var(--bg-card-2)",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "var(--accent)",
              }}
            >
              {code}
            </span>
            <button
              type="button"
              aria-label="Copiar código"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  /* se puede copiar a mano */
                }
              }}
              style={{
                border: "none",
                background: "transparent",
                color: copied ? "var(--accent)" : "var(--text-faint)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <IconCopy size={18} />
            </button>
          </div>

          <button
            className="btn btn-ghost"
            onClick={() => {
              setCreated(false);
              setStep(1);
            }}
            style={{ marginTop: 26, padding: "12px 22px", fontSize: 13.5 }}
          >
            Volver al asistente
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>CLUB · TORNEOS</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Mis torneos</h1>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
          Gestiona los torneos de tu club o crea uno nuevo.
        </p>
      </div>

      {/* Torneos del club — arriba del todo: es lo primero que necesita el club
          (encontrar, pagar y gestionar los suyos), antes del asistente. */}
      <section style={{ marginBottom: 32 }}>
        <Eyebrow style={{ marginBottom: 12 }}>TORNEOS DEL CLUB</Eyebrow>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {tournaments.length === 0 ? (
            <div
              style={{
                padding: "22px 20px",
                fontSize: 13,
                color: "var(--text-faint)",
                textAlign: "center",
              }}
            >
              Aún no has creado ningún torneo. Crea el primero abajo.
            </div>
          ) : (
            tournaments.map((t, i) => (
              <Link
                key={t.id}
                href={`/torneos/${t.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom:
                    i === tournaments.length - 1 ? "none" : "1px solid var(--hair)",
                  flexWrap: "wrap",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <span style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 700 }}>
                  {t.name}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-faint)" }}
                >
                  {shortDate(t.starts_on)}
                </span>
                <span className="chip chip-mute">
                  {TOURNAMENT_STATUS_LABEL[t.status] ?? t.status}
                </span>
              </Link>
            ))
          )}
        </Card>
        {drafts.length > 0 && (
          <p
            className="mono"
            style={{
              marginTop: 12,
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "var(--text-faint)",
            }}
          >
            {drafts.length} BORRADOR{drafts.length > 1 ? "ES" : ""} SIN PUBLICAR ·
            ÁBRELO PARA PAGAR Y PUBLICAR
          </p>
        )}
      </section>

      <Eyebrow style={{ display: "block", marginBottom: 14 }}>
        CREAR NUEVO TORNEO
      </Eyebrow>

      {/* Indicador de progreso */}
      <div className="tw-steps" style={{ marginBottom: 22 }}>
        {STEPS.map((s) => {
          const on = s.n === step;
          const done = s.n < step;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => setStep(s.n)}
              style={{
                flex: 1,
                minWidth: 160,
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 12,
                cursor: "pointer",
                background: on ? "var(--accent-10)" : "var(--bg-card)",
                border: `1px solid ${on ? "var(--accent)" : "var(--hair)"}`,
                color: "var(--text)",
              }}
            >
              <span
                className="mono"
                style={{
                  display: "block",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  color: on || done ? "var(--accent)" : "var(--text-faint)",
                }}
              >
                {done ? "✓ " : ""}
                {s.label}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 6,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {s.note}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <Label>NOMBRE</Label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Torneo de primavera"
              />
            </div>

            <div>
              <Label>TIPO DE TORNEO</Label>
              <div className="tw-type-grid">
                {TYPES.map((t) => {
                  const on = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      style={{
                        textAlign: "left",
                        padding: 16,
                        borderRadius: 12,
                        cursor: "pointer",
                        background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                        border: `1.5px solid ${on ? "var(--accent)" : "transparent"}`,
                        color: "var(--text)",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: on ? "var(--accent)" : "var(--text)",
                        }}
                      >
                        {t}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 6,
                          fontSize: 12.5,
                          color: "var(--text-muted)",
                          textWrap: "pretty",
                        }}
                      >
                        {TYPE_NOTE[t]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tw-form-grid">
              <div>
                <Label>LUGAR · OPCIONAL</Label>
                <Input type="text" placeholder="Club Smash · Santander" />
              </div>
              <div>
                <Label>FOTO DE PORTADA · OPCIONAL</Label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px dashed var(--hair-strong)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: "var(--accent)", display: "flex" }}>
                    <IconUpload size={17} />
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-muted)" }}>
                    Añadir foto del torneo
                  </span>
                  <input type="file" accept="image/*" hidden />
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
              <Label>CATEGORÍAS · ELIGE UNA O VARIAS</Label>
              <ChipPicker
                options={CATEGORIES}
                value={cats}
                onChange={setCats}
                label="Categorías"
              />
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: 12.5,
                  color: "var(--text-faint)",
                }}
              >
                Cada categoría tendrá su propio cuadro.
              </p>
            </div>

            <div>
              <Label>GÉNERO · ELIGE UNO O VARIOS</Label>
              <ChipPicker
                options={GENDERS}
                value={genders}
                onChange={setGenders}
                label="Géneros"
              />
            </div>

            <div>
              <Label>LÍMITES POR CATEGORÍA · OPCIONAL</Label>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  textWrap: "pretty",
                }}
              >
                Restringe quién puede inscribirse en cada categoría.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cats.map((c) => (
                  <div key={c} className="tw-limit-row">
                    <span
                      className="mono"
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}
                    >
                      {c}
                    </span>
                    <div>
                      <Label>PUNTOS ≤</Label>
                      <Input type="text" inputMode="numeric" placeholder="5000" className="mono" />
                    </div>
                    <div>
                      <Label>NIVEL ≥</Label>
                      <Input type="text" placeholder="2ª" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="tw-form-grid">
              <div>
                <Label>FECHA INICIO · OPCIONAL</Label>
                <Input
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </div>
              <div>
                <Label>FECHA FIN · OPCIONAL</Label>
                <Input
                  type="date"
                  value={endsOn}
                  min={startsOn || undefined}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 12,
                    color: "var(--text-faint)",
                  }}
                >
                  Fin (si dura varios días)
                </p>
              </div>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              Los días de cada fase (octavos, cuartos, semis, final…) se asignan
              desde la app una vez determinadas las parejas y generado el cuadro.
            </p>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <Label>CUOTA DE INSCRIPCIÓN (€) · OPCIONAL</Label>
              <div className="tw-form-grid">
                <div>
                  <Label>CUOTA · 1 CATEGORÍA (€)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0 = gratis"
                    className="mono"
                    value={fee}
                    onChange={(e) =>
                      setFee(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
                    }
                  />
                </div>
                <div>
                  <Label>CUOTA · 2 CATEGORÍAS (€)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="25"
                    className="mono"
                    value={fee2}
                    onChange={(e) =>
                      setFee2(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
                    }
                  />
                </div>
              </div>
              {parseFloat(fee || "0") > 0 && (
                <div style={{ marginTop: 14 }}>
                  <Label>DÍAS LÍMITE PARA PAGAR EN EL CLUB</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="3"
                    className="mono"
                    value={deadlineDays}
                    onChange={(e) =>
                      setDeadlineDays(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textWrap: "pretty",
                    }}
                  >
                    La pareja paga online o en el club. Si elige pagar en el club y
                    no paga hasta {deadlineDays || "3"} día(s) antes, su inscripción
                    se elimina para liberar la plaza.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>FORMATO DE PARTIDO</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {MATCH_FORMATS.map((f) => {
                  const on = format === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className="btn"
                      style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: on ? 700 : 500,
                        background: on ? "var(--accent-10)" : "transparent",
                        color: on ? "var(--accent)" : "var(--text-muted)",
                        border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                      }}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 16,
                borderRadius: 12,
                background: "var(--bg-card-2)",
              }}
            >
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                  Siembra
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 5,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  Coloca cabezas de serie por puntos al generar el cuadro
                </span>
              </span>
              <Toggle on={seeded} onChange={() => setSeeded((v) => !v)} label="Siembra" />
            </div>

            <div>
              <Label>HORAS QUE UN JUGADOR PUEDE QUITAR · OPCIONAL</Label>
              <Input type="text" inputMode="numeric" placeholder="8" className="mono" />
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn btn-ghost"
            disabled={step === 1}
            onClick={() => setStep((s) => s - 1)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Atrás
          </button>
          {step < 4 ? (
            <button
              className="btn btn-accent"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              style={{ padding: "12px 24px", fontSize: 13.5 }}
            >
              Siguiente
            </button>
          ) : (
            <button
              className="btn btn-accent"
              disabled={busy || name.trim().length < 3}
              onClick={submit}
              style={{ padding: "12px 24px", fontSize: 13.5 }}
            >
              {busy ? "Creando…" : "Crear torneo"}
            </button>
          )}
        </div>
        {err && (
          <p style={{ marginTop: 14, color: "var(--error)", fontSize: 13 }}>
            {err}
          </p>
        )}
      </Card>

    </div>
  );
}
