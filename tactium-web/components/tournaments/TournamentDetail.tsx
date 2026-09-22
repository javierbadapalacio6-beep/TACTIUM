"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import {
  type BracketTie,
} from "@/lib/tournament-data";
import {
  deleteTournament,
  fetchTournament,
  fetchTournamentMatches,
  fetchTournamentRegs,
  fetchRegsPayments,
  fetchPhaseDays,
  mergeDivision,
  moveRegistration,
  setMatchSlot,
  togglePhaseDay,
  setRegistrationPayment,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  generateKoBracket,
  generateGroups,
  generateRoundRobin,
  generateAmericano,
  generateMexicanoRound,
  generateKnockoutFromGroups,
  generatePrincipalConsolationFromGroups,
  setMatchResult,
  setSocialResult,
  type ResultMatch,
} from "@/lib/tournament-engine";
import { formatFee } from "@/lib/tournament-signup-pricing";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  Input,
  Modal,
  Note,
  PageHeader,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconCopy,
  IconInfo,
  IconTicket,
  IconTrophy,
  IconUsers,
} from "@/components/Icon";
import { PayTournamentButton } from "@/components/tournaments/PayTournamentButton";

/* ── Formas de los datos reales (RPC públicas, espejo de la app) ──────
   Ver TACTIUM/src/core/services/tournaments.ts: publicGetTournament /
   publicListMatches / publicListRegistrations. */
interface RealTournament {
  id: string;
  name: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  signup_code: string | null;
  max_pairs: number | null;
  entry_fee: number | null;
  fee_currency: string | null;
  gender: string | null;
  genders: string[] | null;
  category: string | null;
  categories: string[] | null;
  match_format: string | null;
  phase_formats: Record<string, string> | null;
  // Rejilla de horario: pistas y ventana de juego del torneo.
  courts?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  slot_minutes?: number | null;
  rest_minutes?: number | null;
  // No siempre lo devuelve la RPC pública; se usa si viene.
  club_name?: string | null;
  billing_status?: string | null;
  /** Club organizador. Llega solo si la RLS deja leer la fila, o sea a quien
   *  puede ver el torneo como suyo. Sirve para decidir si ESTE usuario lo
   *  organiza, no si organiza torneos en general. */
  club_id?: string | null;
}

/* ── Formato de partido (espejo de formatConfig/resolveMatchFormat de la app) ─ */
function formatConfig(f: string): { maxSets: number; setsToWin: number } {
  switch (f) {
    case "bo3_full":
      return { maxSets: 3, setsToWin: 2 };
    case "bo1":
      return { maxSets: 1, setsToWin: 1 };
    case "bo3_stb":
    default:
      return { maxSets: 3, setsToWin: 2 };
  }
}
// Cuadro → grupo de formato: consol / groups / main (oro/plata/bronce → main).
function phaseFormatGroup(bracket: string): "main" | "consol" | "groups" {
  if (bracket === "consol") return "consol";
  if (bracket === "grp" || bracket === "rr") return "groups";
  return "main";
}
function resolveMatchFormat(t: RealTournament, bracket: string): string {
  const override = t.phase_formats?.[phaseFormatGroup(bracket)];
  return override ?? t.match_format ?? "bo3_stb";
}

interface RealReg {
  id: string;
  gender: string | null;
  category: string | null;
  group_no: number | null;
  pair_label: string | null;
  p1_name: string;
  p2_name: string | null;
  p1_phone: string | null;
  p1_email: string | null;
  seed: number | null;
  seed_points: number | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
}

interface RealMatch {
  id: string;
  gender: string | null;
  category: string | null;
  group_no: number | null;
  bracket: string;
  round: number;
  slot: number;
  home_reg: string | null;
  away_reg: string | null;
  home_reg2: string | null;
  away_reg2: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_reg: string | null;
  status: string;
  sets: number[][] | null;
  /** Hueco en el horario. `court` es texto «Pista N», como en la app. */
  scheduled_at: string | null;
  court: string | null;
}

/* ── Etiquetas ───────────────────────────────────────────────────── */
const FORMAT_LABEL: Record<string, string> = {
  ko: "Cuadro",
  ko_consolation: "Cuadro con consolación",
  groups_ko: "Grupos + Cuadro",
  round_robin: "Liga",
  americano: "Americano",
  mexicano: "Mexicano",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Inscripción abierta",
  in_progress: "En juego",
  finished: "Finalizado",
  canceled: "Cancelado",
};

const isSocialFormat = (f: string) => f === "americano" || f === "mexicano";

/* ── Fechas (locale es-ES) ───────────────────────────────────────── */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function fmtDates(a: string | null, b: string | null): string {
  const da = fmtDate(a);
  const db = fmtDate(b);
  if (da && db && da !== db) return `${da} – ${db}`;
  return da || db;
}

/* ── Nombre de la pareja / jugador ───────────────────────────────── */
function pairName(r: RealReg | undefined): string {
  if (!r) return "—";
  if (r.pair_label) return r.pair_label;
  return [r.p1_name, r.p2_name].filter(Boolean).join(" · ");
}

/* ── Marcador de un partido a partir de sus sets (juegos por set) ─── */
function setsToScore(sets: number[][] | null): string {
  if (!Array.isArray(sets) || sets.length === 0) return "";
  return sets
    .map((s) => `${s?.[0] ?? 0}-${s?.[1] ?? 0}`)
    .join(" ");
}

/* ── Cuadros: orden y etiqueta (espejo de bracketRank/bracketLabel) ─ */
const BRACKET_TITLE: Record<string, string> = {
  main: "Cuadro principal",
  consol: "Cuadro de consolación",
  gold: "Cuadro oro",
  silver: "Cuadro plata",
  bronze: "Cuadro bronce",
};

function bracketRank(b: string): number {
  const fixed: Record<string, number> = {
    main: -1,
    gold: 0,
    silver: 1,
    bronze: 2,
    consol: 5,
  };
  if (fixed[b] !== undefined) return fixed[b];
  if (b.startsWith("pos")) return 10 + (parseInt(b.slice(3), 10) || 0);
  return 99;
}

function bracketTitle(b: string): string {
  if (BRACKET_TITLE[b]) return BRACKET_TITLE[b];
  if (b.startsWith("pos")) {
    const n = parseInt(b.slice(3), 10) || 0;
    return n <= 4 ? "Cuadro de consolación" : `Consolación ${n - 3}`;
  }
  return `Cuadro ${b}`;
}

/* ── Etiqueta de ronda (espejo de roundLabel de la app) ──────────── */
function roundLabel(round: number, total: number): string {
  const fromEnd = total - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinales";
  if (fromEnd === 2) return "Cuartos";
  if (fromEnd === 3) return "Octavos";
  return `Ronda ${round}`;
}

const groupLetter = (n: number): string => String.fromCharCode(65 + n); // A, B, C…

/* ── Clasificación de parejas (espejo de computeStandings) ───────── */
interface StandRow {
  regId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
}

function computeStandings(regs: RealReg[], matches: RealMatch[]): StandRow[] {
  const byId = new Map<string, StandRow>();
  for (const r of regs) {
    byId.set(r.id, {
      regId: r.id,
      name: pairName(r),
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "finished" || !m.home_reg || !m.away_reg) continue;
    const H = byId.get(m.home_reg);
    const A = byId.get(m.away_reg);
    if (!H || !A) continue;
    H.played++;
    A.played++;
    H.setsFor += m.home_score ?? 0;
    H.setsAgainst += m.away_score ?? 0;
    A.setsFor += m.away_score ?? 0;
    A.setsAgainst += m.home_score ?? 0;
    for (const s of m.sets ?? []) {
      H.gamesFor += s?.[0] ?? 0;
      H.gamesAgainst += s?.[1] ?? 0;
      A.gamesFor += s?.[1] ?? 0;
      A.gamesAgainst += s?.[0] ?? 0;
    }
    if (m.winner_reg === m.home_reg) {
      H.won++;
      A.lost++;
      H.points += 2;
      A.points += 1;
    } else if (m.winner_reg === m.away_reg) {
      A.won++;
      H.lost++;
      A.points += 2;
      H.points += 1;
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
      b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst) ||
      b.won - a.won,
  );
}

/* ── Clasificación individual · americano/mexicano (computeIndividual) */
interface PlayerRow {
  regId: string;
  name: string;
  played: number;
  won: number;
  points: number;
}

function computeIndividual(
  regs: RealReg[],
  matches: RealMatch[],
): PlayerRow[] {
  const byId = new Map<string, PlayerRow>();
  for (const r of regs)
    byId.set(r.id, { regId: r.id, name: r.p1_name ?? "—", played: 0, won: 0, points: 0 });
  const add = (id: string | null, pts: number, win: boolean) => {
    if (!id) return;
    const p = byId.get(id);
    if (!p) return;
    p.played++;
    p.points += pts;
    if (win) p.won++;
  };
  for (const m of matches) {
    if (m.status !== "finished") continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const hw = hs > as;
    add(m.home_reg, hs, hw);
    add(m.home_reg2, hs, hw);
    add(m.away_reg, as, !hw);
    add(m.away_reg2, as, !hw);
  }
  return [...byId.values()].sort((a, b) => b.points - a.points || b.won - a.won);
}

type Tab =
  | "inscripciones"
  | "grupos"
  | "clasificacion"
  | "cuadro"
  | "horario"
  | "config";

const TABS: [Tab, string][] = [
  ["inscripciones", "Inscripciones"],
  ["grupos", "Grupos"],
  ["clasificacion", "Clasificación"],
  ["cuadro", "Cuadro"],
  ["horario", "Horario"],
  ["config", "Configuración"],
];

/* ── Cuadro ────────────────────────────────────────────────────── */
type UiTie = BracketTie & { onEnter?: () => void };

function Bracket({
  rounds,
  title,
}: {
  rounds: { round: string; ties: UiTie[] }[];
  title?: string;
}) {
  // Campeón: la última ronda con un solo cruce ya resuelto. Se deduce de lo que
  // ya llega en `rounds`, no se consulta nada nuevo.
  const finalTie = rounds.at(-1)?.ties.length === 1 ? rounds.at(-1)!.ties[0] : null;
  const champion =
    finalTie && finalTie.winner >= 0
      ? finalTie.winner === 0
        ? finalTie.a
        : finalTie.b
      : null;

  return (
    <Card flush>
      {title && <CardHead title={title} />}
      <div className="tw-bracket-scroll">
        <div className="tw-bracket">
          {rounds.map((col) => (
            <div key={col.round} className="tw-bracket-col">
              <div
                className="grid-head"
                style={{ textAlign: "center", marginBottom: 12 }}
              >
                {col.round}
              </div>
              <div className="tw-bracket-ties">
                {col.ties.map((t, i) => (
                  <div
                    key={i}
                    className="tw-tie"
                    onClick={t.onEnter}
                    role={t.onEnter ? "button" : undefined}
                    tabIndex={t.onEnter ? 0 : undefined}
                    onKeyDown={
                      t.onEnter
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              t.onEnter!();
                            }
                          }
                        : undefined
                    }
                    style={t.onEnter ? { cursor: "pointer" } : undefined}
                    title={t.onEnter ? "Meter resultado" : undefined}
                  >
                    {[t.a, t.b].map((name, side) => {
                      const isWinner = t.winner === side;
                      const decided = t.winner >= 0;
                      const tbd = name === "Por determinar";
                      return (
                        <div
                          key={side}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderBottom:
                              side === 0 ? "1px solid var(--line)" : "none",
                            boxShadow: isWinner
                              ? "inset 2px 0 0 var(--accent)"
                              : "none",
                          }}
                        >
                          <span
                            className="truncate"
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: isWinner ? 700 : 500,
                              color: tbd
                                ? "var(--text-faint)"
                                : decided && !isWinner
                                  ? "var(--text-muted)"
                                  : "var(--text)",
                            }}
                          >
                            {name}
                          </span>
                        </div>
                      );
                    })}
                    {t.score && (
                      <div
                        className="mono"
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          color: "var(--text-faint)",
                          borderTop: "1px solid var(--line)",
                        }}
                      >
                        {t.score}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="tw-bracket-col">
            <div
              className="grid-head"
              style={{ textAlign: "center", marginBottom: 12 }}
            >
              Campeones
            </div>
            <div
              style={{
                padding: "16px 14px",
                borderRadius: "var(--r-md)",
                background: champion ? "var(--accent-10)" : "var(--bg-card-2)",
                border: `1px solid ${champion ? "var(--accent-40)" : "var(--line)"}`,
                textAlign: "center",
                color: champion ? "var(--accent)" : "var(--text-faint)",
                fontSize: 13,
                fontWeight: champion ? 700 : 500,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <IconTrophy size={18} />
              {champion ?? "Por determinar"}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Rejilla de horario ────────────────────────────────────────── */
/* ── Horario real ──────────────────────────────────────────────── */

/** Fecha local "YYYY-MM-DD" de un ISO. Local a propósito: el horario se guarda
 *  con la hora del club, no en UTC. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO del hueco (día + minutos desde medianoche), construido en hora LOCAL,
 *  igual que `autoScheduleTournament` en la app. Si aquí se usara UTC, los dos
 *  horarios se desplazarían una o dos horas entre sí. */
function slotIso(day: string, minutes: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return dt.toISOString();
}

function hhmmToMin(v: string | null | undefined, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(v ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

function minToHhmm(min: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(min / 60))}:${p(min % 60)}`;
}

/** Días consecutivos entre dos fechas ISO (tope de 21, por sanidad). */
function daysBetween(from: string, to: string | null): string[] {
  const [y, m, d] = from.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  const end = to ? new Date(...(to.split("-").map(Number) as [number, number, number])) : null;
  const endDate = end ? new Date(end.getFullYear(), end.getMonth() - 1, end.getDate()) : cur;
  const out: string[] = [];
  for (let i = 0; i < 21; i++) {
    const p = (n: number) => String(n).padStart(2, "0");
    out.push(`${cur.getFullYear()}-${p(cur.getMonth() + 1)}-${p(cur.getDate())}`);
    if (cur >= endDate) break;
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

interface GridSlot {
  at: string | null;
  court: string | null;
}

function ScheduleGrid({
  matches,
  nameById,
  courtsCount,
  startTime,
  endTime,
  slotMinutes,
  restMinutes,
  startsOn,
  endsOn,
  readOnly,
  phaseDays,
  onTogglePhaseDay,
  onPersist,
}: {
  matches: RealMatch[];
  nameById: Map<string, string>;
  courtsCount: number;
  startTime: string | null;
  endTime: string | null;
  slotMinutes: number;
  restMinutes: number;
  startsOn: string | null;
  endsOn: string | null;
  readOnly: boolean;
  /** Días asignados a cada fase, por clave «bracket:round». */
  phaseDays: Record<string, string[]>;
  onTogglePhaseDay: (
    bracket: string,
    round: number,
    day: string,
    on: boolean,
  ) => Promise<string | null>;
  /** Persiste el hueco. Devuelve el motivo si falla, para poder revertir. */
  onPersist: (
    matchId: string,
    at: string | null,
    court: string | null,
  ) => Promise<string | null>;
}) {
  // Estado local de huecos: se pinta al instante y se revierte si el guardado
  // falla. Sin esto, cada arrastre parpadearía esperando a la red.
  const [slots, setSlots] = useState<Record<string, GridSlot>>({});
  useEffect(() => {
    const next: Record<string, GridSlot> = {};
    for (const m of matches) {
      next[m.id] = { at: m.scheduled_at ?? null, court: m.court ?? null };
    }
    setSlots(next);
  }, [matches]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const courts = useMemo(
    () => Array.from({ length: Math.max(1, courtsCount) }, (_, i) => `Pista ${i + 1}`),
    [courtsCount],
  );

  // Franjas entre la apertura y el cierre del torneo, del tamaño de un partido.
  //
  // Se añaden además las horas que YA tienen partidos aunque no caigan en la
  // rejilla teórica: con franjas de 90 min desde las 17:00 no existe la fila de
  // las 19:00, y un partido puesto ahí desde la app se vería como «sin hora»
  // teniéndola. Antes esconder, mejor enseñar la fila de más.
  const times = useMemo(() => {
    const step = Math.max(15, slotMinutes || 60);
    const from = hhmmToMin(startTime, 9 * 60);
    const to = hhmmToMin(endTime, 22 * 60);
    const set = new Set<number>();
    for (let t = from; t + step <= to && set.size < 40; t += step) set.add(t);
    for (const sl of Object.values(slots)) {
      if (!sl.at) continue;
      const d = new Date(sl.at);
      set.add(d.getHours() * 60 + d.getMinutes());
    }
    const out = [...set].sort((a, b) => a - b);
    return out.length ? out : [from];
  }, [startTime, endTime, slotMinutes, slots]);

  // Días del torneo MÁS los que ya tengan partidos puestos: si el horario se
  // montó desde la app en otras fechas, esconderlas sería perderlos de vista.
  const days = useMemo(() => {
    const set = new Set<string>(startsOn ? daysBetween(startsOn, endsOn) : []);
    for (const sl of Object.values(slots)) if (sl.at) set.add(dayKey(sl.at));
    const list = [...set].sort();
    return list.length ? list : [dayKey(new Date().toISOString())];
  }, [startsOn, endsOn, slots]);

  const activeDay = day && days.includes(day) ? day : days[0];

  // Fases que existen de verdad (las que tienen partidos), no las teóricas.
  const phases = useMemo(() => {
    const maxRound = new Map<string, number>();
    for (const m of matches) {
      maxRound.set(m.bracket, Math.max(maxRound.get(m.bracket) ?? 0, m.round));
    }
    const seen = new Map<string, { bracket: string; round: number; label: string }>();
    for (const m of matches) {
      const key = `${m.bracket}:${m.round}`;
      if (seen.has(key)) continue;
      const label =
        m.bracket === "group"
          ? "Grupos"
          : roundLabel(m.round, maxRound.get(m.bracket) ?? m.round);
      seen.set(key, { bracket: m.bracket, round: m.round, label });
    }
    return [...seen.values()].sort(
      (a, b) => a.bracket.localeCompare(b.bracket) || a.round - b.round,
    );
  }, [matches]);

  /** Nombre de la fase de un partido. Misma fuente que el bloque de días: la
   *  tarjeta decía «RONDA 1» donde el bloque decía «SEMIFINALES». */
  const phaseLabel = (m: RealMatch): string =>
    phases.find((p) => p.bracket === m.bracket && p.round === m.round)?.label ??
    `Ronda ${m.round}`;

  const posOf = (id: string): { ti: number; ci: number } | null => {
    const sl = slots[id];
    if (!sl?.at || !sl.court || dayKey(sl.at) !== activeDay) return null;
    const d = new Date(sl.at);
    const ti = times.indexOf(d.getHours() * 60 + d.getMinutes());
    const ci = courts.indexOf(sl.court);
    return ti >= 0 && ci >= 0 ? { ti, ci } : null;
  };

  const placedIds = new Set(matches.filter((m) => posOf(m.id) !== null).map((m) => m.id));
  const unassigned = matches.filter((m) => !placedIds.has(m.id));

  /**
   * ¿Le toca a este partido jugarse el día que se está viendo? Si su fase no
   * tiene días asignados, vale cualquiera. Sirve para no colocar por error un
   * partido de semifinales el día de los grupos.
   */
  const fitsDay = (m: RealMatch): boolean => {
    const asigned = phaseDays[`${m.bracket}:${m.round}`];
    return !asigned || asigned.length === 0 || asigned.includes(activeDay);
  };

  const regIdsOf = (m: RealMatch): string[] =>
    [m.home_reg, m.home_reg2, m.away_reg, m.away_reg2].filter((x): x is string => !!x);

  /** Reglas duras: una pista no se parte en dos y una pareja no se duplica. */
  function conflictAt(ti: number, ci: number, movingId: string): string | null {
    const moving = matches.find((m) => m.id === movingId);
    if (!moving) return null;
    const occupied = matches.find((m) => {
      if (m.id === movingId) return false;
      const pos = posOf(m.id);
      return pos !== null && pos.ti === ti && pos.ci === ci;
    });
    if (occupied) return "Pista ocupada";
    const ids = new Set(regIdsOf(moving));
    const clash = matches.find((m) => {
      if (m.id === movingId) return false;
      const p = posOf(m.id);
      if (p?.ti !== ti) return false;
      return regIdsOf(m).some((x) => ids.has(x));
    });
    if (clash) return "Esa pareja ya juega a esa hora";
    return null;
  }

  async function place(matchId: string, at: string | null, court: string | null) {
    const prev = slots[matchId] ?? { at: null, court: null };
    setSlots((s) => ({ ...s, [matchId]: { at, court } }));
    setBusy(true);
    const reason = await onPersist(matchId, at, court);
    setBusy(false);
    if (reason) {
      // Revertir: dejar la tarjeta donde no se ha guardado sería mentir.
      setSlots((s) => ({ ...s, [matchId]: prev }));
      setErr(reason);
    }
  }

  function drop(ti: number, ci: number) {
    if (!dragId || readOnly) return;
    if (!conflictAt(ti, ci, dragId)) {
      void place(dragId, slotIso(activeDay, times[ti]), courts[ci]);
    }
    setDragId(null);
    setHover(null);
  }

  function MatchCard({ m }: { m: RealMatch }) {
    const home = m.home_reg ? (nameById.get(m.home_reg) ?? "—") : "Por determinar";
    const away = m.away_reg ? (nameById.get(m.away_reg) ?? "—") : "Por determinar";
    const label = [m.category, m.gender].filter(Boolean).join(" · ");
    return (
      <div
        draggable={!readOnly}
        onDragStart={(e) => {
          if (readOnly) return;
          setDragId(m.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", m.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setHover(null);
        }}
        onDoubleClick={() => {
          // Sacar del horario sin tener que arrastrarlo a ninguna parte.
          if (!readOnly && posOf(m.id)) void place(m.id, null, null);
        }}
        title={readOnly ? undefined : "Arrastra para colocar · doble clic para quitar"}
        className="tw-match-card"
        style={{
          // Atenuado si su fase se juega otro día: se puede colocar igual, pero
          // el organizador ve de un vistazo cuáles tocan hoy.
          opacity: dragId === m.id ? 0.4 : fitsDay(m) ? 1 : 0.45,
          cursor: readOnly ? "default" : "grab",
        }}
      >
        <span
          className="truncate"
          style={{
            display: "block",
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--text-faint)",
          }}
        >
          {phaseLabel(m)}
          {label ? ` · ${label}` : ""}
        </span>
        <span
          className="truncate"
          style={{ display: "block", marginTop: 4, fontSize: 12.5, fontWeight: 700 }}
        >
          {home}
        </span>
        <span
          className="truncate"
          style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}
        >
          {away}
        </span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<IconCalendar size={22} />}
        title="Todavía no hay partidos"
        body="Genera el cuadro o los grupos y aquí podrás repartirlos por horas y pistas."
      />
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 18px",
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Partido</span>
          <span className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>
            {slotMinutes || 60} min
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Descanso</span>
          <span className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>
            {restMinutes || 0} min
          </span>
        </div>
        {days.length > 1 && (
          <Segmented
            label="Día"
            value={activeDay}
            onChange={setDay}
            options={days.map((d) => ({
              value: d,
              label: <span className="mono">{`${d.slice(8, 10)}/${d.slice(5, 7)}`}</span>,
            }))}
          />
        )}
        <span className="tw-toolbar-spacer" />
        {!readOnly && (
          <Btn
            variant="danger-ghost"
            size="sm"
            onClick={() => setClearOpen(true)}
            disabled={busy}
          >
            Vaciar horario
          </Btn>
        )}
      </div>

      {days.length > 1 && phases.length > 0 && !readOnly && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Días de cada fase</div>
          <p
            style={{
              margin: "4px 0 12px",
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            Marca en qué días se juega cada fase; puede ser más de uno. Los
            partidos de las fases que no tocan hoy se ven atenuados abajo.
          </p>
          <div className="tw-phase-days">
            {phases.map((ph) => {
              const key = `${ph.bracket}:${ph.round}`;
              const sel = phaseDays[key] ?? [];
              return (
                <div key={key} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      minWidth: 110,
                    }}
                  >
                    {ph.label}
                  </span>
                  {days.map((d) => {
                    const on = sel.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={busy}
                        aria-pressed={on}
                        onClick={() => {
                          void (async () => {
                            setBusy(true);
                            const reason = await onTogglePhaseDay(
                              ph.bracket,
                              ph.round,
                              d,
                              !on,
                            );
                            setBusy(false);
                            if (reason) setErr(reason);
                          })();
                        }}
                        className={"tw-fcp-chip mono" + (on ? " is-on" : "")}
                      >
                        {d.slice(8, 10)}/{d.slice(5, 7)}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unassigned.length > 0 && (
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg-card-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Sin hora</span>
            <span className="card-head-count">{unassigned.length}</span>
          </div>
          <div className="tw-unassigned">
            {unassigned.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}

      <div className="tw-grid-scroll">
        <div
          className="tw-sched-canvas"
          style={{ gridTemplateColumns: `70px repeat(${courts.length}, minmax(150px, 1fr))` }}
        >
          <span />
          {courts.map((c) => (
            <span
              key={c}
              className="grid-head"
              style={{ textAlign: "center", paddingBottom: 8 }}
            >
              {c}
            </span>
          ))}

          {times.map((min, ti) => (
            <Fragment key={min}>
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  alignSelf: "start",
                  paddingTop: 12,
                }}
              >
                {minToHhmm(min)}
              </span>
              {courts.map((_, ci) => {
                const key = `${ti}-${ci}`;
                const m = matches.find((x) => {
                  const pos = posOf(x.id);
                  return pos !== null && pos.ti === ti && pos.ci === ci;
                });
                const isHover = hover === key && dragId !== null;
                const conflict = dragId ? conflictAt(ti, ci, dragId) : null;
                return (
                  <div
                    key={key}
                    onDragOver={(e) => {
                      if (readOnly) return;
                      e.preventDefault();
                      setHover(key);
                    }}
                    onDragLeave={() => setHover(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      drop(ti, ci);
                    }}
                    className="tw-slot-cell"
                    style={{
                      borderColor: isHover
                        ? conflict
                          ? "var(--error)"
                          : "var(--accent)"
                        : "var(--line)",
                      background: isHover
                        ? conflict
                          ? "var(--error-soft)"
                          : "var(--accent-10)"
                        : "transparent",
                    }}
                  >
                    {m ? (
                      <MatchCard m={m} />
                    ) : isHover && conflict ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--error)",
                          textAlign: "center",
                          padding: 6,
                        }}
                      >
                        {conflict}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <Modal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        labelledBy="vaciar-horario"
        width={440}
        title="¿Quitar todas las horas y pistas asignadas?"
        lede="Los partidos vuelven a la bandeja de «sin hora». Afecta a todos los días, no solo al que estás viendo."
        footer={
          <>
            <Btn onClick={() => setClearOpen(false)}>Cancelar</Btn>
            <Btn
              variant="danger"
              disabled={busy}
              onClick={() => {
                setClearOpen(false);
                void (async () => {
                  for (const m of matches) {
                    if (slots[m.id]?.at) await place(m.id, null, null);
                  }
                })();
              }}
            >
              Vaciar
            </Btn>
          </>
        }
      >
        {null}
      </Modal>

      {err && <Toast tone="error" title={err} onClose={() => setErr(null)} />}
    </>
  );
}

/* ── Modal para meter un resultado ─────────────────────────────── */
interface EntryTarget {
  match: RealMatch;
  homeName: string;
  awayName: string;
  isSocial: boolean;
  maxSets: number;
  setsToWin: number;
  advance: boolean;
}

function ResultModal({
  target,
  busy,
  onSave,
  onClose,
}: {
  target: EntryTarget;
  busy: boolean;
  onSave: (sets: number[][], social: [number, number]) => void;
  onClose: () => void;
}) {
  const { homeName, awayName, isSocial, maxSets } = target;
  const [sets, setSets] = useState<[string, string][]>(
    Array.from({ length: maxSets }, () => ["", ""] as [string, string]),
  );
  const [pts, setPts] = useState<[string, string]>(["", ""]);

  const setCell = (i: number, side: 0 | 1, v: string) =>
    setSets((prev) => {
      const next = prev.map((s) => [...s] as [string, string]);
      next[i][side] = v.replace(/[^0-9]/g, "").slice(0, 2);
      return next;
    });

  const submit = () => {
    if (isSocial) {
      onSave([], [parseInt(pts[0], 10) || 0, parseInt(pts[1], 10) || 0]);
    } else {
      const parsed = sets
        .map((s) => [parseInt(s[0], 10) || 0, parseInt(s[1], 10) || 0])
        .filter((s) => s[0] !== 0 || s[1] !== 0);
      onSave(parsed, [0, 0]);
    }
  };

  const scoreStyle = { width: 60, textAlign: "center" as const, fontSize: 15 };

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="tw-result-title"
      title="Resultado"
      lede={
        <>
          {homeName} <span style={{ color: "var(--text-faint)" }}>vs</span> {awayName}
        </>
      }
      footer={
        <>
          <Btn onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="accent" onClick={submit} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Btn>
        </>
      }
    >
      {isSocial ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Input
            className="mono"
            inputMode="numeric"
            value={pts[0]}
            onChange={(e) =>
              setPts([e.target.value.replace(/[^0-9]/g, "").slice(0, 2), pts[1]])
            }
            style={scoreStyle}
            aria-label={`Puntos ${homeName}`}
          />
          <span className="mono" style={{ color: "var(--text-faint)" }}>
            —
          </span>
          <Input
            className="mono"
            inputMode="numeric"
            value={pts[1]}
            onChange={(e) =>
              setPts([pts[0], e.target.value.replace(/[^0-9]/g, "").slice(0, 2)])
            }
            style={scoreStyle}
            aria-label={`Puntos ${awayName}`}
          />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sets.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  width: 48,
                }}
              >
                Set {i + 1}
              </span>
              <Input
                className="mono"
                inputMode="numeric"
                value={s[0]}
                onChange={(e) => setCell(i, 0, e.target.value)}
                style={scoreStyle}
              />
              <span className="mono" style={{ color: "var(--text-faint)" }}>
                —
              </span>
              <Input
                className="mono"
                inputMode="numeric"
                value={s[1]}
                onChange={(e) => setCell(i, 1, e.target.value)}
                style={scoreStyle}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ── Lista de partidos clicables (grupos / liga / rondas sociales) ─ */
function MatchRows({
  matches,
  nameOr,
  organizer,
  isSocial,
  onEnter,
}: {
  matches: RealMatch[];
  nameOr: (id: string | null) => string;
  organizer: boolean;
  isSocial: boolean;
  onEnter: (m: RealMatch) => void;
}) {
  const sorted = [...matches].sort((a, b) => a.round - b.round || a.slot - b.slot);
  return (
    <>
      {sorted.map((m) => {
        const can = organizer && !!m.home_reg && !!m.away_reg;
        const done = m.status === "finished";
        const score = isSocial
          ? done
            ? `${m.home_score ?? 0}–${m.away_score ?? 0}`
            : ""
          : setsToScore(m.sets);
        return (
          <div
            key={m.id}
            onClick={can ? () => onEnter(m) : undefined}
            role={can ? "button" : undefined}
            tabIndex={can ? 0 : undefined}
            onKeyDown={
              can
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onEnter(m);
                    }
                  }
                : undefined
            }
            className={"list-row" + (can ? " is-link" : "")}
            style={{
              minHeight: 46,
              padding: "10px 18px",
              cursor: can ? "pointer" : "default",
            }}
            title={can ? "Meter resultado" : undefined}
          >
            <span
              className="truncate"
              style={{ flex: 1, fontSize: 13.5, fontWeight: done ? 700 : 500 }}
            >
              {nameOr(m.home_reg)}
            </span>
            <span
              className="mono"
              style={{
                fontSize: 12,
                color: done ? "var(--text)" : "var(--text-faint)",
                fontWeight: done ? 700 : 500,
              }}
            >
              {score || "vs"}
            </span>
            <span
              className="truncate"
              style={{
                flex: 1,
                fontSize: 13.5,
                fontWeight: done ? 700 : 500,
                textAlign: "right",
              }}
            >
              {nameOr(m.away_reg)}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* ── Pantalla ──────────────────────────────────────────────────── */
export function TournamentDetail({
  id,
  spectator,
}: {
  id: string;
  /** Vista de jugador/espectador: sin acciones de organizador. */
  spectator?: boolean;
}) {
  const { clubs } = useSession();
  const [tab, setTab] = useState<Tab>(spectator ? "cuadro" : "inscripciones");
  const [followed, setFollowed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [mergeClose, setMergeClose] = useState(true);
  const [moveReg, setMoveReg] = useState<{
    id: string;
    label: string;
    gender: string | null;
    category: string | null;
  } | null>(null);
  const [deletingT, setDeletingT] = useState(false);

  async function removeTournament() {
    if (deletingT) return;
    setDeletingT(true);
    const res = await guardedWrite("borrar el torneo", () => deleteTournament(id));
    setDeletingT(false);
    if (!res.ok) {
      setConfirmDelete(false);
      setToast(res.reason);
      return;
    }
    window.location.href = "/club/torneos";
  }
  const [entry, setEntry] = useState<EntryTarget | null>(null);

  // Vuelta del pago de inscripción (?inscripcion=ok): confirma y refresca la
  // lista. La inscripción la crea el WEBHOOK en segundo plano, así que se
  // reintenta un par de veces para que aparezca la pareja recién pagada.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("inscripcion") !== "ok") return;
    setTab("inscripciones");
    setToast("¡Pago recibido! Tu inscripción se está confirmando…");
    window.history.replaceState({}, "", window.location.pathname);
    const t1 = setTimeout(() => setReloadKey((k) => k + 1), 2500);
    const t2 = setTimeout(() => setReloadKey((k) => k + 1), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Torneo, partidos e inscripciones en paralelo: son independientes bajo las
  // RPC públicas (funcionan también sin sesión, igual que en la app).
  const { data, loading, error } = useAsync(
    async () => {
      const [tour, matches, regs, phaseDays] = await Promise.all([
        fetchTournament(id),
        fetchTournamentMatches(id),
        fetchTournamentRegs(id),
        // Los días de cada fase son cosa del organizador; para el espectador
        // no aportan nada y la RLS no tiene por qué dejárselos leer.
        spectator ? Promise.resolve({}) : fetchPhaseDays(id).catch(() => ({})),
      ]);
      let regsTyped = regs as unknown as RealReg[];
      // El organizador ve el estado de cobro (la RPC pública no lo expone).
      if (!spectator) {
        const pays: Record<
          string,
          { paymentStatus: string | null; paymentMethod: string | null }
        > = await fetchRegsPayments(id).catch(() => ({}));
        regsTyped = regsTyped.map((r) => ({
          ...r,
          payment_status: pays[r.id]?.paymentStatus ?? r.payment_status ?? null,
          payment_method: pays[r.id]?.paymentMethod ?? null,
        }));
      }
      return {
        tour: (tour as RealTournament | null) ?? null,
        matches: matches as unknown as RealMatch[],
        regs: regsTyped,
        phaseDays: phaseDays as Record<string, string[]>,
      };
    },
    [id, reloadKey],
  );

  /**
   * ¿Organiza ESTE torneo quien lo está mirando?
   *
   * La página pasaba `spectator={role !== "club"}`, o sea «soy admin de ALGÚN
   * club». Con eso, el admin del club A veía los controles de organizador en
   * un torneo del club B: pulsaba los días de cada fase y la base le
   * respondía «new row violates row-level security policy». La RLS hacía su
   * trabajo; la pantalla no hacía el suyo, que es no ofrecer lo que no se
   * puede hacer.
   */
  const miembroDelClub =
    !!data?.tour?.club_id && clubs.some((c) => c.id === data.tour!.club_id);
  const esEspectador = spectator || !miembroDelClub;

  const backLink = {
    href: esEspectador ? "/torneos" : "/club/torneos",
    label: "Torneos",
  };

  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconAlert size={24} />}
            title="No se pudo cargar el torneo"
            body={error}
            action={<BtnLink href={backLink.href}>Volver a torneos</BtnLink>}
          />
        </Card>
      </div>
    );
  }

  const t = data?.tour ?? null;
  if (!t) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconAlert size={24} />}
            title="Torneo no disponible"
            body="Puede que el enlace haya caducado o el torneo se haya borrado."
            action={<BtnLink href={backLink.href}>Volver a torneos</BtnLink>}
          />
        </Card>
      </div>
    );
  }

  const matches = data?.matches ?? [];
  const regs = data?.regs ?? [];

  // Pestañas según el FORMATO: un cuadro KO no tiene grupos ni clasificación;
  // una liga/social no tiene cuadro. Se ocultan las que no aplican (antes salían
  // vacías). El organizador ve además Inscripciones y Configuración.
  const fmt = t.format;
  const showGrupos =
    fmt === "groups_ko" || matches.some((m) => m.bracket === "grp");
  const showClasificacion =
    fmt === "round_robin" ||
    fmt === "americano" ||
    fmt === "mexicano" ||
    fmt === "groups_ko";
  const showCuadro =
    fmt === "ko" ||
    fmt === "ko_consolation" ||
    fmt === "groups_ko" ||
    matches.some((m) => !["grp", "rr", "amer", "mex"].includes(m.bracket));
  const visibleTabs = TABS.filter(([k]) => {
    // Las parejas inscritas son públicas (la RPC no expone contacto a anónimos).
    // Solo la configuración del torneo queda para el organizador.
    if (esEspectador && k === "config") return false;
    if (k === "grupos") return showGrupos;
    if (k === "clasificacion") return showClasificacion;
    if (k === "cuadro") return showCuadro;
    return true; // inscripciones, horario, config
  });
  // Si el tab activo no está entre los visibles (p.ej. arranca en 'cuadro' pero
  // es una liga), cae al primero disponible.
  const curTab: Tab = visibleTabs.some(([k]) => k === tab)
    ? tab
    : (visibleTabs[0]?.[0] ?? tab);

  /* ── Cabecera ─────────────────────────────────────────────────── */
  const typeLabel = FORMAT_LABEL[t.format] ?? t.format;
  const statusLabel = STATUS_LABEL[t.status] ?? t.status;
  const cats = t.categories?.length
    ? t.categories
    : t.category
      ? [t.category]
      : [];
  const gens = t.genders?.length ? t.genders : t.gender ? [t.gender] : [];
  const dateStr = fmtDates(t.starts_on, t.ends_on);
  const statusTone: "accent" | "mute" | "warning" | "error" =
    t.status === "open"
      ? "accent"
      : t.status === "in_progress"
        ? "warning"
        : t.status === "canceled"
          ? "error"
          : "mute";
  // El importe se escribe como lo escribiría el club: «25 €», no «25 EUR».
  const feeLabel =
    t.entry_fee != null && t.entry_fee > 0
      ? formatFee(t.entry_fee, t.fee_currency)
      : "Gratis";

  /* ── Derivados de partidos ────────────────────────────────────── */
  const social = isSocialFormat(t.format);
  const groupMatches = matches.filter((m) => m.bracket === "grp");
  const koMatches = matches.filter(
    (m) => !["grp", "rr", "amer", "mex"].includes(m.bracket),
  );

  const rrMatches = matches.filter((m) => m.bracket === "rr");
  const socialMatches = matches.filter(
    (m) => m.bracket === "amer" || m.bracket === "mex",
  );

  // Motor de cuadros: despacha la generación por formato, recorriendo TODAS las
  // divisiones (género × categoría). Espejo de TournamentDetailScreen (app).
  // Todo pasa por `guardedWrite`, así que queda inerte en modo solo lectura.
  const organizer = !esEspectador;
  const koFormat = t.format === "ko" || t.format === "ko_consolation";
  const isRR = t.format === "round_robin";
  const isGroupsKo = t.format === "groups_ko";
  const isAmericano = t.format === "americano";
  const isMexicano = t.format === "mexicano";

  const genDivs: [string | null, string | null][] = (
    gens.length ? gens : [null]
  ).flatMap((g) =>
    (cats.length ? cats : [null]).map(
      (c) => [g, c] as [string | null, string | null],
    ),
  );

  // Fases de grupos+cuadro.
  const groupsGenerated = groupMatches.length > 0;
  const groupsDone =
    groupsGenerated && groupMatches.every((m) => m.status === "finished");
  const koExists = koMatches.length > 0;

  // Ejecuta `fn` en cada división, tolerando las ya generadas (para poder
  // generar el resto). Una sola llamada al guard envuelve todo el lote.
  async function runGen(
    what: string,
    okMsg: string,
    fn: (g: string | null, c: string | null) => Promise<void>,
  ) {
    if (busy) return;
    setBusy(true);
    let did = 0;
    const res = await guardedWrite(what, async () => {
      for (const [g, c] of genDivs) {
        try {
          await fn(g, c);
          did++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (!/ya (está|están|estan)\s+genera|ya\s+genera/i.test(msg)) throw e;
        }
      }
    });
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(did > 0 ? okMsg : "No había nada nuevo que generar.");
    } else {
      setToast(res.reason);
    }
  }

  // Marca el cobro de una inscripción (organizador): pagada / pendiente.
  /**
   * Vuelca una categoría entera sobre otra. Es lo que se hace cuando una se
   * queda con tres parejas y no da para cuadro: en vez de cancelarla, se juntan.
   */
  async function doMerge() {
    const [fg, fc] = mergeFrom.split("|");
    const [tg, tc] = mergeTo.split("|");
    if (!fg || !fc || !tg || !tc || mergeFrom === mergeTo || busy) return;
    setBusy(true);
    const res = await guardedWrite("agrupar las categorías", () =>
      mergeDivision({
        tournamentId: id,
        fromGender: fg,
        fromCategory: fc,
        toGender: tg,
        toCategory: tc,
        closeSource: mergeClose,
      }),
    );
    setBusy(false);
    setMergeOpen(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Categorías agrupadas");
    } else setToast(res.reason);
  }

  /** Cambia de categoría o género una inscripción ya hecha, sin perderla. */
  async function doMoveReg(gender: string, category: string) {
    if (!moveReg || busy) return;
    setBusy(true);
    const res = await guardedWrite("mover la inscripción", () =>
      moveRegistration(moveReg.id, gender, category),
    );
    setBusy(false);
    setMoveReg(null);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Inscripción movida");
    } else setToast(res.reason);
  }

  /**
   * Guarda el hueco de un partido. Devuelve el motivo del fallo (o null si
   * fue bien) para que la rejilla pueda revertir la tarjeta a su sitio.
   */
  /** Alterna un día de una fase. Devuelve el motivo si falla. */
  async function flipPhaseDay(
    bracket: string,
    round: number,
    day: string,
    on: boolean,
  ): Promise<string | null> {
    const res = await guardedWrite("guardar los días de la fase", () =>
      togglePhaseDay(id, bracket, round, day, on),
    );
    if (res.ok) setReloadKey((k) => k + 1);
    return res.ok ? null : res.reason;
  }

  async function persistSlot(
    matchId: string,
    at: string | null,
    court: string | null,
  ): Promise<string | null> {
    const res = await guardedWrite("guardar el horario", () =>
      setMatchSlot(matchId, at, court),
    );
    return res.ok ? null : res.reason;
  }

  async function markRegPayment(regId: string, status: "paid" | "pending_club") {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("actualizar el pago", () =>
      setRegistrationPayment(regId, status),
    );
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(status === "paid" ? "Marcada como pagada" : "Marcada como pendiente");
    } else setToast(res.reason);
  }

  const genKo = () =>
    runGen("generar el cuadro", "Cuadro generado.", (g, c) =>
      generateKoBracket(id, g, c),
    );
  const genRoundRobin = () =>
    runGen("generar la liga", "Liga generada.", (g, c) =>
      generateRoundRobin(id, g, c),
    );
  const genGroups = (size: number) =>
    runGen("generar los grupos", "Grupos generados.", (g, c) =>
      generateGroups(id, g, c, size),
    );
  const genKnockoutByPosition = () =>
    runGen("generar las eliminatorias", "Eliminatorias generadas.", (g, c) =>
      generateKnockoutFromGroups(id, g, c),
    );
  const genPrincipalConsol = () =>
    runGen("generar las eliminatorias", "Eliminatorias generadas.", (g, c) =>
      generatePrincipalConsolationFromGroups(id, g, c),
    );
  const genAmericano = () =>
    runGen("generar el americano", "Americano generado.", (g, c) =>
      generateAmericano(id, g, c),
    );
  const genMexicanoRound = () =>
    runGen("generar la ronda", "Ronda generada.", (g, c) =>
      generateMexicanoRound(id, g, c),
    );

  // Botones de generación disponibles según formato y fase.
  const canGenerateKo = organizer && koFormat && !koExists && regs.length >= 2;
  const canGenerateGroups = organizer && isGroupsKo && !groupsGenerated && regs.length >= 4;
  const canGenerateKnockout =
    organizer && isGroupsKo && groupsDone && !koExists;
  const canGenerateRR = organizer && isRR && rrMatches.length === 0 && regs.length >= 2;
  const canGenerateAmericano =
    organizer && isAmericano && socialMatches.length === 0 && regs.length >= 4;
  // Mexicano: 1ª ronda si no hay nada; siguiente ronda si la última terminó.
  const mexRounds = socialMatches.reduce((mx, m) => Math.max(mx, m.round), 0);
  const mexLastDone =
    mexRounds > 0 &&
    socialMatches.filter((m) => m.round === mexRounds).every((m) => m.status === "finished");
  const canGenerateMexicano =
    organizer && isMexicano && (socialMatches.length === 0 || mexLastDone) && regs.length >= 4;

  // Grupos: una liguilla por group_no, con su clasificación.
  const groupNos = Array.from(
    new Set(groupMatches.map((m) => m.group_no).filter((n): n is number => n != null)),
  ).sort((a, b) => a - b);
  const groups = groupNos.map((gn) => ({
    key: gn,
    name: `Grupo ${groupLetter(gn)}`,
    rows: computeStandings(
      regs.filter((r) => r.group_no === gn),
      groupMatches.filter((m) => m.group_no === gn),
    ),
  }));

  // Clasificación general: liga (round_robin), grupos combinados o social.
  const classMatches = social
    ? matches.filter((m) => m.bracket === "amer" || m.bracket === "mex")
    : matches.filter((m) => m.bracket === "rr" || m.bracket === "grp");
  const hasClass = classMatches.length > 0;
  const classRows: {
    key: string;
    name: string;
    played: number | null;
    won: number | null;
    lost: number | null;
    setsFor: number | null;
    setsAgainst: number | null;
    gamesFor: number | null;
    gamesAgainst: number | null;
    pts: number;
  }[] = social
    ? computeIndividual(regs, classMatches).map((p) => ({
        key: p.regId,
        name: p.name,
        played: p.played,
        won: p.won,
        lost: null,
        setsFor: null,
        setsAgainst: null,
        gamesFor: null,
        gamesAgainst: null,
        pts: p.points,
      }))
    : computeStandings(regs, classMatches).map((s) => ({
        key: s.regId,
        name: s.name,
        played: s.played,
        won: s.won,
        lost: s.lost,
        setsFor: s.setsFor,
        setsAgainst: s.setsAgainst,
        gamesFor: s.gamesFor,
        gamesAgainst: s.gamesAgainst,
        pts: s.points,
      }));

  // Cuadros KO (principal, consolación, oro/plata/bronce…) ordenados.
  const nameById = new Map(regs.map((r) => [r.id, pairName(r)]));
  const nameOr = (regId: string | null): string =>
    regId ? nameById.get(regId) ?? "—" : "Por determinar";

  // Abre el modal de resultado para un partido concreto.
  const openEntry = (m: RealMatch, advance: boolean, isSocial: boolean) => {
    const fmt = formatConfig(resolveMatchFormat(t, m.bracket));
    setEntry({
      match: m,
      homeName: nameOr(m.home_reg),
      awayName: nameOr(m.away_reg),
      isSocial,
      maxSets: fmt.maxSets,
      setsToWin: fmt.setsToWin,
      advance,
    });
  };

  // Guarda el resultado del partido abierto (sets → avance, o social).
  async function saveResult(sets: number[][], social: [number, number]) {
    if (!entry || busy) return;
    setBusy(true);
    const m = entry.match;
    const res = await guardedWrite("guardar el resultado", async () => {
      if (entry.isSocial) {
        await setSocialResult(
          { id: m.id, home_reg: m.home_reg, away_reg: m.away_reg },
          social[0],
          social[1],
        );
      } else {
        const rm: ResultMatch = {
          id: m.id,
          tournament_id: id,
          bracket: m.bracket,
          round: m.round,
          slot: m.slot,
          gender: m.gender,
          category: m.category,
          home_reg: m.home_reg,
          away_reg: m.away_reg,
        };
        await setMatchResult(rm, sets, entry.setsToWin, entry.advance);
      }
    });
    setBusy(false);
    if (res.ok) {
      setEntry(null);
      setReloadKey((k) => k + 1);
      setToast("Resultado guardado.");
    } else {
      setToast(res.reason);
    }
  }
  const koKeys = Array.from(new Set(koMatches.map((m) => m.bracket))).sort(
    (a, b) => bracketRank(a) - bracketRank(b),
  );
  const koBrackets = koKeys.map((key) => {
    const bm = koMatches.filter((m) => m.bracket === key);
    const total = bm.reduce((mx, m) => Math.max(mx, m.round), 0);
    const roundNums = Array.from(new Set(bm.map((m) => m.round))).sort(
      (a, b) => a - b,
    );
    const rounds: { round: string; ties: UiTie[] }[] = roundNums.map((rn) => ({
      round: roundLabel(rn, total),
      ties: bm
        .filter((m) => m.round === rn)
        .sort((a, b) => a.slot - b.slot)
        .map((m) => ({
          a: nameOr(m.home_reg),
          b: nameOr(m.away_reg),
          score: setsToScore(m.sets),
          winner:
            m.winner_reg === m.home_reg
              ? 0
              : m.winner_reg === m.away_reg
                ? 1
                : -1,
          onEnter:
            organizer && m.home_reg && m.away_reg && m.status !== "bye"
              ? () => openEntry(m, true, false)
              : undefined,
        })),
    }));
    return { key, title: bracketTitle(key), rounds };
  });

  const paidCount = regs.filter((r) => r.payment_status === "paid").length;
  const playedCount = matches.filter((m) => m.status === "finished").length;

  return (
    <div className="tw-page">
      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <PageHeader
        back={backLink}
        title={t.name}
        meta={[
          typeLabel,
          t.club_name ?? null,
          t.location ?? null,
          dateStr || "Fecha por confirmar",
        ]}
        actions={
          esEspectador ? (
            <>
              {/* Apuntarse es la acción principal: seguir el torneo es
                  secundario y no puede competir con ella en el acento. */}
              <Btn
                variant="quiet"
                icon={followed ? <IconCheck size={15} /> : undefined}
                onClick={() => setFollowed((v) => !v)}
              >
                {followed ? "Siguiendo" : "Seguir torneo"}
              </Btn>
              <BtnLink href={`/torneos/${t.id}/inscripcion`} variant="accent">
                Apuntarme
              </BtnLink>
            </>
          ) : t.status === "draft" ? (
            // Borrador: no publicado. Hasta pagar/publicar, NADIE se inscribe
            // ni se puede añadir a nadie (la BD lo bloquea; aquí la UX).
            <PayTournamentButton tournamentId={t.id} />
          ) : (
            <>
              <Btn variant="quiet">Alta manual</Btn>
              <BtnLink href={`/torneos/${t.id}/inscripcion`} icon={<IconTicket size={15} />}>
                Ficha de inscripción
              </BtnLink>
            </>
          )
        }
      >
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip tone={statusTone}>{statusLabel}</Chip>
          {!esEspectador && t.status !== "draft" && (
            <Chip plain>
              {t.billing_status === "paid" ? "Publicado y pagado" : "Publicado"}
            </Chip>
          )}
          {cats.map((c) => (
            <Chip key={c} tone="mute" plain>
              {c}
            </Chip>
          ))}
          {gens.map((g) => (
            <Chip key={g} tone="mute" plain>
              {g}
            </Chip>
          ))}
        </div>
      </PageHeader>

      {!esEspectador && t.status === "draft" && (
        <Note tone="warning" icon={<IconInfo size={16} />} style={{ marginBottom: 16 }}>
          Publica el torneo para abrir las inscripciones. Hasta entonces nadie
          puede unirse ni añadirse.
        </Note>
      )}

      {!esEspectador && t.signup_code && (
        <Card
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 18px",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
            Código de inscripción
          </span>
          <span className="code" style={{ fontSize: 15, fontWeight: 700 }}>
            {t.signup_code}
          </span>
          <Btn
            variant="quiet"
            size="sm"
            aria-label="Copiar código"
            icon={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(t.signup_code ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                /* se puede copiar a mano */
              }
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Btn>
          <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            Compártelo para que se apunten desde la app.
          </span>
        </Card>
      )}

      <StatRow style={{ marginBottom: 16 }}>
        <Stat
          label="Parejas inscritas"
          value={regs.length}
          unit={t.max_pairs ? `/ ${t.max_pairs}` : undefined}
          icon={<IconUsers size={14} />}
          sub={
            t.max_pairs
              ? regs.length >= t.max_pairs
                ? "Cupo completo"
                : `${t.max_pairs - regs.length} plazas libres`
              : undefined
          }
        />
        <Stat
          label="Partidos"
          value={matches.length}
          icon={<IconTrophy size={14} />}
          sub={matches.length > 0 ? `${playedCount} jugados` : "Aún sin generar"}
        />
        <Stat label="Cuota" value={feeLabel} icon={<IconTicket size={14} />} />
        {!esEspectador && (
          <Stat
            label="Cobradas"
            value={paidCount}
            unit={`/ ${regs.length}`}
            tone={regs.length > 0 && paidCount === regs.length ? "accent" : undefined}
            sub={
              regs.length === 0
                ? "Sin inscripciones"
                : paidCount === regs.length
                  ? "Todas cobradas"
                  : `${regs.length - paidCount} pendientes`
            }
          />
        )}
      </StatRow>

      {/* ── Pestañas ─────────────────────────────────────────────── */}
      <div className="tw-toolbar">
        {visibleTabs.map(([k, label]) => {
          const on = curTab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={on}
              className={"tw-fcp-chip" + (on ? " is-on" : "")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Contenido ────────────────────────────────────────────── */}
      {curTab === "inscripciones" &&
        (regs.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconTrophy size={24} />}
              title="Sin inscripciones todavía"
              body="Comparte el código para que las parejas se apunten desde la app."
            />
          </Card>
        ) : (
          <Card flush>
            <CardHead
              title="Parejas inscritas"
              count={regs.length}
              sub={
                esEspectador
                  ? undefined
                  : "Toca la categoría de una pareja para moverla de cuadro."
              }
            />
            <div className="tw-roster-scroll">
              <div className="tw-signup-head">
                <span>Pareja</span>
                <span>Categoría</span>
                <span>Género</span>
                <span>Puntos</span>
                <span>Cuota</span>
                <span>Contacto</span>
              </div>
              {regs.map((r) => (
                <div key={r.id} className="tw-signup-row">
                  <span className="truncate" style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {pairName(r)}
                  </span>
                  {esEspectador ? (
                    <span style={{ fontSize: 13 }}>{r.category ?? "—"}</span>
                  ) : (
                    <Btn
                      size="sm"
                      variant="quiet"
                      onClick={() =>
                        setMoveReg({
                          id: r.id,
                          label: pairName(r),
                          gender: r.gender,
                          category: r.category,
                        })
                      }
                      title="Mover de categoría"
                    >
                      {r.category ?? "—"}
                    </Btn>
                  )}
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {r.gender ?? "—"}
                  </span>
                  <span className="mono" style={{ fontSize: 13 }}>
                    {r.seed_points ?? "—"}
                  </span>
                  <span>
                    {r.payment_status === "paid" ? (
                      <Chip tone="accent">
                        {r.payment_method === "stripe" ? "Online" : "En club"}
                      </Chip>
                    ) : r.payment_status === "pending_club" ? (
                      !esEspectador ? (
                        <button
                          type="button"
                          className="chip chip-warning"
                          onClick={() => markRegPayment(r.id, "paid")}
                          disabled={busy}
                          title="Marcar como pagada"
                          style={{ cursor: busy ? "default" : "pointer" }}
                        >
                          Pendiente
                        </button>
                      ) : (
                        <Chip tone="warning">Pendiente</Chip>
                      )
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--text-faint)" }}>—</span>
                    )}
                  </span>
                  <span
                    className="mono truncate"
                    style={{ fontSize: 12.5, color: "var(--text-muted)" }}
                  >
                    {r.p1_phone ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}

      {curTab === "grupos" &&
        (groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconTrophy size={24} />}
              title="Sin grupos todavía"
              body={
                canGenerateGroups
                  ? "Reparte las parejas en grupos por siembra. Elige el tamaño de grupo."
                  : "La fase de grupos aparecerá aquí cuando el club la genere."
              }
              action={
                canGenerateGroups ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Btn variant="accent" disabled={busy} onClick={() => genGroups(4)}>
                      Grupos de 4
                    </Btn>
                    <Btn variant="ghost" disabled={busy} onClick={() => genGroups(3)}>
                      Grupos de 3
                    </Btn>
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="tw-club-grid">
            {groups.map((g) => (
              <Card key={g.key} flush>
                <CardHead title={g.name} count={g.rows.length} />
                <div className="tw-standings-head" style={{ minWidth: 0, gridTemplateColumns: "28px minmax(0,1fr) 56px 44px" }}>
                  <span>#</span>
                  <span>Pareja</span>
                  <span>G-P</span>
                  <span>Pts</span>
                </div>
                {g.rows.map((p, i) => (
                  <div
                    key={p.regId}
                    className="tw-standings-row"
                    style={{ minWidth: 0, gridTemplateColumns: "28px minmax(0,1fr) 56px 44px" }}
                  >
                    <span className="mono" style={{ color: "var(--text-faint)" }}>
                      {i + 1}
                    </span>
                    <span className="truncate" style={{ fontWeight: 600 }}>
                      {p.name}
                    </span>
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {p.won}-{p.lost}
                    </span>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {p.points}
                    </span>
                  </div>
                ))}
                {(() => {
                  const gm = groupMatches.filter((m) => m.group_no === g.key);
                  if (gm.length === 0) return null;
                  return (
                    <>
                      <div
                        className="grid-head"
                        style={{
                          padding: "10px 18px",
                          borderTop: "1px solid var(--line)",
                          borderBottom: "1px solid var(--line)",
                          background: "color-mix(in srgb, var(--bg-card-2) 45%, transparent)",
                        }}
                      >
                        Partidos del grupo
                      </div>
                      <MatchRows
                        matches={gm}
                        nameOr={nameOr}
                        organizer={organizer}
                        isSocial={false}
                        onEnter={(m) => openEntry(m, false, false)}
                      />
                    </>
                  );
                })()}
              </Card>
            ))}
          </div>
        ))}

      {curTab === "clasificacion" &&
        (!hasClass ? (
          <Card>
            <EmptyState
              icon={<IconTrophy size={24} />}
              title="Sin clasificación todavía"
              body={
                canGenerateRR
                  ? "Genera la liga: todos contra todos. La clasificación saldrá de los resultados."
                  : canGenerateAmericano
                    ? "Genera el americano: todas las rondas con compañeros rotativos."
                    : canGenerateMexicano
                      ? "Genera la 1ª ronda. Las siguientes se emparejan por el ranking tras cada resultado."
                      : "Aparecerá en cuanto se jueguen los primeros partidos."
              }
              action={
                canGenerateRR ? (
                  <Btn variant="accent" disabled={busy} onClick={genRoundRobin}>
                    {busy ? "Generando…" : "Generar liga"}
                  </Btn>
                ) : canGenerateAmericano ? (
                  <Btn variant="accent" disabled={busy} onClick={genAmericano}>
                    {busy ? "Generando…" : "Generar americano"}
                  </Btn>
                ) : canGenerateMexicano ? (
                  <Btn variant="accent" disabled={busy} onClick={genMexicanoRound}>
                    {busy ? "Generando…" : "Generar 1ª ronda"}
                  </Btn>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card flush>
            <CardHead
              title={social ? "Clasificación individual" : "Clasificación"}
              count={classRows.length}
            >
              {canGenerateMexicano && mexRounds > 0 && (
                <Btn variant="accent" size="sm" disabled={busy} onClick={genMexicanoRound}>
                  {busy ? "Generando…" : "Siguiente ronda"}
                </Btn>
              )}
            </CardHead>
            <div className="tw-roster-scroll">
              <div className="tw-standings-head">
                {["Pos", "Pareja", "PJ", "PG", "PP", "Sets +", "Sets −", "Juegos +", "Juegos −", "Pts"].map(
                  (h) => (
                    <span key={h}>{h}</span>
                  )
                )}
              </div>
              {classRows.map((p, i) => (
                <div key={p.key} className="tw-standings-row">
                  <span className="mono" style={{ color: "var(--text-faint)" }}>
                    {i + 1}
                  </span>
                  <span className="truncate" style={{ fontWeight: 700 }}>
                    {p.name}
                  </span>
                  <span className="mono">{p.played ?? "—"}</span>
                  <span className="mono">{p.won ?? "—"}</span>
                  <span className="mono">{p.lost ?? "—"}</span>
                  <span className="mono">{p.setsFor ?? "—"}</span>
                  <span className="mono">{p.setsAgainst ?? "—"}</span>
                  <span className="mono">{p.gamesFor ?? "—"}</span>
                  <span className="mono">{p.gamesAgainst ?? "—"}</span>
                  <span className="mono" style={{ color: "var(--accent)", fontWeight: 700 }}>
                    {p.pts}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}

      {curTab === "clasificacion" &&
        (isRR || social) &&
        (social ? socialMatches.length > 0 : rrMatches.length > 0) && (
          <Card flush style={{ marginTop: 16 }}>
            <CardHead
              title="Partidos"
              count={(social ? socialMatches : rrMatches).length}
              sub={organizer ? "Toca un partido para meter su resultado." : undefined}
            />
            <MatchRows
              matches={social ? socialMatches : rrMatches}
              nameOr={nameOr}
              organizer={organizer}
              isSocial={social}
              onEnter={(m) => openEntry(m, false, social)}
            />
          </Card>
        )}

      {curTab === "cuadro" &&
        (koBrackets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconTrophy size={24} />}
              title="Sin cuadro todavía"
              body={
                canGenerateKo
                  ? "Genera el cuadro cuando la inscripción esté cerrada: se siembran las parejas y se crean los partidos."
                  : canGenerateKnockout
                    ? "Los grupos han terminado. Genera las eliminatorias eligiendo cómo repartir a los clasificados."
                    : isGroupsKo && !groupsDone
                      ? "El cuadro aparecerá cuando termine la fase de grupos."
                      : "El cuadro aparecerá aquí cuando el club lo genere."
              }
              action={
                canGenerateKo ? (
                  <Btn variant="accent" disabled={busy} onClick={genKo}>
                    {busy ? "Generando…" : "Generar cuadro"}
                  </Btn>
                ) : canGenerateKnockout ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Btn variant="accent" disabled={busy} onClick={genPrincipalConsol}>
                      Principal y consolación
                    </Btn>
                    <Btn variant="ghost" disabled={busy} onClick={genKnockoutByPosition}>
                      Por posición
                    </Btn>
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {koBrackets.map((b) => (
              <Bracket key={b.key} rounds={b.rounds} title={b.title} />
            ))}
          </div>
        ))}

      {curTab === "horario" && (
        <>
          <Card flush>
            <ScheduleGrid
              matches={matches}
              nameById={nameById}
              courtsCount={Number(t?.courts ?? 3)}
              startTime={t?.start_time ?? null}
              endTime={t?.end_time ?? null}
              slotMinutes={Number(t?.slot_minutes ?? 60)}
              restMinutes={Number(t?.rest_minutes ?? 0)}
              startsOn={t?.starts_on ?? null}
              endsOn={t?.ends_on ?? null}
              readOnly={!!esEspectador}
              phaseDays={data?.phaseDays ?? {}}
              onTogglePhaseDay={flipPhaseDay}
              onPersist={persistSlot}
            />
          </Card>
        </>
      )}

      {curTab === "config" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card flush>
            <CardHead title="Datos del torneo" />
            <div className="card-body">
              <dl className="kv" style={{ margin: 0 }}>
                <dt>Formato</dt>
                <dd>{typeLabel}</dd>
                <dt>Estado</dt>
                <dd>{statusLabel}</dd>
                <dt>Fechas</dt>
                <dd>{dateStr || "Por confirmar"}</dd>
                <dt>Lugar</dt>
                <dd>{t.location ?? "—"}</dd>
                <dt>Cuota</dt>
                <dd>{feeLabel}</dd>
                <dt>Pistas</dt>
                <dd className="mono">{t.courts ?? "—"}</dd>
              </dl>
            </div>
            <div className="card-foot" style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: "var(--text-muted)" }}>
                El torneo se edita desde el asistente de creación.
              </span>
              <BtnLink href="/club/torneos" size="sm">
                Editar torneo
              </BtnLink>
            </div>
          </Card>

          <Card flush>
            <CardHead title="Agrupar categorías" />
            <div className="card-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", textWrap: "pretty" }}>
                Si una categoría se queda con pocas parejas, vuélcala sobre otra
                en vez de cancelarla. Las inscripciones se mantienen con su pago.
              </p>
            </div>
            <div className="card-foot">
              <span style={{ flex: 1 }} />
              <Btn size="sm" onClick={() => setMergeOpen(true)}>
                Agrupar categorías
              </Btn>
            </div>
          </Card>

          <Card flush danger>
            <CardHead title="Zona de peligro" />
            <div className="card-body">
              <Note tone="error" icon={<IconAlert size={16} />}>
                Borrar el torneo elimina sus inscripciones, cuadros y horario. No
                se puede deshacer, y si ya se han cobrado inscripciones esos pagos
                no se devuelven solos.
              </Note>
            </div>
            <div className="card-foot" style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1 }} />
              {!confirmDelete ? (
                <Btn size="sm" variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                  Borrar torneo
                </Btn>
              ) : (
                <>
                  <Btn size="sm" onClick={() => setConfirmDelete(false)} disabled={deletingT}>
                    Cancelar
                  </Btn>
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => void removeTournament()}
                    disabled={deletingT}
                  >
                    {deletingT ? "Borrando…" : "Sí, borrar el torneo"}
                  </Btn>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {entry && (
        <ResultModal
          target={entry}
          busy={busy}
          onSave={saveResult}
          onClose={() => setEntry(null)}
        />
      )}

      {mergeOpen && (
        <Modal
          open
          onClose={() => setMergeOpen(false)}
          labelledBy="agrupar-cat"
          title="Agrupar categorías"
          lede="Todas las parejas de la primera categoría pasan a la segunda."
          footer={
            <>
              <Btn onClick={() => setMergeOpen(false)}>Cancelar</Btn>
              <Btn
                variant="accent"
                disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo || busy}
                onClick={() => void doMerge()}
              >
                {busy ? "Agrupando…" : "Agrupar"}
              </Btn>
            </>
          }
        >
          {[
            { label: "Mueve las de", value: mergeFrom, set: setMergeFrom },
            { label: "A la categoría", value: mergeTo, set: setMergeTo },
          ].map((f) => (
            <Field key={f.label} label={f.label}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(t?.genders ?? []).flatMap((g) =>
                  (t?.categories ?? []).map((c) => {
                    const v = `${g}|${c}`;
                    const on = f.value === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={on}
                        onClick={() => f.set(v)}
                        className={"tw-fcp-chip" + (on ? " is-on" : "")}
                      >
                        {c} · {g}
                      </button>
                    );
                  }),
                )}
              </div>
            </Field>
          ))}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 6,
              fontSize: 13.5,
            }}
          >
            <input
              type="checkbox"
              checked={mergeClose}
              onChange={() => setMergeClose((v) => !v)}
            />
            Cerrar la categoría de origen a nuevas inscripciones
          </label>
        </Modal>
      )}

      {moveReg && (
        <Modal
          open
          onClose={() => setMoveReg(null)}
          labelledBy="mover-inscripcion"
          title={`Mover ${moveReg.label}`}
          lede="La pareja conserva su inscripción y su pago; solo cambia de cuadro."
          footer={<Btn onClick={() => setMoveReg(null)}>Cancelar</Btn>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(t?.genders ?? []).flatMap((g) =>
              (t?.categories ?? []).map((c) => {
                const same = g === moveReg.gender && c === moveReg.category;
                return (
                  <Btn
                    key={`${g}-${c}`}
                    block
                    disabled={same || busy}
                    onClick={() => void doMoveReg(g, c)}
                    style={{ justifyContent: "flex-start" }}
                  >
                    {c} · {g}
                    {same && " (actual)"}
                  </Btn>
                );
              }),
            )}
          </div>
        </Modal>
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

