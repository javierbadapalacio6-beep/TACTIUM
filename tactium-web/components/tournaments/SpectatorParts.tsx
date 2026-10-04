"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { supabaseBrowser } from "@/lib/supabase/client";
import {
  fetchRegsPayments,
  fetchTournamentMatches,
  fetchTournamentRegs,
  getRegistrationPartnerCode,
} from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { formatFee } from "@/lib/tournament-signup-pricing";
import { Btn, Card, Chip } from "@/components/ui";
import { IconBell, IconCheck, IconCopy, IconShare, IconTrophy } from "@/components/Icon";

/**
 * Vista del ESPECTADOR y del JUGADOR en /torneos/[id] (paridad con la app):
 * pestaña «Partidos» por día, tarjeta de partido estilo marcador, «Estás
 * dentro», «Tu próximo partido» con tu camino, campeones de la categoría,
 * resumen del torneo jugado y «Seguir torneo» (favorito de tipo torneo).
 *
 * No hay marcador en directo: «En pista» se deduce del horario (la hora ya
 * pasó y aún no hay resultado).
 */

/* ── Formas mínimas (encajan con RealMatch / RealReg de TournamentDetail) ── */
export interface PMatch {
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
  scheduled_at: string | null;
  court: string | null;
}
export interface PReg {
  id: string;
  gender: string | null;
  category: string | null;
  p1_name: string;
  p2_name: string | null;
  seed: number | null;
  seed_points: number | null;
  p1_user_id?: string | null;
  p2_user_id?: string | null;
}

/* ── Fechas ─────────────────────────────────────────────────────────── */
const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
export const dayLabel = (iso: string) => {
  const d = parseDay(iso);
  return `${DOW[d.getDay()]} ${d.getDate()}`;
};
export const longDay = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = parseDay(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${DOW[d.getDay()].toLowerCase()} ${d.getDate()} ${MESES[d.getMonth()]}`;
};
export const hhmm = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function countdown(iso: string, now: number): { text: string; urgent: boolean } {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { text: "", urgent: false };
  const diff = t - now;
  if (diff <= 0) return { text: "ya en pista", urgent: true };
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return { text: `en ${min} min`, urgent: min <= 15 };
  const day = localIso(new Date(t));
  if (day === localIso(new Date(now))) {
    const h = Math.floor(min / 60);
    const r = min % 60;
    return { text: r ? `en ${h} h ${r} min` : `en ${h} h`, urgent: false };
  }
  if (day === localIso(new Date(now + 86_400_000))) return { text: `mañana ${hhmm(iso)}`, urgent: false };
  return { text: `${dayLabel(day)} · ${hhmm(iso)}`, urgent: false };
}

/* ── Etiquetas ──────────────────────────────────────────────────────── */
export const GENDER_SHORT: Record<string, string> = {
  masculino: "Masc.",
  femenino: "Fem.",
  mixto: "Mixto",
};
export const GENDER_LABEL: Record<string, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  mixto: "Mixto",
};
export const divShort = (g: string | null, c: string | null) =>
  [c, g ? GENDER_SHORT[g] ?? g : null].filter(Boolean).join(" ") || "General";

const KO_NAME = (fromEnd: number) =>
  fromEnd === 0
    ? "Final"
    : fromEnd === 1
      ? "Semifinales"
      : fromEnd === 2
        ? "Cuartos"
        : fromEnd === 3
          ? "Octavos"
          : fromEnd === 4
            ? "Dieciseisavos"
            : `Ronda de ${2 ** (fromEnd + 1)}`;
const BRACKET_SHORT: Record<string, string> = {
  consol: "Consolación",
  gold: "Oro",
  silver: "Plata",
  bronze: "Bronce",
};
const SINGLE = new Set(["grp", "rr", "amer", "mex"]);

export function roundNameOf(m: PMatch, all: PMatch[]): string {
  if (m.bracket === "grp")
    return m.group_no != null ? `Grupo ${String.fromCharCode(65 + m.group_no)}` : "Grupos";
  if (m.bracket === "rr") return "Liga";
  if (m.bracket === "amer" || m.bracket === "mex") return `Ronda ${m.round}`;
  const max = all.reduce(
    (mx, x) =>
      x.bracket === m.bracket && x.gender === m.gender && x.category === m.category
        ? Math.max(mx, x.round)
        : mx,
    0,
  );
  const name = KO_NAME(max - m.round);
  if (m.bracket === "main") return name;
  const b = BRACKET_SHORT[m.bracket] ?? (m.bracket.startsWith("pos") ? "Consolación" : m.bracket);
  return `${b} · ${name}`;
}

export const pairLabel = (r: PReg | undefined | null): string =>
  r ? `${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ""}` : "Por determinar";
const fmtPts = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const scoreFor = (m: PMatch, mineHome: boolean): string | null => {
  if (m.status !== "finished") return null;
  if (Array.isArray(m.sets) && m.sets.length)
    return m.sets.map((s) => (mineHome ? `${s[0]}-${s[1]}` : `${s[1]}-${s[0]}`)).join(" ");
  if (m.home_score == null || m.away_score == null) return null;
  return mineHome ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`;
};

/* ── Estado del partido según el horario ────────────────────────────── */
export type LiveState = "finished" | "live" | "soon" | "late" | "scheduled" | "tbd" | "bye";
export function matchLiveState(m: PMatch, now: number, slotMinutes = 90): LiveState {
  if (m.status === "bye") return "bye";
  if (m.status === "finished") return "finished";
  if (!m.scheduled_at) return "tbd";
  const t = new Date(m.scheduled_at).getTime();
  if (Number.isNaN(t)) return "tbd";
  const diff = now - t;
  const known = !!m.home_reg && !!m.away_reg;
  if (diff >= 0 && known) return diff <= (slotMinutes + 60) * 60_000 ? "live" : "late";
  if (diff < 0 && -diff <= 30 * 60_000) return "soon";
  return "scheduled";
}
const STATE: Partial<Record<LiveState, { label: string; tone: "accent" | "mute" | "warning" }>> = {
  live: { label: "En pista", tone: "accent" },
  soon: { label: "En breve", tone: "accent" },
  finished: { label: "Terminado", tone: "mute" },
  late: { label: "Sin resultado", tone: "warning" },
  tbd: { label: "Sin hora", tone: "mute" },
};

/* ── Mi camino en el cuadro (espejo de buildPath de la app) ─────────── */
export interface PathStep {
  key: string;
  round: string;
  rival: string;
  score: string | null;
  when: string | null;
  state: "won" | "lost" | "current" | "next";
}
const whenOf = (m: PMatch, now: number) => {
  if (!m.scheduled_at) return null;
  const iso = localIso(new Date(m.scheduled_at));
  const day = iso === localIso(new Date(now)) ? "Hoy" : dayLabel(iso);
  return [day, hhmm(m.scheduled_at), m.court].filter(Boolean).join(" · ");
};
const RANK: Record<string, number> = { main: -1, gold: 0, silver: 1, bronze: 2, consol: 5 };
export function buildPath(
  format: string,
  matches: PMatch[],
  myIds: Set<string>,
  regById: Map<string, PReg>,
  now: number,
): { steps: PathStep[]; current: PMatch | null; consolNote: string | null } | null {
  const mine = matches
    .filter(
      (m) =>
        !SINGLE.has(m.bracket) &&
        m.status !== "bye" &&
        [m.home_reg, m.away_reg].some((x) => x && myIds.has(x)),
    )
    .sort((a, b) => (RANK[a.bracket] ?? 50) - (RANK[b.bracket] ?? 50) || a.round - b.round);
  if (!mine.length) return null;
  const steps: PathStep[] = [];
  let current: PMatch | null = null;
  for (const m of mine) {
    const mineHome = !!m.home_reg && myIds.has(m.home_reg);
    const rivalId = mineHome ? m.away_reg : m.home_reg;
    const done = m.status === "finished";
    const won = done && !!m.winner_reg && myIds.has(m.winner_reg);
    if (!done && !current) current = m;
    steps.push({
      key: m.id,
      round: roundNameOf(m, matches),
      rival: rivalId ? pairLabel(regById.get(rivalId)) : "Por determinar",
      score: scoreFor(m, mineHome),
      when: whenOf(m, now),
      state: done ? (won ? "won" : "lost") : "current",
    });
  }
  let consolNote: string | null = null;
  if (current) {
    const cur = current;
    const same = (x: PMatch) =>
      x.bracket === cur.bracket && x.gender === cur.gender && x.category === cur.category;
    const next = matches.find((x) => same(x) && x.round === cur.round + 1 && x.slot === Math.floor(cur.slot / 2));
    if (next) {
      const sib = matches.find((x) => same(x) && x.round === cur.round && x.slot === (cur.slot ^ 1));
      let rival = "por decidir";
      if (sib) {
        if (sib.status === "finished" && sib.winner_reg) rival = pairLabel(regById.get(sib.winner_reg));
        else if (sib.status === "bye") {
          const w = sib.home_reg ?? sib.away_reg;
          if (w) rival = pairLabel(regById.get(w));
        } else if (sib.home_reg && sib.away_reg)
          rival = `${pairLabel(regById.get(sib.home_reg))} o ${pairLabel(regById.get(sib.away_reg))}`;
      }
      steps.push({
        key: `next-${next.id}`,
        round: `${roundNameOf(next, matches)} si ganas`,
        rival,
        score: null,
        when: whenOf(next, now),
        state: "next",
      });
    }
    if (format === "ko_consolation" && cur.bracket === "main" && cur.round === 1) {
      const cm = matches.find(
        (x) =>
          x.bracket === "consol" &&
          x.round === 1 &&
          x.slot === Math.floor(cur.slot / 2) &&
          x.gender === cur.gender &&
          x.category === cur.category,
      );
      const w = cm ? whenOf(cm, now) : null;
      consolNote = w
        ? `Si pierdes, juegas la consolación: ${w.toLowerCase()}.`
        : "Si pierdes, pasas al cuadro de consolación.";
    }
  }
  return { steps, current, consolNote };
}

export function summarize(matches: PMatch[], myIds: Set<string>) {
  const mine = matches.filter(
    (m) =>
      m.status === "finished" &&
      [m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && myIds.has(x)),
  );
  if (!mine.length) return null;
  let wins = 0;
  let losses = 0;
  let games = 0;
  for (const m of mine) {
    const home = [m.home_reg, m.home_reg2].some((x) => x && myIds.has(x));
    if (m.winner_reg && myIds.has(m.winner_reg)) wins++;
    else losses++;
    if (Array.isArray(m.sets) && m.sets.length) for (const s of m.sets) games += (home ? s[0] : s[1]) ?? 0;
    else games += (home ? m.home_score : m.away_score) ?? 0;
  }
  const top = mine
    .filter((m) => m.bracket === "main" || m.bracket === "gold")
    .sort((a, b) => b.round - a.round)[0];
  let reached = "Fase de grupos";
  if (top) {
    const n = roundNameOf(top, matches);
    const won = !!top.winner_reg && myIds.has(top.winner_reg);
    reached = n === "Final" ? (won ? "Campeones" : "Final · subcampeones") : n === "Cuartos" ? "Cuartos de final" : n;
  } else if (mine.some((m) => m.bracket === "consol")) reached = "Consolación";
  else if (mine.some((m) => SINGLE.has(m.bracket) && m.bracket !== "grp")) reached = "Torneo completado";
  return { reached, wins, losses, games };
}

/* ── Piezas visuales ────────────────────────────────────────────────── */
const youTag = (
  <span
    className="mono"
    style={{
      fontSize: 10.5,
      fontWeight: 700,
      padding: "1px 6px",
      borderRadius: 5,
      background: "var(--accent-10)",
      color: "var(--accent)",
      flex: "none",
    }}
  >
    Tú
  </span>
);

/** Punto rojo de «En juego» que late despacio. */
export function LiveDot({ color = "var(--error)", size = 8 }: { color?: string; size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      style={{ display: "inline-block", width: size, height: size, borderRadius: size, background: color, flex: "none" }}
      animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
      transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function Side({
  m,
  home,
  regById,
  myIds,
  social,
}: {
  m: PMatch;
  home: boolean;
  regById: Map<string, PReg>;
  myIds: Set<string>;
  social: boolean;
}) {
  const a = home ? m.home_reg : m.away_reg;
  const b = home ? m.home_reg2 : m.away_reg2;
  const finished = m.status === "finished";
  const win = finished && !!m.winner_reg && m.winner_reg === a;
  let lines: string[];
  let seed: number | null = null;
  let mine = false;
  if (!a) lines = [m.round === 1 && m.bracket === "main" ? "BYE" : "Por determinar"];
  else {
    const ra = regById.get(a);
    if (social) {
      const rb = b ? regById.get(b) : undefined;
      lines = [ra?.p1_name ?? "—", ...(rb ? [rb.p1_name] : [])];
      mine = myIds.has(a) || (!!b && myIds.has(b));
    } else {
      lines = [ra?.p1_name ?? "—", ...(ra?.p2_name ? [ra.p2_name] : [])];
      seed = ra?.seed ?? null;
      mine = myIds.has(a);
    }
  }
  const sets = !social && Array.isArray(m.sets) && m.sets.length ? m.sets : null;
  const idx = home ? 0 : 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {lines.map((ln, i) => (
          <div
            key={i}
            className="truncate"
            style={{
              fontSize: 13.5,
              lineHeight: "19px",
              fontWeight: finished && win ? 700 : 500,
              color: !a ? "var(--text-faint)" : finished && !win ? "var(--text-muted)" : "var(--text)",
              fontStyle: !a ? "italic" : undefined,
            }}
          >
            {ln}
            {i === 0 && seed ? (
              <sup style={{ color: "var(--text-faint)", fontSize: 10, marginLeft: 3 }}>({seed})</sup>
            ) : null}
          </div>
        ))}
      </div>
      {mine && youTag}
      {finished &&
        (sets ? (
          <div style={{ display: "flex", gap: 10 }}>
            {sets.map((s, i) => (
              <span
                key={i}
                className="mono"
                style={{
                  width: 16,
                  textAlign: "center",
                  fontSize: 15,
                  fontWeight: s[idx] > s[1 - idx] ? 700 : 500,
                  color: s[idx] > s[1 - idx] ? "var(--text)" : "var(--text-muted)",
                }}
              >
                {s[idx]}
              </span>
            ))}
          </div>
        ) : (
          <span className="mono" style={{ fontSize: 15, fontWeight: win ? 700 : 500 }}>
            {home ? m.home_score : m.away_score}
          </span>
        ))}
    </div>
  );
}

/** Tarjeta de partido estilo marcador: «Pista 3 · 2ª Masc. · Cuartos» + estado. */
export function MatchCard({
  m,
  all,
  regById,
  myIds,
  state,
  social,
  showDiv,
  flash,
}: {
  m: PMatch;
  all: PMatch[];
  regById: Map<string, PReg>;
  myIds: Set<string>;
  state: LiveState;
  social: boolean;
  showDiv: boolean;
  flash?: boolean;
}) {
  const st = STATE[state];
  const head = [
    m.court ?? (m.scheduled_at ? null : "Sin hora"),
    showDiv ? divShort(m.gender, m.category) : null,
    roundNameOf(m, all),
  ]
    .filter(Boolean)
    .join(" · ");
  const mine = [m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && myIds.has(x));
  return (
    <div
      style={{
        border: `1px solid ${mine ? "var(--accent-40)" : "var(--line)"}`,
        borderRadius: 12,
        background: flash ? "var(--accent-10)" : "var(--bg-card)",
        transition: "background 600ms var(--ease)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--text-muted)" }}>
          {head}
        </span>
        {st && (
          <Chip tone={st.tone} plain={state !== "live"}>
            {state === "live" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{st.label}</span>
            ) : (
              st.label
            )}
          </Chip>
        )}
      </div>
      <div style={{ padding: "8px 12px", display: "grid", gap: 6 }}>
        <Side m={m} home regById={regById} myIds={myIds} social={social} />
        <div style={{ height: 1, background: "var(--line)" }} />
        <Side m={m} home={false} regById={regById} myIds={myIds} social={social} />
      </div>
    </div>
  );
}

/* ── Pestaña «Partidos» por día ─────────────────────────────────────── */
export function MatchesByDay({
  format,
  slotMinutes,
  matches,
  regs,
  myRegIds,
  updatedAt,
  fresh,
}: {
  format: string;
  slotMinutes: number;
  matches: PMatch[];
  regs: PReg[];
  myRegIds: Set<string>;
  updatedAt: number | null;
  fresh: Set<string>;
}) {
  const now = useNow(10_000);
  const social = format === "americano" || format === "mexicano";
  const regById = useMemo(() => new Map(regs.map((r) => [r.id, r])), [regs]);
  const playable = useMemo(() => matches.filter((m) => m.status !== "bye"), [matches]);
  const divisions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of playable) {
      const k = `${m.gender ?? ""}|${m.category ?? ""}`;
      if (!seen.has(k)) seen.set(k, divShort(m.gender, m.category));
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [playable]);
  const multiDiv = divisions.length > 1;
  const [onlyMine, setOnlyMine] = useState(false);
  const [div, setDiv] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const filtered = playable.filter((m) => {
    if (div && `${m.gender ?? ""}|${m.category ?? ""}` !== div) return false;
    if (onlyMine && ![m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && myRegIds.has(x)))
      return false;
    return true;
  });
  const days = useMemo(() => {
    const s = new Set<string>();
    for (const m of playable) if (m.scheduled_at) s.add(localIso(new Date(m.scheduled_at)));
    return [...s].sort();
  }, [playable]);
  const hasNone = filtered.some((m) => !m.scheduled_at && !!m.home_reg && !!m.away_reg);
  const today = localIso(new Date(now));
  const defaultDay = days.includes(today)
    ? today
    : days.find((d) => d > today) ?? days[days.length - 1] ?? (hasNone ? "none" : null);
  const active = day && (days.includes(day) || day === "none") ? day : defaultDay;
  const list = filtered
    .filter((m) =>
      active === "none"
        ? !m.scheduled_at && !!m.home_reg && !!m.away_reg
        : !!m.scheduled_at && localIso(new Date(m.scheduled_at)) === active,
    )
    .sort(
      (a, b) =>
        (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "") ||
        (a.court ?? "").localeCompare(b.court ?? "", "es", { numeric: true }),
    );
  const groups: { time: string; items: PMatch[] }[] = [];
  for (const m of list) {
    const tm = hhmm(m.scheduled_at) ?? "Sin hora";
    const g = groups.find((x) => x.time === tm);
    if (g) g.items.push(m);
    else groups.push({ time: tm, items: [m] });
  }
  const ago = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

  if (playable.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
          Los partidos salen cuando el club publique el cuadro. Aquí verás cada día quién juega, a
          qué hora y en qué pista.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {days.length + (hasNone ? 1 : 0) > 1 && (
        <div className="tw-toolbar" role="tablist" aria-label="Día" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === active}
              onClick={() => setDay(d)}
              className={"tw-fcp-chip" + (d === active ? " is-on" : "")}
            >
              {d === today ? `Hoy · ${dayLabel(d)}` : dayLabel(d)}
            </button>
          ))}
          {hasNone && (
            <button
              type="button"
              role="tab"
              aria-selected={active === "none"}
              onClick={() => setDay("none")}
              className={"tw-fcp-chip" + (active === "none" ? " is-on" : "")}
            >
              Sin hora
            </button>
          )}
        </div>
      )}
      {(myRegIds.size > 0 || multiDiv) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            aria-pressed={!onlyMine && !div}
            onClick={() => {
              setOnlyMine(false);
              setDiv(null);
            }}
            className={"tw-fcp-chip" + (!onlyMine && !div ? " is-on" : "")}
          >
            Todos
          </button>
          {myRegIds.size > 0 && (
            <button
              type="button"
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine((v) => !v)}
              className={"tw-fcp-chip" + (onlyMine ? " is-on" : "")}
            >
              Los míos
            </button>
          )}
          {multiDiv &&
            divisions.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={div === d.key}
                onClick={() => setDiv(div === d.key ? null : d.key)}
                className={"tw-fcp-chip" + (div === d.key ? " is-on" : "")}
              >
                {d.label}
              </button>
            ))}
        </div>
      )}
      {ago != null && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)" }}>
          Actualizado hace {ago < 60 ? `${ago} s` : `${Math.round(ago / 60)} min`}. «En pista» sale
          del horario: el resultado aparece cuando el club lo mete.
        </p>
      )}
      {groups.length === 0 ? (
        <Card>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
            {onlyMine ? "Este día no juegas." : "No hay partidos con este filtro."}
          </p>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.time}>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, margin: "6px 0 8px" }}>
              {g.time}
            </div>
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              }}
            >
              {g.items.map((m) => (
                <MatchCard
                  key={m.id}
                  m={m}
                  all={matches}
                  regById={regById}
                  myIds={myRegIds}
                  state={matchLiveState(m, now, slotMinutes || 90)}
                  social={social}
                  showDiv={multiDiv}
                  flash={fresh.has(m.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/* ── «Estás dentro» ─────────────────────────────────────────────────── */
export function YouAreIn({
  tournamentName,
  reg,
  entryFee,
  feeCurrency,
  payment,
  hasBracket,
  isP1,
}: {
  tournamentName: string;
  reg: PReg;
  entryFee: number | null;
  feeCurrency: string | null;
  payment: { status: string | null; method: string | null } | null;
  hasBracket: boolean;
  isP1: boolean;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!isP1 || reg.p2_user_id) return;
    let alive = true;
    getRegistrationPartnerCode(reg.id).then((c) => alive && setCode(c));
    return () => {
      alive = false;
    };
  }, [reg.id, reg.p2_user_id, isP1]);
  const fee = entryFee && entryFee > 0 ? formatFee(entryFee, feeCurrency) : null;
  const st = payment?.status ?? null;
  const chip =
    st === "paid"
      ? { t: payment?.method === "stripe" ? "Pagado online" : "Pagado", tone: "accent" as const }
      : st === "pending_club"
        ? { t: "Pago pendiente", tone: "warning" as const }
        : !fee
          ? { t: "Gratis", tone: "mute" as const }
          : null;
  const payLine = !fee
    ? null
    : st === "pending_club"
      ? `Cuota: ${fee} por persona. Pagas en el club el día del torneo.`
      : st === "paid"
        ? payment?.method === "stripe"
          ? `Cuota: ${fee} por persona, pagada online al apuntarte.`
          : `Cuota: ${fee} por persona, pagada en el club.`
        : `Cuota: ${fee} por persona.`;
  const partnerFirst = reg.p2_name ? reg.p2_name.split(/\s+/)[0] : "tu pareja";
  const share = async () => {
    if (!code) return;
    const text = `Te he apuntado al torneo «${tournamentName}» en TACTIUM. Entra con este código de pareja para verlo: ${code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* cancelado */
    }
  };
  return (
    <Card style={{ borderColor: "var(--accent-40)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
          Estás dentro · {divShort(reg.gender, reg.category)}
        </span>
        {chip && <Chip tone={chip.tone}>{chip.t}</Chip>}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{pairLabel(reg)}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
        {[
          reg.seed_points != null ? `${fmtPts(reg.seed_points)} pts` : null,
          reg.seed ? `cabeza de serie ${reg.seed}` : null,
          hasBracket ? null : "el cuadro sale cuando cierre la inscripción",
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
      {payLine && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>{payLine}</div>}
      {code && !reg.p2_user_id && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: "var(--bg-card-2)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Tu pareja aún no tiene cuenta</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span className="code" style={{ flex: 1, fontSize: 20, fontWeight: 700, letterSpacing: "0.18em" }}>
              {code}
            </span>
            <Btn
              variant="accent"
              size="sm"
              icon={copied ? <IconCheck size={14} /> : <IconShare size={14} />}
              onClick={share}
            >
              {copied ? "Copiado" : "Enviárselo"}
            </Btn>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 6 }}>
            Con este código {partnerFirst} ve el torneo y sus partidos en su móvil.
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── «Tu próximo partido» + tu camino ───────────────────────────────── */
export function NextMatch({
  match,
  matches,
  regById,
  myIds,
  slotMinutes,
  path,
  consolNote,
  onSeeBracket,
  onSeeMatches,
}: {
  match: PMatch;
  matches: PMatch[];
  regById: Map<string, PReg>;
  myIds: Set<string>;
  slotMinutes: number;
  path: PathStep[];
  consolNote: string | null;
  onSeeBracket?: () => void;
  onSeeMatches: () => void;
}) {
  const now = useNow(60_000);
  const mineHome = !!match.home_reg && myIds.has(match.home_reg);
  const rivalId = mineHome ? match.away_reg : match.home_reg;
  const rival = rivalId ? regById.get(rivalId) : undefined;
  const state = matchLiveState(match, now, slotMinutes || 90);
  const cd = match.scheduled_at ? countdown(match.scheduled_at, now) : null;
  const prev = rivalId
    ? matches
        .filter((m) => m.status === "finished" && m.winner_reg === rivalId && m.bracket === match.bracket && m.round < match.round)
        .sort((a, b) => b.round - a.round)[0]
    : undefined;
  const prevText = prev
    ? `ganaron ${scoreFor(prev, prev.home_reg === rivalId) ?? ""} en ${roundNameOf(prev, matches).toLowerCase()}`
    : null;
  const otherDay =
    match.scheduled_at && localIso(new Date(match.scheduled_at)) !== localIso(new Date(now))
      ? longDay(localIso(new Date(match.scheduled_at)))
      : null;
  return (
    <Card style={{ borderColor: "var(--accent-40)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
          Tu próximo partido · {roundNameOf(match, matches)}
        </span>
        {state === "live" ? (
          <Chip tone="accent">En pista</Chip>
        ) : cd ? (
          <span
            className="mono"
            style={{ fontSize: 13, fontWeight: 700, color: cd.urgent ? "var(--accent)" : "var(--text-muted)" }}
          >
            {cd.text}
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {hhmm(match.scheduled_at) ?? "--:--"}
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-muted)" }}>
          {match.court ?? "Pista por confirmar"}
        </span>
        {otherDay && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{otherDay}</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>
        vs {rival ? pairLabel(rival) : "por determinar"}
        {rival?.seed ? ` · cabeza de serie ${rival.seed}` : ""}
      </div>
      {rival && (rival.seed_points != null || prevText) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
          {[rival.seed_points != null ? `${fmtPts(rival.seed_points)} pts` : null, prevText]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
      {path.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 4 }}>
            Tu camino · {divShort(match.gender, match.category)}
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {path.map((p) => (
              <li
                key={p.key}
                style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid var(--line)" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    marginTop: 5,
                    flex: "none",
                    background:
                      p.state === "won"
                        ? "var(--accent)"
                        : p.state === "lost"
                          ? "var(--error)"
                          : p.state === "current"
                            ? "var(--text)"
                            : "var(--line-strong)",
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="truncate"
                    style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: p.state === "next" ? "var(--text-muted)" : "var(--text)" }}
                  >
                    {p.round} · vs {p.rival}
                  </span>
                  {p.when && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{p.when}</span>}
                </span>
                {p.score && (
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                    {p.score}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {consolNote && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>{consolNote}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {onSeeBracket && (
          <Btn size="sm" onClick={onSeeBracket}>
            Ver cuadro
          </Btn>
        )}
        <Btn size="sm" onClick={onSeeMatches}>
          Ver todos los partidos
        </Btn>
      </div>
    </Card>
  );
}

/* ── Campeones de la categoría ──────────────────────────────────────── */
export function Champions({
  divName,
  winner,
  runnerUp,
  consol,
  score,
}: {
  divName: string | null;
  winner: string;
  runnerUp: string | null;
  consol: string | null;
  score: string | null;
}) {
  const reduce = useReducedMotion();
  return (
    <Card style={{ borderColor: "var(--accent-40)", background: "linear-gradient(135deg, var(--accent-10), var(--bg-card))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <motion.span
          style={{ display: "inline-flex", color: "var(--accent)", borderRadius: 999 }}
          initial={reduce ? false : { scale: 0.6, opacity: 0, filter: "drop-shadow(0 0 0 transparent)" }}
          animate={
            reduce
              ? undefined
              : {
                  scale: 1,
                  opacity: 1,
                  filter: [
                    "drop-shadow(0 0 0 transparent)",
                    "drop-shadow(0 0 10px var(--accent-55))",
                    "drop-shadow(0 0 0 transparent)",
                  ],
                }
          }
          transition={reduce ? undefined : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <IconTrophy size={18} />
        </motion.span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
          Campeones{divName ? ` · ${divName}` : ""}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 10 }}>{winner}</div>
      {(score || runnerUp) && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Final{score ? `: ${score}` : ""}
          {runnerUp ? ` a ${runnerUp}` : ""}
        </div>
      )}
      {(runnerUp || consol) && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--line)" }}>
          {runnerUp && (
            <div style={{ display: "flex", gap: 10, paddingTop: 10, fontSize: 13 }}>
              <span className="truncate" style={{ flex: 1 }}>
                <span style={{ color: "var(--text-faint)" }}>Subcampeones · </span>
                {runnerUp}
              </span>
              <span className="mono" style={{ color: "var(--text-faint)" }}>
                2º
              </span>
            </div>
          )}
          {consol && (
            <div style={{ display: "flex", gap: 10, paddingTop: 8, fontSize: 13 }}>
              <span className="truncate" style={{ flex: 1 }}>
                <span style={{ color: "var(--text-faint)" }}>Consolación · </span>
                {consol}
              </span>
              <span className="mono" style={{ color: "var(--text-faint)" }}>
                C
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── «Tu torneo» ────────────────────────────────────────────────────── */
export function MySummary({
  summary,
  shareText,
}: {
  summary: { reached: string; wins: number; losses: number; games: number };
  shareText: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Tu torneo</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{summary.reached}</div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
        {summary.wins} {summary.wins === 1 ? "victoria" : "victorias"}, {summary.losses}{" "}
        {summary.losses === 1 ? "derrota" : "derrotas"} · {summary.games} juegos ganados
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn
          size="sm"
          variant="quiet"
          icon={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ text: shareText });
              else {
                await navigator.clipboard.writeText(shareText);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }
            } catch {
              /* cancelado */
            }
          }}
        >
          {copied ? "Copiado" : "Compartir mi torneo"}
        </Btn>
      </div>
    </Card>
  );
}

/* ── Seguir torneo = favorito de tipo torneo ────────────────────────── */
const LS_KEY = "tactium-followed-tournaments";
const readLocal = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeLocal = (ids: string[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: solo dura esta visita */
  }
};

/**
 * «Seguir torneo». Se guarda en este navegador y, con sesión, en `favorites`
 * con kind='tournament' (igual que la app). Hasta que se aplique la migración
 * 20261004_favorites_kind_tournament el servidor lo rechaza: se captura y el
 * torneo sigue guardado en el navegador, sin romper nada.
 */
export function FollowButton({
  tournamentId,
  label,
  meta,
  userId,
}: {
  tournamentId: string;
  label: string;
  meta: string | null;
  userId: string | null;
}) {
  const [on, setOn] = useState(false);
  const reduce = useReducedMotion();
  const bump = useRef(0);
  useEffect(() => {
    setOn(readLocal().includes(tournamentId));
    if (!userId) return;
    let alive = true;
    supabaseBrowser()
      .from("favorites")
      .select("ref_id")
      .eq("kind", "tournament")
      .eq("ref_id", tournamentId)
      .then(({ data, error }) => {
        if (alive && !error && (data ?? []).length) setOn(true);
      });
    return () => {
      alive = false;
    };
  }, [tournamentId, userId]);

  async function toggle() {
    const next = !on;
    setOn(next);
    bump.current++;
    const local = readLocal().filter((x) => x !== tournamentId);
    writeLocal(next ? [tournamentId, ...local] : local);
    if (!userId) return;
    await guardedWrite(next ? "seguir el torneo" : "dejar de seguir el torneo", async () => {
      const sb = supabaseBrowser();
      const { error } = next
        ? await sb
            .from("favorites")
            .upsert(
              { user_id: userId, kind: "tournament", ref_id: tournamentId, label, meta },
              { onConflict: "user_id,kind,ref_id" },
            )
        : await sb
            .from("favorites")
            .delete()
            .eq("user_id", userId)
            .eq("kind", "tournament")
            .eq("ref_id", tournamentId);
      // Sin la migración el check rechaza el tipo: se queda en el navegador.
      if (error) return false;
      return true;
    }).catch(() => null);
  }

  return (
    <Btn
      variant="quiet"
      aria-pressed={on}
      onClick={() => void toggle()}
      icon={
        <motion.span
          key={bump.current}
          style={{ display: "inline-flex", color: on ? "var(--accent)" : undefined }}
          initial={reduce || !on ? false : { scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 12 }}
        >
          {on ? <IconCheck size={15} /> : <IconBell size={15} />}
        </motion.span>
      }
    >
      {on ? "Siguiendo" : "Seguir torneo"}
    </Btn>
  );
}

/* ── Datos en vivo (sin Realtime) ───────────────────────────────────── */

/**
 * Recarga partidos e inscripciones cada 60 s mientras la pestaña está abierta,
 * SIN volver al esqueleto (la carga principal sí lo haría). Marca los partidos
 * cuyo resultado acaba de llegar para iluminarlos 2 s.
 */
export function useLivePolling<M extends PMatch, R>(
  id: string,
  enabled: boolean,
  base: { matches: M[]; regs: R[] } | null,
): { matches: M[] | null; regs: R[] | null; updatedAt: number | null; fresh: Set<string> } {
  const [live, setLive] = useState<{ matches: M[]; regs: R[]; at: number } | null>(null);
  const [baseAt, setBaseAt] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const prev = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    setLive(null);
    if (base) {
      prev.current = new Map(base.matches.map((m) => [m.id, m.status]));
      setBaseAt(Date.now());
    }
  }, [base]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const [mm, rr] = await Promise.all([fetchTournamentMatches(id), fetchTournamentRegs(id)]);
        if (!alive) return;
        const matches = mm as unknown as M[];
        const before = prev.current;
        if (before) {
          const newly = matches
            .filter((m) => m.status === "finished" && before.get(m.id) !== "finished")
            .map((m) => m.id);
          if (newly.length) {
            setFresh(new Set(newly));
            setTimeout(() => alive && setFresh(new Set()), 2200);
          }
        }
        prev.current = new Map(matches.map((m) => [m.id, m.status]));
        setLive({ matches, regs: rr as unknown as R[], at: Date.now() });
      } catch {
        /* se reintenta en el siguiente minuto */
      }
    };
    const h = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, [id, enabled]);

  return {
    matches: live?.matches ?? null,
    regs: live?.regs ?? null,
    updatedAt: live?.at ?? baseAt,
    fresh,
  };
}

/** Estado de cobro de MIS inscripciones (la RLS solo devuelve las propias). */
export function useMyPayments(id: string, userId: string | null) {
  const [map, setMap] = useState<Record<string, { status: string | null; method: string | null }>>({});
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchRegsPayments(id)
      .then((m) => {
        if (!alive) return;
        const out: Record<string, { status: string | null; method: string | null }> = {};
        for (const [k, v] of Object.entries(m)) out[k] = { status: v.paymentStatus, method: v.paymentMethod };
        setMap(out);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, userId]);
  return map;
}

/** ¿Cobra el torneo online? Para decir «se paga al apuntarte» o «en el club». */
export function useSignupOnline(id: string, enabled: boolean): boolean | null {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch(`/api/tournaments/${id}/signup-connect`)
      .then((r) => r.json())
      .then((d: { online?: boolean }) => alive && setV(!!d.online))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, enabled]);
  return v;
}

/** Campeones de una división: final del cuadro principal y de la consolación. */
export function championsOf(
  matches: PMatch[],
  gender: string | null,
  category: string | null,
): { winner: string; runner: string | null; score: string | null; consol: string | null } | null {
  const inDiv = matches.filter((m) => m.gender === gender && m.category === category);
  const finalOf = (b: string) => {
    const ko = inDiv.filter((m) => m.bracket === b);
    const tr = ko.reduce((mx, x) => Math.max(mx, x.round), 0);
    return ko.find((m) => m.round === tr && m.slot === 0 && m.status === "finished" && !!m.winner_reg) ?? null;
  };
  const mainB = inDiv.some((m) => m.bracket === "main") ? "main" : "gold";
  const final = finalOf(mainB);
  if (!final?.winner_reg) return null;
  const homeWon = final.winner_reg === final.home_reg;
  return {
    winner: final.winner_reg,
    runner: (homeWon ? final.away_reg : final.home_reg) ?? null,
    score: scoreFor(final, homeWon),
    consol: finalOf("consol")?.winner_reg ?? null,
  };
}
