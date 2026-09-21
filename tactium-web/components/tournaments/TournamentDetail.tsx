"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

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
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCopy,
  IconTrophy,
  IconZap,
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
  main: "CUADRO PRINCIPAL",
  consol: "CUADRO DE CONSOLACIÓN",
  gold: "CUADRO ORO",
  silver: "CUADRO PLATA",
  bronze: "CUADRO BRONCE",
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
    return n <= 4 ? "CUADRO DE CONSOLACIÓN" : `CONSOLACIÓN ${n - 3}`;
  }
  return `CUADRO ${b.toUpperCase()}`;
}

/* ── Etiqueta de ronda (espejo de roundLabel de la app) ──────────── */
function roundLabel(round: number, total: number): string {
  const fromEnd = total - round;
  if (fromEnd === 0) return "FINAL";
  if (fromEnd === 1) return "SEMIFINALES";
  if (fromEnd === 2) return "CUARTOS";
  if (fromEnd === 3) return "OCTAVOS";
  return `RONDA ${round}`;
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
  return (
    <div style={{ marginBottom: title ? 28 : 0 }}>
      {title && (
        <Eyebrow style={{ marginBottom: 14, paddingLeft: 24 }}>{title}</Eyebrow>
      )}
      <div className="tw-bracket-scroll">
        <div className="tw-bracket">
          {rounds.map((col) => (
            <div key={col.round} className="tw-bracket-col">
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: "var(--text-faint)",
                  textAlign: "center",
                  marginBottom: 14,
                }}
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
                              side === 0 ? "1px solid var(--hair)" : "none",
                            boxShadow: isWinner
                              ? "inset 2px 0 0 var(--accent)"
                              : "none",
                            opacity: tbd ? 0.45 : decided && !isWinner ? 0.5 : 1,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              fontSize: 12.5,
                              fontWeight: isWinner ? 700 : 500,
                              fontStyle: tbd ? "italic" : "normal",
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
                          fontSize: 10.5,
                          letterSpacing: "0.08em",
                          color: "var(--text-faint)",
                          borderTop: "1px solid var(--hair)",
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
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--accent)",
                textAlign: "center",
                marginBottom: 14,
              }}
            >
              CAMPEONES
            </div>
            <div
              style={{
                padding: "20px 14px",
                borderRadius: 12,
                background: "var(--accent-10)",
                border: "1.5px solid var(--accent)",
                textAlign: "center",
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <IconTrophy size={20} />
              Por determinar
            </div>
          </div>
        </div>
      </div>
    </div>
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
          ? "GRUPOS"
          : roundLabel(m.round, maxRound.get(m.bracket) ?? m.round);
      seen.set(key, { bracket: m.bracket, round: m.round, label });
    }
    return [...seen.values()].sort(
      (a, b) => a.bracket.localeCompare(b.bracket) || a.round - b.round,
    );
  }, [matches]);

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
          className="mono"
          style={{ fontSize: 8.5, letterSpacing: "0.16em", color: "var(--accent)" }}
        >
          {m.bracket === "group" ? `GRUPO ${m.group_no ?? ""}` : `RONDA ${m.round}`}
          {label ? ` · ${label}` : ""}
        </span>
        <span style={{ display: "block", marginTop: 5, fontSize: 11.5, fontWeight: 700 }}>
          {home}
        </span>
        <span
          style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}
        >
          {away}
        </span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div style={{ padding: 28 }}>
        <EmptyState
          icon={<IconCalendar size={30} />}
          title="Todavía no hay partidos"
          body="Genera el cuadro o los grupos y aquí podrás repartirlos por horas y pistas."
        />
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "16px 20px",
          borderBottom: "1px solid var(--hair)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="mono tw-stat-label">DURACIÓN POR PARTIDO</div>
          <div className="mono" style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            {slotMinutes || 60} min
          </div>
        </div>
        <div>
          <div className="mono tw-stat-label">DESCANSO ENTRE PARTIDOS</div>
          <div className="mono" style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>
            {restMinutes || 0} min
          </div>
        </div>
        {days.length > 1 && (
          <div>
            <div className="mono tw-stat-label">DÍA</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {days.map((d) => {
                const on = d === activeDay;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    className="btn"
                    style={{
                      padding: "6px 10px",
                      fontSize: 11.5,
                      fontWeight: on ? 700 : 500,
                      background: on ? "var(--accent-10)" : "transparent",
                      color: on ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                    }}
                  >
                    {d.slice(8, 10)}/{d.slice(5, 7)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {!readOnly && (
          <button
            className="btn btn-danger-ghost"
            onClick={() => setClearOpen(true)}
            disabled={busy}
            style={{ padding: "10px 16px", fontSize: 12.5 }}
          >
            Vaciar horario
          </button>
        )}
      </div>

      {days.length > 1 && phases.length > 0 && !readOnly && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hair)" }}>
          <div className="mono tw-stat-label">DÍAS DE CADA FASE</div>
          <p
            style={{
              margin: "8px 0 14px",
              fontSize: 12.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Marca en qué días se juega cada fase; puede ser más de uno. Los
            partidos de las fases que no tocan hoy se ven atenuados abajo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {phases.map((ph) => {
              const key = `${ph.bracket}:${ph.round}`;
              const sel = phaseDays[key] ?? [];
              return (
                <div key={key} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: "var(--text-faint)",
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
                        className="btn"
                        style={{
                          padding: "6px 10px",
                          fontSize: 11.5,
                          fontWeight: on ? 700 : 500,
                          background: on ? "var(--accent-10)" : "transparent",
                          color: on ? "var(--accent)" : "var(--text-muted)",
                          border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                        }}
                      >
                        {on ? "✓ " : ""}
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
            padding: "16px 20px",
            borderBottom: "1px solid var(--hair)",
            background: "var(--bg-card-2)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.16em",
              color: "var(--warning)",
              marginBottom: 10,
            }}
          >
            SIN HORA · {unassigned.length}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.16em",
                color: "var(--text-faint)",
                textAlign: "center",
                paddingBottom: 10,
              }}
            >
              {c.toUpperCase()}
            </span>
          ))}

          {times.map((min, ti) => (
            <Fragment key={min}>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.08em",
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
                        : "var(--hair)",
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
                        className="mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.1em",
                          color: "var(--error)",
                          textAlign: "center",
                          padding: 6,
                        }}
                      >
                        {conflict.toUpperCase()}
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
      >
        <h2 id="vaciar-horario" style={{ fontSize: 22 }}>
          ¿Quitar todas las horas y pistas asignadas?
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
          Los partidos vuelven a la bandeja de «sin hora». Afecta a todos los
          días, no solo al que estás viendo.
        </p>
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setClearOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              setClearOpen(false);
              void (async () => {
                for (const m of matches) {
                  if (slots[m.id]?.at) await place(m.id, null, null);
                }
              })();
            }}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            Vaciar
          </button>
        </div>
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

  const inputStyle: CSSProperties = {
    width: 52,
    padding: "8px 6px",
    textAlign: "center",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid var(--hair)",
    background: "var(--surface)",
    color: "var(--text)",
  };

  return (
    <Modal open onClose={onClose} labelledBy="tw-result-title">
      <div style={{ display: "grid", gap: 14 }}>
        <h3 id="tw-result-title" style={{ margin: 0, fontSize: 16 }}>
          Resultado
        </h3>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {homeName} <span style={{ color: "var(--text-faint)" }}>vs</span> {awayName}
        </div>
        {isSocial ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              inputMode="numeric"
              value={pts[0]}
              onChange={(e) =>
                setPts([e.target.value.replace(/[^0-9]/g, "").slice(0, 2), pts[1]])
              }
              style={inputStyle}
              aria-label={`Puntos ${homeName}`}
            />
            <span className="mono" style={{ color: "var(--text-faint)" }}>
              —
            </span>
            <input
              inputMode="numeric"
              value={pts[1]}
              onChange={(e) =>
                setPts([pts[0], e.target.value.replace(/[^0-9]/g, "").slice(0, 2)])
              }
              style={inputStyle}
              aria-label={`Puntos ${awayName}`}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sets.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-faint)", width: 44 }}
                >
                  SET {i + 1}
                </span>
                <input
                  inputMode="numeric"
                  value={s[0]}
                  onChange={(e) => setCell(i, 0, e.target.value)}
                  style={inputStyle}
                />
                <span className="mono" style={{ color: "var(--text-faint)" }}>
                  —
                </span>
                <input
                  inputMode="numeric"
                  value={s[1]}
                  onChange={(e) => setCell(i, 1, e.target.value)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-accent" onClick={submit} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
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
      {sorted.map((m, i) => {
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 20px",
              borderBottom: i === sorted.length - 1 ? "none" : "1px solid var(--hair)",
              cursor: can ? "pointer" : "default",
            }}
            title={can ? "Meter resultado" : undefined}
          >
            <span style={{ flex: 1, fontSize: 13, fontWeight: done ? 700 : 500 }}>
              {nameOr(m.home_reg)}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {score || "vs"}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13,
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

  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconAlert size={34} />}
          title="No se pudo cargar el torneo"
          body={error}
        />
      </Card>
    );
  }

  const t = data?.tour ?? null;
  if (!t) {
    return (
      <Card>
        <EmptyState
          icon={<IconAlert size={34} />}
          title="Torneo no disponible."
          body="Puede que el enlace haya caducado o el torneo se haya borrado."
        />
      </Card>
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
    if (spectator && k === "config") return false;
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
  const metaLine = [t.club_name, t.location, dateStr || "Fecha por confirmar"]
    .filter(Boolean)
    .join(" · ");

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
  const organizer = !spectator;
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
    name: `GRUPO ${groupLetter(gn)}`,
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

  return (
    <div className="tw-lineup-wrap">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div className="amb" style={{ padding: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <Eyebrow>TORNEO · {typeLabel.toUpperCase()}</Eyebrow>
              <h1 style={{ margin: "12px 0 0", fontSize: 32, lineHeight: 1.04 }}>
                {t.name}
              </h1>
              <div
                className="mono"
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                }}
              >
                {metaLine}
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {cats.map((c) => (
                  <span key={c} className="chip chip-mute">
                    {c}
                  </span>
                ))}
                {gens.map((g) => (
                  <span key={g} className="chip chip-mute">
                    {g}
                  </span>
                ))}
                <span className="chip">{statusLabel}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {spectator ? (
                <>
                  <button
                    className={"btn " + (followed ? "btn-ghost" : "btn-accent")}
                    onClick={() => setFollowed((v) => !v)}
                    style={{ padding: "12px 22px", fontSize: 13.5 }}
                  >
                    {followed ? "Seguido" : "Seguir torneo"}
                  </button>
                  <Link
                    href={`/torneos/${t.id}/inscripcion`}
                    className="btn btn-ghost"
                    style={{ padding: "12px 20px", fontSize: 13.5 }}
                  >
                    Apuntarme a este torneo
                  </Link>
                </>
              ) : t.status === "draft" ? (
                // Borrador: no publicado. Hasta pagar/publicar, NADIE se inscribe
                // ni se puede añadir a nadie (la BD lo bloquea; aquí la UX).
                <>
                  <PayTournamentButton tournamentId={t.id} />
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textWrap: "pretty",
                      maxWidth: 240,
                    }}
                  >
                    Publica el torneo para abrir las inscripciones. Hasta
                    entonces nadie puede unirse ni añadirse.
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="chip"
                    style={{
                      background: "var(--accent-10)",
                      color: "var(--accent)",
                      padding: "10px 16px",
                      fontSize: 12.5,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    ✓ Publicado{t.billing_status === "paid" ? " · pagado" : ""}
                  </span>
                  <Link
                    href={`/torneos/${t.id}/inscripcion`}
                    className="btn btn-ghost"
                    style={{ padding: "11px 18px", fontSize: 13 }}
                  >
                    Ficha de inscripción
                  </Link>
                  <button className="btn btn-ghost" style={{ padding: "11px 18px", fontSize: 13 }}>
                    Alta manual
                  </button>
                </>
              )}
            </div>
          </div>

          {!spectator && t.signup_code && (
            <div
              style={{
                marginTop: 22,
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                borderRadius: 12,
                background: "var(--bg-card-2)",
                flexWrap: "wrap",
              }}
            >
              <span className="eyebrow">CÓDIGO DE INSCRIPCIÓN</span>
              <span
                className="mono"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "var(--accent)",
                }}
              >
                {t.signup_code}
              </span>
              <button
                type="button"
                aria-label="Copiar código"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(t.signup_code ?? "");
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
                <IconCopy size={16} />
              </button>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Compártelo para que se apunten desde la app.
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* ── Pestañas ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {visibleTabs.map(([k, label]) => {
          const on = curTab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="btn"
              style={{
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                background: on ? "var(--accent-10)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
              }}
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
              icon={<IconTrophy size={34} />}
              title="Sin inscripciones todavía"
              body="Comparte el código para que las parejas se apunten desde la app."
            />
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
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
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{pairName(r)}</span>
                  {spectator ? (
                    <span className="mono" style={{ fontSize: 12 }}>
                      {r.category ?? "—"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="mono"
                      onClick={() =>
                        setMoveReg({
                          id: r.id,
                          label: pairName(r),
                          gender: r.gender,
                          category: r.category,
                        })
                      }
                      title="Mover de categoría"
                      style={{
                        fontSize: 12,
                        background: "transparent",
                        border: "1px dashed var(--hair-strong)",
                        borderRadius: 8,
                        padding: "3px 8px",
                        color: "var(--text)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {r.category ?? "—"}
                    </button>
                  )}
                  <span
                    className="mono"
                    style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-faint)" }}
                  >
                    {(r.gender ?? "").toUpperCase()}
                  </span>
                  <span className="mono" style={{ fontSize: 13, color: "var(--accent)" }}>
                    {r.seed_points ?? "—"}
                  </span>
                  <span className="mono" style={{ fontSize: 11 }}>
                    {r.payment_status === "paid" ? (
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                        {r.payment_method === "stripe" ? "Online ✓" : "Club ✓"}
                      </span>
                    ) : r.payment_status === "pending_club" ? (
                      !spectator ? (
                        <button
                          type="button"
                          onClick={() => markRegPayment(r.id, "paid")}
                          disabled={busy}
                          title="Marcar como pagada"
                          style={{
                            border: "1px solid var(--warning)",
                            background: "transparent",
                            color: "var(--warning)",
                            borderRadius: 8,
                            padding: "3px 8px",
                            fontSize: 10.5,
                            cursor: "pointer",
                          }}
                        >
                          Pendiente · cobrar
                        </button>
                      ) : (
                        <span style={{ color: "var(--warning)" }}>Pendiente</span>
                      )
                    ) : (
                      <span style={{ color: "var(--text-faint)" }}>—</span>
                    )}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--text-muted)" }}
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
              icon={<IconTrophy size={34} />}
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
                      gap: 10,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      className="btn btn-accent"
                      disabled={busy}
                      onClick={() => genGroups(3)}
                      style={{ padding: "13px 20px", fontSize: 13.5 }}
                    >
                      Grupos de 3
                    </button>
                    <button
                      className="btn btn-accent"
                      disabled={busy}
                      onClick={() => genGroups(4)}
                      style={{ padding: "13px 20px", fontSize: 13.5 }}
                    >
                      Grupos de 4
                    </button>
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="tw-club-grid">
            {groups.map((g) => (
              <Card key={g.key} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hair)" }}>
                  <Eyebrow>{g.name}</Eyebrow>
                </div>
                {g.rows.map((p, i) => (
                  <div
                    key={p.regId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 20px",
                      borderBottom:
                        i === g.rows.length - 1 ? "none" : "1px solid var(--hair)",
                    }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--text-faint)", width: 18 }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
                      {p.name}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {p.won}-{p.lost}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
                    >
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
                        style={{
                          padding: "8px 20px",
                          borderTop: "1px solid var(--hair)",
                          background: "var(--surface-2, transparent)",
                        }}
                      >
                        <Eyebrow>PARTIDOS</Eyebrow>
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
              icon={<IconTrophy size={34} />}
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
                  <button
                    className="btn btn-accent"
                    disabled={busy}
                    onClick={genRoundRobin}
                    style={{ padding: "13px 24px", fontSize: 14 }}
                  >
                    {busy ? "Generando…" : "Generar liga"}
                  </button>
                ) : canGenerateAmericano ? (
                  <button
                    className="btn btn-accent"
                    disabled={busy}
                    onClick={genAmericano}
                    style={{ padding: "13px 24px", fontSize: 14 }}
                  >
                    {busy ? "Generando…" : "Generar americano"}
                  </button>
                ) : canGenerateMexicano ? (
                  <button
                    className="btn btn-accent"
                    disabled={busy}
                    onClick={genMexicanoRound}
                    style={{ padding: "13px 24px", fontSize: 14 }}
                  >
                    {busy ? "Generando…" : "Generar 1ª ronda"}
                  </button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {canGenerateMexicano && mexRounds > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--hair)",
                }}
              >
                <button
                  className="btn btn-accent"
                  disabled={busy}
                  onClick={genMexicanoRound}
                  style={{ padding: "9px 16px", fontSize: 13 }}
                >
                  {busy ? "Generando…" : "Generar siguiente ronda"}
                </button>
              </div>
            )}
            <div className="tw-roster-scroll">
              <div className="tw-standings-head">
                {["POS", "PAREJA", "PJ", "PG", "PP", "SETS +", "SETS −", "JUEGOS +", "JUEGOS −", "PTS"].map(
                  (h) => (
                    <span key={h}>{h}</span>
                  )
                )}
              </div>
              {classRows.map((p, i) => (
                <div key={p.key} className="tw-standings-row">
                  <span className="mono">{i + 1}</span>
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
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
          <Card style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--hair)" }}>
              <Eyebrow>PARTIDOS</Eyebrow>
            </div>
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
              icon={<IconTrophy size={34} />}
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
                  <button
                    className="btn btn-accent"
                    disabled={busy}
                    onClick={genKo}
                    style={{ padding: "13px 24px", fontSize: 14 }}
                  >
                    {busy ? "Generando…" : "Generar cuadro"}
                  </button>
                ) : canGenerateKnockout ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      className="btn btn-accent"
                      disabled={busy}
                      onClick={genPrincipalConsol}
                      style={{ padding: "13px 20px", fontSize: 13.5 }}
                    >
                      Principal + consolación
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={genKnockoutByPosition}
                      style={{ padding: "13px 20px", fontSize: 13.5 }}
                    >
                      Por posición (oro/plata…)
                    </button>
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card style={{ padding: "24px 0" }}>
            {koBrackets.map((b) => (
              <Bracket key={b.key} rounds={b.rounds} title={b.title} />
            ))}
          </Card>
        ))}

      {curTab === "horario" && (
        <>
          <Card style={{ padding: 0, overflow: "hidden" }}>
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
              readOnly={!!spectator}
              phaseDays={data?.phaseDays ?? {}}
              onTogglePhaseDay={flipPhaseDay}
              onPersist={persistSlot}
            />
          </Card>
        </>
      )}

      {curTab === "config" && (
        <Card>
          <Eyebrow>CONFIGURACIÓN</Eyebrow>
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            Edita el torneo desde el asistente de creación.
          </p>
          <Link
            href="/club/torneos"
            className="btn btn-ghost"
            style={{ marginTop: 18, padding: "12px 20px", fontSize: 13.5 }}
          >
            Editar torneo
          </Link>

          <div
            style={{ height: 1, background: "var(--hair)", margin: "24px 0" }}
          />
          <Eyebrow>AGRUPAR CATEGORÍAS</Eyebrow>
          <p
            style={{
              margin: "12px 0 14px",
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Si una categoría se queda con pocas parejas, vuélcala sobre otra en
            vez de cancelarla. Las inscripciones se mantienen con su pago.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMergeOpen(true)}
            style={{ padding: "11px 18px", fontSize: 13 }}
          >
            Agrupar categorías
          </button>

          <div
            style={{ height: 1, background: "var(--hair)", margin: "24px 0" }}
          />
          <Eyebrow tone="error">ZONA DE PELIGRO</Eyebrow>
          <p
            style={{
              margin: "12px 0 14px",
              fontSize: 13,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Borrar el torneo elimina sus inscripciones, cuadros y horario. No se
            puede deshacer, y si ya se han cobrado inscripciones esos pagos no
            se devuelven solos.
          </p>
          {!confirmDelete ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "11px 18px", fontSize: 13 }}
            >
              Borrar torneo
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={deletingT}
                style={{ padding: "11px 18px", fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void removeTournament()}
                disabled={deletingT}
                style={{ padding: "11px 18px", fontSize: 13 }}
              >
                {deletingT ? "Borrando…" : "Sí, borrar el torneo"}
              </button>
            </div>
          )}
        </Card>
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
        <Modal open onClose={() => setMergeOpen(false)} labelledBy="agrupar-cat">
          <h2 id="agrupar-cat" style={{ fontSize: 23 }}>
            Agrupar categorías
          </h2>
          <p
            style={{
              margin: "10px 0 20px",
              fontSize: 13.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Todas las parejas de la primera pasan a la segunda.
          </p>
          {[
            { label: "MUEVE LAS DE", value: mergeFrom, set: setMergeFrom },
            { label: "A", value: mergeTo, set: setMergeTo },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 16 }}>
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
                {f.label}
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(t?.genders ?? []).flatMap((g) =>
                  (t?.categories ?? []).map((c) => {
                    const v = `${g}|${c}`;
                    const on = f.value === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => f.set(v)}
                        className="btn"
                        style={{
                          padding: "9px 14px",
                          fontSize: 12.5,
                          fontWeight: on ? 700 : 500,
                          background: on ? "var(--accent-10)" : "transparent",
                          color: on ? "var(--accent)" : "var(--text-muted)",
                          border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                        }}
                      >
                        {c} · {g}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
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
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMergeOpen(false)}
              style={{ padding: "12px 20px", fontSize: 13.5 }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-accent"
              disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo || busy}
              onClick={() => void doMerge()}
              style={{ padding: "12px 22px", fontSize: 13.5 }}
            >
              {busy ? "Agrupando…" : "Agrupar"}
            </button>
          </div>
        </Modal>
      )}

      {moveReg && (
        <Modal
          open
          onClose={() => setMoveReg(null)}
          labelledBy="mover-inscripcion"
        >
          <h2 id="mover-inscripcion" style={{ fontSize: 23 }}>
            Mover {moveReg.label}
          </h2>
          <p
            style={{
              margin: "10px 0 20px",
              fontSize: 13.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            La pareja conserva su inscripción y su pago; solo cambia de cuadro.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(t?.genders ?? []).flatMap((g) =>
              (t?.categories ?? []).map((c) => {
                const same = g === moveReg.gender && c === moveReg.category;
                return (
                  <button
                    key={`${g}-${c}`}
                    type="button"
                    className="btn btn-ghost"
                    disabled={same || busy}
                    onClick={() => void doMoveReg(g, c)}
                    style={{
                      padding: "12px 16px",
                      fontSize: 13.5,
                      justifyContent: "flex-start",
                      opacity: same ? 0.45 : 1,
                    }}
                  >
                    {c} · {g}
                    {same && " (actual)"}
                  </button>
                );
              }),
            )}
          </div>
          <div
            style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMoveReg(null)}
              style={{ padding: "12px 20px", fontSize: 13.5 }}
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

