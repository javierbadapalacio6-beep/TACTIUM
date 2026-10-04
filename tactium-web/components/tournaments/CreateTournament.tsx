"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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
import {
  fetchTournamentStats,
  tournamentPhase,
  PHASE_ACTION,
  PHASE_LABEL,
  type TournamentStats,
} from "@/lib/club-ops";
import { TOURNAMENT_FREE_PAIRS } from "@/lib/tournament-billing";
import { PhaseBar, LiveDot } from "@/components/club/PhaseBar";
import { CobrosCard } from "@/components/club/ClubCobros";
import { CountUp } from "@/components/entry/motion-bits";
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
  IconPlus,
  IconShare,
  IconTrophy,
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
  { n: 5, label: "Revisar", note: "Repásalo antes de publicar" },
];
const LAST = STEPS.length;

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
  // Antes «Lugar», los límites por categoría y las horas que se pueden quitar
  // eran campos de adorno: se escribían y no se guardaban.
  const [location, setLocation] = useState("");
  const [limits, setLimits] = useState<Record<string, { puntos: string; nivel: string }>>({});
  const [removable, setRemovable] = useState("");
  const [creating, setCreating] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const reduce = useReducedMotion();
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

  // Torneos reales del club con su recuento (parejas, sin pagar, partidos).
  const { data: clubData, loading: loadingTournaments } = useAsync(
    async () => {
      const list = clubId ? await fetchClubTournaments(clubId) : [];
      return { list, stats: await fetchTournamentStats(list) };
    },
    [clubId, created],
  );
  const tournaments = clubData?.list ?? [];
  const stats: Record<string, TournamentStats> = clubData?.stats ?? {};
  const active = tournaments
    .filter((t) => tournamentPhase(t) < 4)
    .sort((a, b) => tournamentPhase(b) - tournamentPhase(a));
  const finished = tournaments.filter((t) => tournamentPhase(t) === 4);
  const totals = active.reduce(
    (acc, t) => {
      const st = stats[t.id];
      if (st) {
        acc.pairs += st.pairs;
        acc.pending += st.pendingClub;
        acc.online += st.paidOnline;
      }
      return acc;
    },
    { pairs: 0, pending: 0, online: 0 },
  );

  async function share(id: string, code: string | null | undefined) {
    const url = `${window.location.origin}/torneos/${id}/inscripcion`;
    try {
      await navigator.clipboard.writeText(code ? `${url}\nCódigo: ${code}` : url);
      setShared(id);
      setTimeout(() => setShared(null), 1800);
    } catch {
      window.open(url, "_blank");
    }
  }

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
        location: location.trim() || null,
        maxRemovableHours: removable ? parseInt(removable, 10) : null,
        categoryRules: (() => {
          const byCategory: Record<string, { puntos: number | null; nivel: number | null } | null> = {};
          let any = false;
          for (const c of cats) {
            const l = limits[c];
            const puntos = l?.puntos ? parseInt(l.puntos.replace(/\D/g, ""), 10) || null : null;
            const nivel = l?.nivel ? parseInt(l.nivel, 10) || null : null;
            byCategory[c] = puntos || nivel ? { puntos, nivel } : null;
            if (puntos || nivel) any = true;
          }
          return any ? { mode: "both" as const, byCategory } : null;
        })(),
      }),
    );
    setBusy(false);
    if (res.ok) {
      setCreatedCode(res.data.code);
      setCreated(true);
      setCreating(false);
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
          <h2 style={{ fontSize: 20 }}>Torneo publicado</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            La inscripción ya está abierta. Compártelo para que se apunten desde la app o la web.
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
              Volver a mis torneos
            </Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Torneos del club"
        lede="Cada torneo dice en qué fase está y qué toca hacer ahora."
        actions={
          !creating && (
            <Btn variant="accent" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
              Crear torneo
            </Btn>
          )
        }
      />

      {!creating && (
        <>
          {loadingTournaments ? (
            <Card>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Skeleton h={14} w="45%" />
                <Skeleton h={14} w="30%" />
                <Skeleton h={14} w="38%" />
              </div>
            </Card>
          ) : tournaments.length === 0 ? (
            <>
              {/* Estado vacío: el camino en 3 pasos y cómo cobrar. */}
              <Card>
                <h2 style={{ fontSize: 18, margin: 0 }}>Tu primer torneo, en 3 pasos</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                  Gratis hasta {TOURNAMENT_FREE_PAIRS} parejas, sin tarjeta.
                </p>
                <div className="divider" />
                {[
                  ["Crea el torneo", "Formato, categorías, fechas y cuota · 5 pasos cortos"],
                  ["Comparte el enlace", "Se apuntan en 3 pasos, desde la app o la web"],
                  ["Genera los cuadros", "Con cabezas de serie por puntos de la federación"],
                ].map(([t, sub], i) => (
                  <div key={t} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0" }}>
                    <IconTile small>
                      <span className="mono">{i + 1}</span>
                    </IconTile>
                    <span>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{t}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>{sub}</span>
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <Btn variant="accent" icon={<IconPlus size={15} />} onClick={() => setCreating(true)}>
                    Crear mi primer torneo
                  </Btn>
                  <Link href="/torneos" className="link-action">
                    Explorar torneos de otros clubes
                  </Link>
                </div>
              </Card>
              <div style={{ marginTop: 16 }}>
                <CobrosCard />
              </div>
            </>
          ) : (
            <>
              <StatRow style={{ marginBottom: 16 }}>
                <Stat label="Parejas en tus torneos" value={<CountUp to={totals.pairs} duration={0.6} />} />
                <Stat
                  label="Pagan en el club"
                  value={<CountUp to={totals.pending} duration={0.6} />}
                  tone={totals.pending > 0 ? "warning" : undefined}
                />
                <Stat label="Pagadas online" value={<CountUp to={totals.online} duration={0.6} />} />
              </StatRow>

              <Card flush>
                <CardHead title="En marcha" count={active.length} />
                {active.length === 0 ? (
                  <EmptyState compact icon={<IconTrophy size={22} />} title="Ningún torneo en marcha" />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th>Torneo</th>
                        <th className="num">Parejas</th>
                        <th className="num">Sin pagar</th>
                        <th>Fase</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {active.map((t) => {
                        const ph = tournamentPhase(t);
                        const st = stats[t.id];
                        return (
                          <tr key={t.id}>
                            <td>
                              <Link
                                href={`/torneos/${t.id}`}
                                className="cell-main"
                                style={{ color: "inherit", display: "flex", alignItems: "center", gap: 10 }}
                              >
                                <IconTile small>
                                  <IconTrophy size={14} />
                                </IconTile>
                                <span style={{ minWidth: 0 }}>
                                  <span className="truncate" style={{ display: "block" }}>
                                    {t.name}
                                  </span>
                                  <span className="cell-sub">{shortDate(t.starts_on)}</span>
                                </span>
                              </Link>
                            </td>
                            <td className="num mono">
                              {st?.pairs ?? 0}
                              {t.max_pairs ? ` / ${t.max_pairs}` : ""}
                            </td>
                            <td className="num mono" style={{ color: st?.pendingClub ? "var(--warning)" : undefined }}>
                              {st?.pendingClub ?? 0}
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12.5, fontWeight: 600 }}>
                                  {ph === 3 && <LiveDot />}
                                  {PHASE_LABEL[ph]}
                                  {ph === 3 && st ? (
                                    <span className="mono" style={{ marginLeft: 6, color: "var(--text-muted)", fontWeight: 500 }}>
                                      {st.played}/{st.matches}
                                    </span>
                                  ) : null}
                                </span>
                                <PhaseBar phase={ph} compact />
                              </div>
                            </td>
                            <td>
                              <div className="tw-table-actions">
                                {ph === 0 ? (
                                  <Btn
                                    size="sm"
                                    variant="tint"
                                    icon={shared === t.id ? <IconCheck size={14} /> : <IconShare size={14} />}
                                    onClick={() => void share(t.id, t.signup_code)}
                                  >
                                    {shared === t.id ? "Enlace copiado" : PHASE_ACTION[ph]}
                                  </Btn>
                                ) : (
                                  <BtnLink href={`/torneos/${t.id}`} size="sm" variant={ph === 1 ? "accent" : "tint"}>
                                    {PHASE_ACTION[ph]}
                                  </BtnLink>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </Card>

              {finished.length > 0 && (
                <Card flush style={{ marginTop: 16 }}>
                  <CardHead title="Finalizados" count={finished.length} />
                  {finished.map((t) => (
                    <div key={t.id} className="list-row" style={{ minHeight: 0 }}>
                      <Link href={`/torneos/${t.id}`} className="list-row-main" style={{ color: "inherit" }}>
                        <span className="list-row-title truncate">{t.name}</span>
                        <span className="list-row-sub">
                          {shortDate(t.starts_on)} · {stats[t.id]?.pairs ?? 0} parejas
                        </span>
                      </Link>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <ActivateTeamsCard />
          </div>
        </>
      )}

      {creating && (
        <>
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

            <Field label="Lugar" hint="Opcional" htmlFor="ct-place">
              <Input
                id="ct-place"
                type="text"
                placeholder="Club Smash · Santander"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
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
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="5000"
                        className="mono"
                        value={limits[c]?.puntos ?? ""}
                        onChange={(e) =>
                          setLimits((l) => ({ ...l, [c]: { nivel: l[c]?.nivel ?? "", puntos: e.target.value } }))
                        }
                      />
                    </Field>
                    <Field label="Nivel ≥">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="2"
                        value={limits[c]?.nivel ?? ""}
                        onChange={(e) =>
                          setLimits((l) => ({ ...l, [c]: { puntos: l[c]?.puntos ?? "", nivel: e.target.value } }))
                        }
                      />
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
              <Input
                id="ct-removable"
                type="text"
                inputMode="numeric"
                placeholder="8"
                className="mono"
                value={removable}
                onChange={(e) => setRemovable(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </Field>
          </div>
        )}

        {step === LAST && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column" }}
          >
            {[
              { n: 1, title: name.trim() || "Sin nombre", sub: [type, location.trim() || null].filter(Boolean).join(" · ") },
              {
                n: 2,
                title: `${genders.join(" y ") || "Sin género"} · ${cats.join(", ") || "categoría única"}`,
                sub: `${Math.max(1, genders.length) * Math.max(1, cats.length)} cuadros${Object.entries(limits)
                  .filter(([c, l]) => cats.includes(c) && (l.puntos || l.nivel))
                  .map(([c, l]) => ` · ${c}: ${l.puntos ? `puntos ≤ ${l.puntos}` : `nivel ≥ ${l.nivel}`}`)
                  .join("")}`,
              },
              {
                n: 3,
                title: [startsOn ? shortDate(startsOn) : null, endsOn && endsOn !== startsOn ? shortDate(endsOn) : null]
                  .filter(Boolean)
                  .join(" – ") || "Sin fechas",
                sub: `De ${startTime} a ${endTime}`,
              },
              {
                n: 4,
                title: parseFloat(fee || "0") > 0 ? `${fee.replace(".", ",")} € de cuota` : "Gratis",
                sub: [format, seeded ? "con cabezas de serie" : "sin siembra"].join(" · "),
              },
            ].map((r) => (
              <div key={r.n} className="list-row" style={{ minHeight: 0 }}>
                <span className="list-row-main">
                  <span className="list-row-title">{r.title}</span>
                  <span className="list-row-sub">{r.sub}</span>
                </span>
                <Btn size="sm" variant="quiet" onClick={() => setStep(r.n)}>
                  Editar
                </Btn>
              </div>
            ))}
            <Note icon={<IconInfo size={15} />} style={{ marginTop: 16 }}>
              Coste del torneo para el club: gratis hasta {TOURNAMENT_FREE_PAIRS} parejas sin plan, o
              incluido hasta el tope de tu plan de club. Se paga al cerrar la inscripción, por las
              parejas que hayan entrado; sin pagar no se generan los cuadros.
            </Note>
          </motion.div>
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
          <Btn onClick={() => (step === 1 ? setCreating(false) : setStep((s) => s - 1))}>
            {step === 1 ? "Cancelar" : "Atrás"}
          </Btn>
          {step < LAST ? (
            <Btn variant="accent" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Siguiente
            </Btn>
          ) : (
            <Btn
              variant="accent"
              disabled={busy || name.trim().length < 3}
              onClick={submit}
            >
              {busy ? "Publicando…" : "Publicar y abrir inscripción"}
            </Btn>
          )}
        </div>
        {err && (
          <Note tone="error" icon={<IconAlert size={15} />} style={{ marginTop: 14 }}>
            {err}
          </Note>
        )}
      </Card>
        </>
      )}
    </div>
  );
}
