"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { getCourtsForCompetition, type TeamGender } from "@/lib/courts";
import { Reveal } from "@/app/app/ui/Reveal";

// ── Modelo local ──────────────────────────────────────────────────────────
// `us`/`them` en BD son SIEMPRE nuestro equipo / rival (no Local/Visit.).
// Para mostrarlo como marcador físico Local-Visitante mapeamos según is_home.
const SETS = 3;

interface SetCell {
  us: string;
  them: string;
}
interface Match {
  sets: SetCell[];
  forfeit: boolean;
  // Dirección del W.O.: true = no nos presentamos (derrota); false = no se
  // presentó el rival (victoria). Solo relevante si forfeit=true.
  forfeitUs: boolean;
}

interface MatchResultRow {
  court_number: number;
  set_number: number;
  us: number | null;
  them: number | null;
  forfeit: boolean;
  forfeit_us: boolean;
}

interface PairRow {
  court_number: number;
  player_a_id: string | null;
  player_b_id: string | null;
}

interface MatchdayRow {
  id: string;
  jornada_number: number | null;
  match_date: string | null;
  match_time: string | null;
  opponent: string | null;
  is_home: boolean | null;
  status: "upcoming" | "in_progress" | "finished" | null;
  score_for: number | null;
  score_against: number | null;
  season_id: string;
}

const buildEmptyMatches = (courts: number): Match[] =>
  Array.from({ length: courts }, () => ({
    sets: Array.from({ length: SETS }, () => ({ us: "", them: "" })),
    forfeit: false,
    forfeitUs: false,
  }));

// Resultado de una pista (best-of-3): gana quien suma 2 sets. El W.O. da el
// punto directamente según su dirección. MISMA lógica que la app móvil.
const matchOutcome = (m: Match): "won" | "lost" | null => {
  if (m.forfeit) return m.forfeitUs ? "lost" : "won";
  let usWon = 0;
  let themWon = 0;
  m.sets.forEach((s) => {
    if (s.us === "" || s.them === "") return;
    const a = Number(s.us);
    const b = Number(s.them);
    if (a > b) usWon++;
    else if (b > a) themWon++;
  });
  if (usWon >= 2) return "won";
  if (themWon >= 2) return "lost";
  return null;
};

const fmtSetScore = (
  us: number | null,
  them: number | null,
  isHome: boolean,
  placeholder = "·",
): string => {
  const usStr = us !== null ? String(us) : placeholder;
  const themStr = them !== null ? String(them) : placeholder;
  return isHome ? `${usStr}-${themStr}` : `${themStr}-${usStr}`;
};

// El partido ha empezado si ya pasó la fecha/hora programada. Sin fecha →
// no se permite introducir resultados (igual que en móvil).
const isMatchStarted = (date: string | null, time: string | null): boolean => {
  if (!date) return false;
  const t = time ?? "00:00:00";
  const dt = new Date(`${date}T${t}`);
  if (Number.isNaN(dt.getTime())) return false;
  return Date.now() >= dt.getTime();
};

const fmtDate = (d: string | null) => {
  if (!d) return "Sin fecha";
  const [, m, day] = d.split("-");
  return day && m ? `${day}/${m}` : d;
};

export default function ResultsPage() {
  const params = useParams<{ id: string; mid: string }>();
  const { id: teamId, mid } = params;
  const session = useSession();

  const [matchday, setMatchday] = useState<MatchdayRow | null>(null);
  const [courts, setCourts] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [teamName, setTeamName] = useState("Equipo");
  const [isOwner, setIsOwner] = useState(false);
  const [seasonActive, setSeasonActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // savingCells/savedCells: feedback por celda (key `${court}-${setIdx}`).
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());
  const [savingForfeit, setSavingForfeit] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(0);

  const [closing, setClosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  // Cierre manual (retroactivo): el capitán fija el marcador agregado.
  const [manualFor, setManualFor] = useState("");
  const [manualAgainst, setManualAgainst] = useState("");

  // Espejo síncrono de matches para que los timers/persist lean el valor más
  // reciente (mismo motivo que en la app móvil).
  const matchesRef = useRef<Match[]>([]);
  matchesRef.current = matches;
  const persistTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const persistSeq = useRef<Map<string, number>>(new Map());

  const loadAll = useCallback(async () => {
    const sb = getSupabaseApp();
    setError(null);
    try {
      const md = await sb
        .from("matchdays")
        .select(
          "id, jornada_number, match_date, match_time, opponent, is_home, status, score_for, score_against, season_id",
        )
        .eq("id", mid)
        .single();
      if (md.error) throw md.error;
      const mdRow = md.data as MatchdayRow;
      setMatchday(mdRow);

      const season = await sb
        .from("seasons")
        .select("team_id, active")
        .eq("id", mdRow.season_id)
        .single();
      if (season.error) throw season.error;
      setSeasonActive(season.data.active !== false);

      const team = await sb
        .from("teams")
        .select("name, owner_id, federation, league, gender")
        .eq("id", season.data.team_id)
        .single();
      if (team.error) throw team.error;
      setTeamName((team.data.name as string | null) ?? "Equipo");
      setIsOwner(team.data.owner_id === session.user.id);

      const nCourts = getCourtsForCompetition(
        team.data.federation as string | null,
        team.data.league as string | null,
        team.data.gender as TeamGender | null,
      );
      setCourts(nCourts);

      // Parejas de la alineación activa (para etiquetar cada pista).
      const variant = await sb
        .from("lineup_variants")
        .select("id")
        .eq("matchday_id", mid)
        .eq("is_active", true)
        .maybeSingle();
      const variantId = (variant.data?.id as string | undefined) ?? null;

      const [resultsRes, lineupRes, playersRes] = await Promise.all([
        sb
          .from("match_results")
          .select("court_number, set_number, us, them, forfeit, forfeit_us")
          .eq("matchday_id", mid),
        variantId
          ? sb
              .from("lineups")
              .select("court_number, player_a_id, player_b_id")
              .eq("variant_id", variantId)
          : Promise.resolve({ data: [], error: null }),
        sb
          .from("players")
          .select("id, name, alias")
          .eq("team_id", teamId),
      ]);
      if (resultsRes.error) throw resultsRes.error;

      const playerName = new Map<string, string>();
      ((playersRes.data ?? []) as { id: string; name: string; alias: string | null }[]).forEach(
        (p) => {
          const dn = p.alias && p.alias.trim() ? p.alias.trim() : p.name;
          playerName.set(p.id, dn);
        },
      );
      const labelMap: Record<number, string> = {};
      ((lineupRes.data ?? []) as PairRow[]).forEach((p) => {
        const a = p.player_a_id ? playerName.get(p.player_a_id) ?? "—" : "—";
        const b = p.player_b_id ? playerName.get(p.player_b_id) ?? "—" : "—";
        labelMap[p.court_number] = `${a} / ${b}`;
      });
      setLabels(labelMap);

      const next = buildEmptyMatches(nCourts);
      ((resultsRes.data ?? []) as MatchResultRow[]).forEach((r) => {
        const ci = r.court_number - 1;
        const si = r.set_number - 1;
        if (ci < 0 || ci >= nCourts || si < 0 || si >= SETS) return;
        if (r.forfeit) {
          next[ci].forfeit = true;
          next[ci].forfeitUs = r.forfeit_us;
        }
        next[ci].sets[si] = {
          us: r.us !== null ? String(r.us) : "",
          them: r.them !== null ? String(r.them) : "",
        };
      });
      matchesRef.current = next;
      setMatches(next);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [mid, teamId, session.user.id]);

  useEffect(() => {
    if (!teamId || !mid) return;
    setLoading(true);
    loadAll();
  }, [teamId, mid, loadAll]);

  const closed = matchday?.status === "finished";
  const started = matchday
    ? isMatchStarted(matchday.match_date, matchday.match_time)
    : false;
  const canEdit = started && !closed && isOwner && seasonActive;
  const isHome = matchday?.is_home ?? true;

  // ── Score agregado (best-of-3 por pista) ──
  let scoreUs = 0;
  let scoreThem = 0;
  let played = 0;
  matches.forEach((m) => {
    const o = matchOutcome(m);
    if (o === "won") {
      scoreUs++;
      played++;
    } else if (o === "lost") {
      scoreThem++;
      played++;
    }
  });
  const anyFilled = played > 0;

  // ── Persistencia por celda (debounce 600ms + flush en blur) ──
  const doPersistCell = useCallback(
    async (court: number, setIdx: number) => {
      const key = `${court}-${setIdx}`;
      const seq = (persistSeq.current.get(key) ?? 0) + 1;
      persistSeq.current.set(key, seq);
      const cell = matchesRef.current[court].sets[setIdx];
      const us = cell.us !== "" ? Number(cell.us) : null;
      const them = cell.them !== "" ? Number(cell.them) : null;
      setSavingCells((s) => new Set(s).add(key));
      try {
        const { error: e } = await getSupabaseApp()
          .from("match_results")
          .upsert(
            {
              matchday_id: mid,
              court_number: court + 1,
              set_number: setIdx + 1,
              us,
              them,
              forfeit: false,
            },
            { onConflict: "matchday_id,court_number,set_number" },
          );
        if (e) throw e;
        if (persistSeq.current.get(key) !== seq) return;
        setSavedCells((s) => new Set(s).add(key));
        setTimeout(() => {
          setSavedCells((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
          });
        }, 1200);
      } catch (err) {
        if (persistSeq.current.get(key) === seq)
          setError((err as { message?: string })?.message ?? "No se pudo guardar.");
      } finally {
        if (persistSeq.current.get(key) === seq)
          setSavingCells((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
          });
      }
    },
    [mid],
  );

  const persistDebounced = (court: number, setIdx: number) => {
    if (!canEdit) return;
    const key = `${court}-${setIdx}`;
    const existing = persistTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      persistTimers.current.delete(key);
      doPersistCell(court, setIdx);
    }, 600);
    persistTimers.current.set(key, t);
  };
  const flushCell = (court: number, setIdx: number) => {
    const key = `${court}-${setIdx}`;
    const t = persistTimers.current.get(key);
    if (t) {
      clearTimeout(t);
      persistTimers.current.delete(key);
      doPersistCell(court, setIdx);
    }
  };
  // Flush de pendientes al desmontar (evita perder ediciones <600ms).
  useEffect(() => {
    const timers = persistTimers.current;
    return () => {
      timers.forEach((t, key) => {
        clearTimeout(t);
        const [c, s] = key.split("-").map(Number);
        doPersistCell(c, s);
      });
      timers.clear();
    };
  }, [doPersistCell]);

  const updateCell = (
    court: number,
    setIdx: number,
    side: "us" | "them",
    raw: string,
  ) => {
    if (!canEdit) return;
    // Set 3 = super-tiebreak (hasta 15); sets 1-2 hasta 7.
    const maxForSet = setIdx === 2 ? 15 : 7;
    const digits = raw.replace(/[^0-9]/g, "");
    const value = digits === "" ? "" : String(Math.min(Number(digits), maxForSet));
    const next = matchesRef.current.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            sets: m.sets.map((s, j) =>
              j !== setIdx ? s : { ...s, [side]: value },
            ),
          },
    );
    matchesRef.current = next;
    setMatches(next);
    persistDebounced(court, setIdx);
  };

  // W.O.: inserta los 3 sets con forfeit=true / us=them=null. Al desactivar,
  // borra las filas de la pista. forfeitUs define el sentido del punto.
  const writeForfeit = async (
    court: number,
    forfeit: boolean,
    forfeitUs: boolean,
  ) => {
    const sb = getSupabaseApp();
    if (forfeit) {
      const rows = Array.from({ length: SETS }, (_, i) => ({
        matchday_id: mid,
        court_number: court + 1,
        set_number: i + 1,
        us: null,
        them: null,
        forfeit: true,
        forfeit_us: forfeitUs,
      }));
      const { error: e } = await sb
        .from("match_results")
        .upsert(rows, { onConflict: "matchday_id,court_number,set_number" });
      if (e) throw e;
    } else {
      const { error: e } = await sb
        .from("match_results")
        .delete()
        .eq("matchday_id", mid)
        .eq("court_number", court + 1);
      if (e) throw e;
    }
  };

  const toggleForfeit = async (court: number) => {
    if (!canEdit) return;
    const cur = matchesRef.current[court];
    const next = !cur.forfeit;
    const forfeitUs = next ? cur.forfeitUs : false;
    const nextMatches = matchesRef.current.map((m, i) =>
      i !== court
        ? m
        : {
            ...m,
            forfeit: next,
            forfeitUs,
            sets: next ? m.sets.map(() => ({ us: "", them: "" })) : m.sets,
          },
    );
    matchesRef.current = nextMatches;
    setMatches(nextMatches);
    setSavingForfeit(court);
    try {
      await writeForfeit(court, next, forfeitUs);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo guardar.");
      const rollback = matchesRef.current.map((m, i) =>
        i !== court ? m : { ...m, forfeit: !next },
      );
      matchesRef.current = rollback;
      setMatches(rollback);
    } finally {
      setSavingForfeit(null);
    }
  };

  const setForfeitDirection = async (court: number, forfeitUs: boolean) => {
    if (!canEdit) return;
    const cur = matchesRef.current[court];
    if (!cur.forfeit || cur.forfeitUs === forfeitUs) return;
    const nextMatches = matchesRef.current.map((m, i) =>
      i !== court ? m : { ...m, forfeitUs },
    );
    matchesRef.current = nextMatches;
    setMatches(nextMatches);
    setSavingForfeit(court);
    try {
      await writeForfeit(court, true, forfeitUs);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo guardar.");
      const rollback = matchesRef.current.map((m, i) =>
        i !== court ? m : { ...m, forfeitUs: cur.forfeitUs },
      );
      matchesRef.current = rollback;
      setMatches(rollback);
    } finally {
      setSavingForfeit(null);
    }
  };

  // ── Cierre del acta ──
  // Si todas las pistas tienen resultado → close_matchday (la RPC calcula el
  // outcome y el agregado respetando las reglas). Si faltan → cierre manual
  // con marcador agregado (force close, suma === courts).
  const allFilled = courts > 0 && played === courts;
  const manualForN = manualFor.trim() === "" ? null : Number(manualFor);
  const manualAgN = manualAgainst.trim() === "" ? null : Number(manualAgainst);
  const manualReady =
    manualForN !== null &&
    manualAgN !== null &&
    manualForN >= 0 &&
    manualForN <= courts &&
    manualAgN >= 0 &&
    manualAgN <= courts &&
    manualForN + manualAgN === courts;

  const clampScore = (raw: string): string => {
    const d = raw.replace(/[^0-9]/g, "").slice(0, 2);
    if (d === "") return "";
    return String(Math.min(Number(d), courts));
  };

  const closeViaRpc = async () => {
    if (!matchday || closing) return;
    setClosing(true);
    setError(null);
    try {
      // Flush de cualquier celda pendiente antes de cerrar.
      persistTimers.current.forEach((t, key) => {
        clearTimeout(t);
        const [c, s] = key.split("-").map(Number);
        doPersistCell(c, s);
      });
      persistTimers.current.clear();
      const { data, error: e } = await getSupabaseApp().rpc("close_matchday", {
        target_matchday: matchday.id,
      });
      if (e) throw e;
      setMatchday(data as MatchdayRow);
      setCloseOpen(false);
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo cerrar el acta.");
    } finally {
      setClosing(false);
    }
  };

  const closeManual = async (outcome: "win" | "draw" | "loss") => {
    if (!matchday || !manualReady || closing) return;
    setClosing(true);
    setError(null);
    try {
      const { data, error: e } = await getSupabaseApp()
        .from("matchdays")
        .update({
          outcome,
          status: "finished",
          score_for: Number(manualFor),
          score_against: Number(manualAgainst),
        })
        .eq("id", matchday.id)
        .select(
          "id, jornada_number, match_date, match_time, opponent, is_home, status, score_for, score_against, season_id",
        )
        .single();
      if (e) throw e;
      setMatchday(data as MatchdayRow);
      setCloseOpen(false);
      setManualFor("");
      setManualAgainst("");
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo cerrar el acta.");
    } finally {
      setClosing(false);
    }
  };

  const opponentName = matchday?.opponent ?? "Rival";
  const homeName = isHome ? teamName : opponentName;
  const awayName = isHome ? opponentName : teamName;

  // ── Render ──
  return (
    <div>
      <Reveal>
        <Link
          href={`/app/team/${teamId}/matchday/${mid}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
        >
          <span>←</span> JORNADA
        </Link>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* HERO */}
      <Reveal delay={40} className="mb-6 block">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          JORNADA{" "}
          {matchday?.jornada_number != null
            ? String(matchday.jornada_number).padStart(2, "0")
            : "—"}{" "}
          · RESULTADO
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {loading
            ? "…"
            : closed
              ? "Acta cerrada"
              : !started
                ? "Aún no disponible"
                : "Añade los marcadores"}
        </h1>
        {matchday && (
          <p className="text-[13px] text-[var(--color-text-muted)] mt-2 max-w-lg">
            {closed
              ? "No se pueden modificar los resultados."
              : !started
                ? `Podrás introducir resultados a partir de ${fmtDate(matchday.match_date)}${matchday.match_time ? ` · ${matchday.match_time.slice(0, 5)}` : ""}.`
                : !isOwner
                  ? "Solo el capitán del equipo puede introducir resultados."
                  : !seasonActive
                    ? "Temporada archivada — solo lectura."
                    : "Toca cada pareja para introducir los sets. Se guarda automáticamente."}
          </p>
        )}
      </Reveal>

      {/* SCORE AGREGADO */}
      <Reveal
        delay={80}
        className="relative overflow-hidden rounded-2xl border border-[var(--color-hair-strong)] bg-gradient-to-br from-[var(--color-bg-card)] to-[var(--color-bg-card-2)] px-5 py-5 flex items-center justify-between gap-3 mb-5"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--color-text-faint)] uppercase truncate">
            {teamName}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {isHome ? "Local" : "Visitante"}
          </p>
        </div>
        <div className="flex items-center gap-4 px-2 shrink-0">
          <span
            className="font-mono text-[34px] font-bold leading-none tracking-tight"
            style={{
              color: anyFilled
                ? "var(--color-accent)"
                : "var(--color-text-faint)",
            }}
          >
            {anyFilled ? scoreUs : "—"}
          </span>
          <span className="w-px h-7 bg-[var(--color-hair-strong)]" />
          <span
            className="font-mono text-[34px] font-bold leading-none tracking-tight"
            style={{
              color: anyFilled ? "var(--color-text)" : "var(--color-text-faint)",
            }}
          >
            {anyFilled ? scoreThem : "—"}
          </span>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--color-text-faint)] uppercase truncate">
            {opponentName}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {isHome ? "Visitante" : "Local"}
          </p>
        </div>
      </Reveal>

      {/* LISTA DE PISTAS */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((m, ci) => (
            <Reveal key={ci} delay={120 + Math.min(ci, 3) * 40}>
            <ResultRow
              court={ci}
              match={m}
              label={labels[ci + 1] ?? "Sin alineación"}
              expanded={expanded === ci}
              canEdit={canEdit}
              outcome={matchOutcome(m)}
              isHome={isHome}
              homeName={homeName}
              awayName={awayName}
              savingCells={savingCells}
              savedCells={savedCells}
              savingForfeit={savingForfeit === ci}
              onToggleExpand={() => setExpanded((e) => (e === ci ? -1 : ci))}
              onUpdateCell={(setIdx, side, value) =>
                updateCell(ci, setIdx, side, value)
              }
              onBlurCell={(setIdx) => flushCell(ci, setIdx)}
              onToggleForfeit={() => toggleForfeit(ci)}
              onSetForfeitDirection={(fu) => setForfeitDirection(ci, fu)}
            />
            </Reveal>
          ))}
        </div>
      )}

      {/* CERRAR ACTA */}
      {!loading && matchday && isOwner && !closed && started && seasonActive && (
        <Reveal delay={120} className="mt-6 block">
          {!closeOpen ? (
            <button
              onClick={() => setCloseOpen(true)}
              className="w-full h-13 py-3.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-bold text-[15px] shadow-[0_10px_30px_-12px_var(--color-accent-40)] transition hover:opacity-90"
            >
              Cerrar acta
            </button>
          ) : (
            <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)] mb-1.5">
                CERRAR ACTA
              </p>
              {allFilled ? (
                <>
                  <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
                    Resultado final {scoreUs}–{scoreThem}. Una vez cerrada no
                    podrás editar la alineación ni los resultados.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCloseOpen(false)}
                      disabled={closing}
                      className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] text-[14px] font-semibold transition hover:text-[var(--color-text)] disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={closeViaRpc}
                      disabled={closing}
                      className="flex-[1.4] h-11 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[14px] font-bold transition hover:opacity-90 disabled:opacity-40"
                    >
                      {closing ? "Cerrando…" : "Confirmar cierre"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
                    Faltan resultados por pista. Introduce el marcador final
                    agregado (la suma debe ser {courts}).
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--color-text-faint)] uppercase">
                        Nosotros
                      </span>
                      <input
                        inputMode="numeric"
                        value={manualFor}
                        onChange={(e) => setManualFor(clampScore(e.target.value))}
                        placeholder="·"
                        className="w-16 h-12 rounded-xl bg-[var(--color-bg-raised)] border border-[var(--color-hair)] text-center font-mono text-[20px] font-semibold text-[var(--color-accent)] outline-none focus:border-[var(--color-accent-40)]"
                      />
                    </div>
                    <span className="font-mono text-[18px] text-[var(--color-text-faint)] mt-4">
                      ·
                    </span>
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--color-text-faint)] uppercase">
                        Rival
                      </span>
                      <input
                        inputMode="numeric"
                        value={manualAgainst}
                        onChange={(e) =>
                          setManualAgainst(clampScore(e.target.value))
                        }
                        placeholder="·"
                        className="w-16 h-12 rounded-xl bg-[var(--color-bg-raised)] border border-[var(--color-hair)] text-center font-mono text-[20px] font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-accent-40)]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => closeManual("win")}
                      disabled={!manualReady || closing}
                      className="flex-1 h-11 rounded-xl border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] text-[var(--color-accent)] text-[13px] font-bold transition hover:bg-[var(--color-accent-25)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Victoria
                    </button>
                    <button
                      onClick={() => closeManual("draw")}
                      disabled={!manualReady || closing}
                      className="flex-1 h-11 rounded-xl border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] text-[13px] font-bold transition hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Empate
                    </button>
                    <button
                      onClick={() => closeManual("loss")}
                      disabled={!manualReady || closing}
                      className="flex-1 h-11 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)] text-[13px] font-bold transition hover:bg-[var(--color-error)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Derrota
                    </button>
                  </div>
                  <button
                    onClick={() => setCloseOpen(false)}
                    disabled={closing}
                    className="w-full h-9 text-[12px] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] transition disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          )}
        </Reveal>
      )}

      {/* Resultado final cuando ya está cerrada */}
      {!loading && closed && matchday && (
        <Reveal delay={120} className="mt-6 block rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-5 py-4 text-center">
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-faint)] mb-1">
            ACTA CERRADA
          </p>
          <p className="text-[15px] text-[var(--color-text-muted)]">
            {matchday.score_for != null && matchday.score_against != null
              ? `Resultado final ${matchday.score_for}–${matchday.score_against}`
              : "Resultado registrado."}
          </p>
        </Reveal>
      )}
    </div>
  );
}

// ─── ResultRow ──────────────────────────────────────────────────────────────
function ResultRow({
  court,
  match,
  label,
  expanded,
  canEdit,
  outcome,
  isHome,
  homeName,
  awayName,
  savingCells,
  savedCells,
  savingForfeit,
  onToggleExpand,
  onUpdateCell,
  onBlurCell,
  onToggleForfeit,
  onSetForfeitDirection,
}: {
  court: number;
  match: Match;
  label: string;
  expanded: boolean;
  canEdit: boolean;
  outcome: "won" | "lost" | null;
  isHome: boolean;
  homeName: string;
  awayName: string;
  savingCells: Set<string>;
  savedCells: Set<string>;
  savingForfeit: boolean;
  onToggleExpand: () => void;
  onUpdateCell: (setIdx: number, side: "us" | "them", value: string) => void;
  onBlurCell: (setIdx: number) => void;
  onToggleForfeit: () => void;
  onSetForfeitDirection: (forfeitUs: boolean) => void;
}) {
  const tintCls =
    outcome === "won"
      ? "text-[var(--color-accent)] border-[var(--color-accent-40)] bg-[var(--color-accent-10)]"
      : outcome === "lost"
        ? "text-[var(--color-error)] border-[var(--color-error)]/40 bg-[var(--color-error)]/10"
        : "text-[var(--color-text-faint)] border-[var(--color-hair-strong)]";

  const setSummary = match.sets
    .filter((s) => s.us !== "" || s.them !== "")
    .map((s) =>
      fmtSetScore(
        s.us !== "" ? Number(s.us) : null,
        s.them !== "" ? Number(s.them) : null,
        isHome,
      ),
    )
    .join("  ");
  const summaryText = match.forfeit
    ? match.forfeitUs
      ? "W.O. en contra"
      : "W.O. a favor"
    : setSummary || "Sin resultado";

  return (
    <div
      className={`rounded-xl border bg-[var(--color-bg-card)] overflow-hidden transition ${
        expanded
          ? "border-[var(--color-accent-40)]"
          : "border-[var(--color-hair-strong)] hover:border-[var(--color-accent-40)]"
      }`}
    >
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--color-bg-card-2)]"
      >
        <span
          className={`grid place-items-center w-9 h-9 rounded-lg font-mono text-[12px] font-semibold shrink-0 ${
            court === 0
              ? "bg-[var(--color-accent-10)] text-[var(--color-accent)]"
              : "bg-[var(--color-bg-raised)] text-[var(--color-text)]"
          }`}
        >
          P{court + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold tracking-tight truncate">
            {label}
          </span>
          <span className="block font-mono text-[11px] text-[var(--color-text-faint)] mt-0.5 tracking-wide">
            {summaryText}
          </span>
        </span>
        <span
          className={`shrink-0 font-mono text-[11px] font-semibold border rounded-lg px-2 py-1 min-w-[30px] text-center ${tintCls}`}
        >
          {outcome === "won" ? "V" : outcome === "lost" ? "D" : "—"}
        </span>
        <span
          className={`shrink-0 text-[var(--color-text-faint)] transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--color-hair)]">
          {/* W.O. toggle */}
          <button
            onClick={onToggleForfeit}
            disabled={!canEdit || savingForfeit}
            className="flex items-center gap-2.5 py-3 w-full disabled:opacity-40"
          >
            <span
              className={`relative w-8 h-[18px] rounded-full transition ${
                match.forfeit
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-hair-strong)]"
              }`}
            >
              <span
                className="absolute top-[3px] w-3 h-3 rounded-full bg-white transition-all"
                style={{ left: match.forfeit ? 17 : 3 }}
              />
            </span>
            <span
              className={`flex-1 text-left text-[12px] font-medium ${
                match.forfeit
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              W.O. (no presentado)
            </span>
            {savingForfeit && (
              <span className="font-mono text-[10px] text-[var(--color-accent)]">
                …
              </span>
            )}
          </button>

          {match.forfeit ? (
            <div className="flex gap-2 pb-3">
              <button
                disabled={!canEdit || savingForfeit}
                onClick={() => onSetForfeitDirection(false)}
                className={`flex-1 h-11 rounded-lg border text-[12px] font-semibold transition disabled:opacity-40 ${
                  !match.forfeitUs
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-10)] text-[var(--color-accent)]"
                    : "border-[var(--color-hair-strong)] text-[var(--color-text-muted)]"
                }`}
              >
                Ganado · no vino el rival
              </button>
              <button
                disabled={!canEdit || savingForfeit}
                onClick={() => onSetForfeitDirection(true)}
                className={`flex-1 h-11 rounded-lg border text-[12px] font-semibold transition disabled:opacity-40 ${
                  match.forfeitUs
                    ? "border-[var(--color-error)] bg-[var(--color-error)]/10 text-[var(--color-error)]"
                    : "border-[var(--color-hair-strong)] text-[var(--color-text-muted)]"
                }`}
              >
                Perdido · no vinimos
              </button>
            </div>
          ) : (
            <>
              {/* Cabecera Local / Visitante */}
              <div className="flex gap-3 px-1 mb-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--color-text-faint)]">
                    LOCAL
                  </p>
                  <p
                    className={`text-[13px] font-semibold tracking-tight truncate mt-0.5 ${isHome ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}
                  >
                    {homeName}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--color-text-faint)]">
                    VISITANTE
                  </p>
                  <p
                    className={`text-[13px] font-semibold tracking-tight truncate mt-0.5 ${!isHome ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}
                  >
                    {awayName}
                  </p>
                </div>
              </div>

              {match.sets.map((cell, i) => (
                <SetLine
                  key={i}
                  setIdx={i}
                  cell={cell}
                  isHome={isHome}
                  disabled={!canEdit}
                  saving={savingCells.has(`${court}-${i}`)}
                  saved={savedCells.has(`${court}-${i}`)}
                  onChange={(side, value) => onUpdateCell(i, side, value)}
                  onBlur={() => onBlurCell(i)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SetLine ──────────────────────────────────────────────────────────────
function SetLine({
  setIdx,
  cell,
  isHome,
  disabled,
  saving,
  saved,
  onChange,
  onBlur,
}: {
  setIdx: number;
  cell: SetCell;
  isHome: boolean;
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onChange: (side: "us" | "them", value: string) => void;
  onBlur: () => void;
}) {
  const leftSide: "us" | "them" = isHome ? "us" : "them";
  const rightSide: "us" | "them" = isHome ? "them" : "us";

  return (
    <div className="flex items-center gap-3 mb-1.5">
      <span className="w-16 font-mono text-[11px] tracking-wide font-medium text-[var(--color-text-muted)] shrink-0">
        SET {setIdx + 1}
        {setIdx === 2 ? " · OPC." : ""}
      </span>
      <div className="flex-1 flex items-center gap-2.5">
        <ScoreCell
          value={cell[leftSide]}
          accent={leftSide === "us"}
          disabled={disabled}
          saving={saving}
          saved={saved}
          onChange={(v) => onChange(leftSide, v)}
          onBlur={onBlur}
        />
        <span className="font-mono text-[16px] text-[var(--color-text-faint)]">
          ·
        </span>
        <ScoreCell
          value={cell[rightSide]}
          accent={rightSide === "us"}
          disabled={disabled}
          saving={saving}
          saved={saved}
          onChange={(v) => onChange(rightSide, v)}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
}

// ─── ScoreCell ──────────────────────────────────────────────────────────────
function ScoreCell({
  value,
  accent,
  disabled,
  saving,
  saved,
  onChange,
  onBlur,
}: {
  value: string;
  accent: boolean;
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        inputMode="numeric"
        maxLength={2}
        disabled={disabled}
        placeholder="·"
        className={`w-full h-11 rounded-lg bg-[var(--color-bg-raised)] border border-[var(--color-hair)] text-center font-mono text-[17px] font-semibold outline-none transition focus:border-[var(--color-accent-40)] disabled:opacity-50 ${
          accent && value ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        }`}
      />
      {(saving || saved) && (
        <span
          className={`absolute right-1.5 top-1 font-mono text-[10px] ${saving ? "text-[var(--color-text-faint)]" : "text-[var(--color-accent)]"}`}
        >
          {saving ? "…" : "✓"}
        </span>
      )}
    </div>
  );
}
