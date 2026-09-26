"use client";

import Link from "next/link";
import { useState } from "react";

import {
  CATEGORIES,
  GENDERS,
  MATCH_FORMATS,
  TYPE_NOTE,
  type TournamentType,
} from "@/lib/tournament-data";
import {
  createTournament,
  defaultTournamentTerms,
  fetchClubTournaments,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  Input,
  Note,
  PageHeader,
  SectionHead,
  Segmented,
  Stat,
  StatRow,
  Table,
  Textarea,
  Toggle,
} from "@/components/ui";
import { EmptyState, Skeleton } from "@/components/states";
import { ActivateTeamsCard } from "@/components/club/ActivateTeamsCard";
import {
  IconAlert,
  IconCheck,
  IconCopy,
  IconInfo,
  IconTrophy,
  IconUpload,
} from "@/components/Icon";

/** Estado del torneo → etiqueta (torneos reales, no la maqueta). */
const TOURNAMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Inscripción abierta",
  in_progress: "En juego",
  finished: "Finalizado",
  canceled: "Cancelado",
};

/** Estado del torneo → tono del chip. */
const TOURNAMENT_STATUS_TONE: Record<
  string,
  "accent" | "mute" | "warning" | "error"
> = {
  draft: "mute",
  open: "accent",
  in_progress: "warning",
  finished: "mute",
  canceled: "error",
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
  { n: 1, label: "Básicos", note: "Lo esencial del torneo" },
  { n: 2, label: "Categorías y géneros", note: "Quién puede jugar" },
  { n: 3, label: "Fechas", note: "Cuándo se juega" },
  { n: 4, label: "Cuota y reglas", note: "Dinero y formato" },
];

const TYPES = Object.keys(TYPE_NOTE) as TournamentType[];

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
            className={"tw-fcp-chip" + (on ? " is-on" : "")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
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
  // Ventana horaria de juego: fija desde qué hora empieza y hasta cuándo se
  // juega. Alimenta el horario y la rejilla de disponibilidad de la inscripción.
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("22:00");
  const [created, setCreated] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const { clubId } = useSession();
  const [terms, setTerms] = useState("");
  const [termsBusy, setTermsBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Trae el texto estándar del servidor, para no partir de una hoja en blanco. */
  async function loadDefaultTerms() {
    if (termsBusy) return;
    setTermsBusy(true);
    try {
      setTerms(await defaultTournamentTerms());
    } catch {
      /* si falla, el club escribe las suyas y ya */
    } finally {
      setTermsBusy(false);
    }
  }
  const [err, setErr] = useState<string | null>(null);

  // Torneos reales del club (incluye borradores; se recarga al crear uno).
  const { data: clubTournaments, loading: loadingTournaments } = useAsync(
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
        terms: terms.trim() || null,
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
        startTime: startTime || null,
        endTime: endTime || null,
      }),
    );
    setBusy(false);
    if (res.ok) {
      setCreatedCode(res.data.code);
      setCreated(true);
    } else setErr(res.reason);
  }

  const canNext = step !== 1 || name.trim().length > 2;
  const current = STEPS.find((s) => s.n === step) ?? STEPS[0];

  if (created) {
    const code = createdCode;
    return (
      <div className="tw-page-narrow">
        <Card style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "40px 24px" }}>
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "var(--accent-10)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <IconCheck size={24} />
          </span>
          <h2 style={{ fontSize: 20 }}>Torneo creado</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            Compártelo para que se apunten desde la app.
          </p>

          <div style={{ marginTop: 24, fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
            Código de inscripción
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: "18px 24px",
              borderRadius: "var(--r-md)",
              background: "var(--bg-card-2)",
              border: "1px solid var(--line)",
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.18em" }}
            >
              {code}
            </span>
            <button
              type="button"
              aria-label="Copiar código"
              className="btn btn-icon"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  /* se puede copiar a mano */
                }
              }}
              style={{ color: copied ? "var(--accent)" : undefined }}
            >
              {copied ? <IconCheck size={17} /> : <IconCopy size={17} />}
            </button>
          </div>

          <div style={{ marginTop: 24 }}>
            <Btn
              onClick={() => {
                setCreated(false);
                setStep(1);
              }}
            >
              Volver al asistente
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Mis torneos"
        lede="Gestiona los torneos de tu club o crea uno nuevo."
      />

      <ActivateTeamsCard />

      {/* Torneos del club — arriba del todo: es lo primero que necesita el club
          (encontrar, pagar y gestionar los suyos), antes del asistente. */}
      <Card flush>
        <CardHead title="Torneos del club" count={tournaments.length} />
        {loadingTournaments ? (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton h={14} w="45%" />
            <Skeleton h={14} w="30%" />
            <Skeleton h={14} w="38%" />
          </div>
        ) : tournaments.length === 0 ? (
          <EmptyState
            compact
            icon={<IconTrophy size={22} />}
            title="Aún no hay torneos"
            body="Crea el primero con el asistente de abajo."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Torneo</th>
                <th>Empieza</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link
                      href={`/torneos/${t.id}`}
                      className="cell-main"
                      style={{
                        color: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <IconTile small>
                        <IconTrophy size={14} />
                      </IconTile>
                      <span className="truncate">{t.name}</span>
                    </Link>
                  </td>
                  <td className="cell-muted mono">{shortDate(t.starts_on)}</td>
                  <td>
                    <Chip tone={TOURNAMENT_STATUS_TONE[t.status] ?? "mute"}>
                      {TOURNAMENT_STATUS_LABEL[t.status] ?? t.status}
                    </Chip>
                  </td>
                  <td>
                    <div className="tw-table-actions">
                      <BtnLink href={`/torneos/${t.id}`} size="sm" variant="quiet">
                        Gestionar
                      </BtnLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {drafts.length > 0 && (
        <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginTop: 12 }}>
          {drafts.length === 1
            ? "Tienes 1 borrador sin publicar. Ábrelo para pagar y publicar."
            : `Tienes ${drafts.length} borradores sin publicar. Ábrelos para pagar y publicar.`}
        </Note>
      )}

      <SectionHead
        title="Crear nuevo torneo"
        sub={`Paso ${step} de ${STEPS.length} · ${current.note}`}
      />

      {/* Indicador de progreso */}
      <div className="tw-steps" style={{ marginBottom: 16 }}>
        {STEPS.map((s) => {
          const on = s.n === step;
          const done = s.n < step;
          return (
            <button
              key={s.n}
              type="button"
              aria-current={on ? "step" : undefined}
              onClick={() => setStep(s.n)}
              className={"tw-fcp-chip" + (on ? " is-on" : "")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {done ? (
                <IconCheck size={13} />
              ) : (
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {s.n}
                </span>
              )}
              {s.label}
            </button>
          );
        })}
      </div>

      <Card>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field label="Nombre" htmlFor="ct-name">
              <Input
                id="ct-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Torneo de primavera"
              />
            </Field>

            <Field label="Tipo de torneo">
              <div className="tw-type-grid" role="radiogroup" aria-label="Tipo de torneo">
                {TYPES.map((t) => {
                  const on = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(t)}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        borderRadius: 10,
                        cursor: "pointer",
                        background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                        border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
                        color: "var(--text)",
                        transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
                      }}
                    >
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                        {t}
                      </span>
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
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
            </Field>

            <div className="tw-form-grid">
              <Field label="Lugar" hint="Opcional" htmlFor="ct-place">
                <Input id="ct-place" type="text" placeholder="Club Smash · Santander" />
              </Field>
              <Field label="Foto de portada" hint="Opcional">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 38,
                    padding: "0 12px",
                    borderRadius: "var(--r-sm)",
                    border: "1px dashed var(--line-strong)",
                    background: "var(--bg-card-2)",
                    color: "var(--text-muted)",
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  <IconUpload size={15} />
                  <span style={{ flex: 1 }}>Añadir foto del torneo</span>
                  <input type="file" accept="image/*" hidden />
                </label>
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field
              label="Categorías"
              hint="Elige una o varias. Cada categoría tendrá su propio cuadro."
            >
              <ChipPicker
                options={CATEGORIES}
                value={cats}
                onChange={setCats}
                label="Categorías"
              />
            </Field>

            <Field label="Género" hint="Elige uno o varios.">
              <ChipPicker
                options={GENDERS}
                value={genders}
                onChange={setGenders}
                label="Géneros"
              />
            </Field>

            <Field
              label="Límites por categoría"
              hint="Opcional. Restringe quién puede inscribirse en cada categoría."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cats.map((c) => (
                  <div key={c} className="tw-limit-row">
                    <span className="mono" style={{ fontSize: 13.5, fontWeight: 700, paddingBottom: 10 }}>
                      {c}
                    </span>
                    <Field label="Puntos ≤">
                      <Input type="text" inputMode="numeric" placeholder="5000" className="mono" />
                    </Field>
                    <Field label="Nivel ≥">
                      <Input type="text" placeholder="2ª" />
                    </Field>
                  </div>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="tw-form-grid">
              <Field label="Fecha de inicio" hint="Opcional" htmlFor="ct-starts">
                <Input
                  id="ct-starts"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </Field>
              <Field label="Fecha de fin" hint="Opcional, si dura varios días" htmlFor="ct-ends">
                <Input
                  id="ct-ends"
                  type="date"
                  value={endsOn}
                  min={startsOn || undefined}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </Field>
            </div>

            <div className="tw-form-grid">
              <Field label="Hora de inicio de juego" htmlFor="ct-start-time">
                <Input
                  id="ct-start-time"
                  type="time"
                  value={startTime}
                  step={3600}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </Field>
              <Field
                label="Hora de fin de juego"
                hint="Desde y hasta qué hora se juega. Define las franjas de la inscripción y del horario."
                htmlFor="ct-end-time"
              >
                <Input
                  id="ct-end-time"
                  type="time"
                  value={endTime}
                  step={3600}
                  min={startTime || undefined}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </Field>
            </div>

            <Note icon={<IconInfo size={15} />}>
              Los días de cada fase (octavos, cuartos, semis, final…) se asignan
              desde la app una vez determinadas las parejas y generado el cuadro.
            </Note>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="tw-form-grid">
                <Field label="Cuota por 1 categoría (€)" hint="Opcional. 0 = gratis" htmlFor="ct-fee">
                  <Input
                    id="ct-fee"
                    type="text"
                    inputMode="decimal"
                    placeholder="0 = gratis"
                    className="mono"
                    value={fee}
                    onChange={(e) =>
                      setFee(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
                    }
                  />
                </Field>
                <Field label="Cuota por 2 categorías (€)" hint="Opcional" htmlFor="ct-fee2">
                  <Input
                    id="ct-fee2"
                    type="text"
                    inputMode="decimal"
                    placeholder="25"
                    className="mono"
                    value={fee2}
                    onChange={(e) =>
                      setFee2(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
                    }
                  />
                </Field>
              </div>
              {parseFloat(fee || "0") > 0 && (
                <Field
                  label="Días límite para pagar en el club"
                  hint={`La pareja paga online o en el club. Si elige pagar en el club y no paga hasta ${deadlineDays || "3"} día(s) antes, su inscripción se elimina para liberar la plaza.`}
                  htmlFor="ct-deadline"
                  style={{ marginTop: 16 }}
                >
                  <Input
                    id="ct-deadline"
                    type="text"
                    inputMode="numeric"
                    placeholder="3"
                    className="mono"
                    value={deadlineDays}
                    onChange={(e) =>
                      setDeadlineDays(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </Field>
              )}
            </div>

            {/* Resumen de coste: lo que verá la pareja al inscribirse. */}
            <StatRow>
              <Stat
                label="Cuota por 1 categoría"
                value={parseFloat(fee || "0") > 0 ? `${fee} €` : "Gratis"}
                tone={parseFloat(fee || "0") > 0 ? "accent" : undefined}
              />
              <Stat
                label="Cuota por 2 categorías"
                value={parseFloat(fee2 || "0") > 0 ? `${fee2} €` : "—"}
                sub={
                  parseFloat(fee2 || "0") > 0
                    ? "Para quien juega dos categorías"
                    : "Sin cuota propia para dos categorías"
                }
              />
              <Stat
                label="Días límite para pagar"
                value={parseFloat(fee || "0") > 0 ? deadlineDays || "3" : "—"}
                unit={parseFloat(fee || "0") > 0 ? "días" : undefined}
                sub={
                  parseFloat(fee || "0") > 0
                    ? "Antes del torneo, si paga en el club"
                    : "Solo aplica con cuota"
                }
              />
            </StatRow>

            <Field
              label="Condiciones de participación"
              hint="Opcional. Quien se inscriba tendrá que marcarlas para poder pagar, y queda constancia de lo que aceptó."
              htmlFor="ct-terms"
            >
              <Textarea
                id="ct-terms"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={6}
                placeholder="Lo que la pareja acepta al inscribirse (reordenar parejas, política de bajas…)."
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                <Btn
                  size="sm"
                  variant="quiet"
                  onClick={() => void loadDefaultTerms()}
                  disabled={termsBusy}
                >
                  {termsBusy ? "Cargando…" : "Partir de las estándar"}
                </Btn>
              </div>
            </Field>

            <Field label="Formato de partido">
              <Segmented
                label="Formato de partido"
                value={format}
                onChange={setFormat}
                options={MATCH_FORMATS.map((f) => ({ value: f, label: f }))}
              />
            </Field>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 16px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                  Siembra
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  Coloca cabezas de serie por puntos al generar el cuadro
                </span>
              </span>
              <Toggle on={seeded} onChange={() => setSeeded((v) => !v)} label="Siembra" />
            </div>

            <Field label="Horas que un jugador puede quitar" hint="Opcional" htmlFor="ct-removable">
              <Input id="ct-removable" type="text" inputMode="numeric" placeholder="8" className="mono" />
            </Field>
          </div>
        )}

        <div className="divider" style={{ margin: "24px 0 16px" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Btn disabled={step === 1} onClick={() => setStep((s) => s - 1)}>
            Atrás
          </Btn>
          {step < 4 ? (
            <Btn variant="accent" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Siguiente
            </Btn>
          ) : (
            <Btn
              variant="accent"
              disabled={busy || name.trim().length < 3}
              onClick={submit}
            >
              {busy ? "Creando…" : "Crear torneo"}
            </Btn>
          )}
        </div>
        {err && (
          <Note tone="error" icon={<IconAlert size={15} />} style={{ marginTop: 14 }}>
            {err}
          </Note>
        )}
      </Card>
    </div>
  );
}
