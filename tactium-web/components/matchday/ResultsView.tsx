"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchMatchdayBundle,
  setCourtForfeit,
  upsertSetResult,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite, WRITES_ENABLED } from "@/lib/writes";
import { Btn, BtnLink, Card, Modal, Note } from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconCheck, IconLock } from "@/components/Icon";

import { SetsEditor, SetsTable, type SetScore } from "./GamesPicker";
import { MatchRow, MatchScoreboard } from "./MatchScoreboard";

/**
 * Resultados (rediseño bloque «Partido», 2026-10; espejo de
 * TACTIUM/src/features/home/screens/ResultsScreen.tsx).
 *
 * El marcador de la Jornada arriba; primero TU partido y luego el resto. Cada
 * pista se apunta con la botonera de juegos y se GUARDA SOLA por set
 * («Guardado ✓»); «Listo» solo cierra. El W.O. va por «Otro resultado».
 * Apuntan el capitán y los jugadores con ficha vinculada; cerrar el acta
 * sigue siendo del capitán, en la Jornada.
 */

interface Court {
  court: number;
  pair: [DbPlayer | null, DbPlayer | null];
  mine: boolean;
  forfeit: boolean;
  forfeitUs: boolean;
  sets: SetScore[];
}

type WoChoice = "favor" | "contra" | "played";

const empty3 = (): SetScore[] => [
  { us: null, them: null },
  { us: null, them: null },
  { us: null, them: null },
];

function outcome(c: Court): "won" | "lost" | null {
  if (c.forfeit) return c.forfeitUs ? "lost" : "won";
  let u = 0;
  let t = 0;
  for (const s of c.sets) {
    if (s.us === null || s.them === null || s.us === s.them) continue;
    if (s.us > s.them) u++;
    else t++;
  }
  return u >= 2 ? "won" : t >= 2 ? "lost" : null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "el día del partido";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export function ResultsView({ id }: { id: string }) {
  const { activeTeam, user, role } = useSession();
  const teamId = activeTeam?.id ?? null;
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId, reloadKey],
    !!teamId,
  );

  const [courts, setCourts] = useState<Court[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [woMode, setWoMode] = useState(false);
  const [woChoice, setWoChoice] = useState<WoChoice>("favor");
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [savedAt, setSavedAt] = useState<Record<number, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const courtsRef = useRef<Court[]>([]);
  courtsRef.current = courts;

  useEffect(() => {
    if (!data) return;
    const byId = new Map(data.players.map((p) => [p.id, p]));
    const map = new Map<number, Court>();
    const ensure = (n: number) => {
      let c = map.get(n);
      if (!c) {
        c = { court: n, pair: [null, null], mine: false, forfeit: false, forfeitUs: false, sets: empty3() };
        map.set(n, c);
      }
      return c;
    };
    for (let n = 1; n <= Math.max(5, ...data.lineup.map((l) => l.court)); n++) ensure(n);
    for (const l of data.lineup) {
      const c = ensure(l.court);
      const a = l.playerA ? byId.get(l.playerA) ?? null : null;
      const b = l.playerB ? byId.get(l.playerB) ?? null : null;
      c.pair = [a, b];
      c.mine = [a, b].some((p) => p != null && !!user && p.userId === user.id);
    }
    for (const r of data.results) {
      const c = ensure(r.court);
      if (r.forfeit) {
        c.forfeit = true;
        c.forfeitUs = !!r.forfeitUs;
        continue;
      }
      const i = r.set - 1;
      if (i >= 0 && i < 3) c.sets[i] = { us: r.us, them: r.them };
    }
    setCourts([...map.values()].sort((a, b) => a.court - b.court));
  }, [data, user]);

  // Al salir, guarda lo pendiente.
  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const m = data?.matchday ?? null;
  const closed = m?.status === "finished";
  const started = useMemo(() => {
    if (!m?.date) return false;
    const t = new Date(`${m.date}T${m.time ?? "00:00:00"}`);
    return !Number.isNaN(t.getTime()) && Date.now() >= t.getTime();
  }, [m]);
  const myPlayer = data && user ? data.players.find((p) => p.userId === user.id) ?? null : null;
  const isCaptain = role === "capitan";
  const playerNoFicha = role === "jugador" && !myPlayer;
  const canEdit = !!m && started && !closed && (isCaptain || (role === "jugador" && !!myPlayer));

  const score = useMemo(() => {
    let us = 0;
    let them = 0;
    for (const c of courts) {
      const o = outcome(c);
      if (o === "won") us++;
      else if (o === "lost") them++;
    }
    return { us, them, played: us + them };
  }, [courts]);

  if (!teamId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconCalendar size={24} />} title="Sin equipo activo" body="Entra con una cuenta que pertenezca a un equipo." />
        </Card>
      </div>
    );
  }
  if (loading && !data) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconCalendar size={24} />} title="No se pudieron cargar los resultados" body={error} />
        </Card>
      </div>
    );
  }
  if (!data || !m) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconCalendar size={24} />} title="Sin jornada activa" body="Abre una jornada del calendario para empezar." />
        </Card>
      </div>
    );
  }

  const ourName = activeTeam?.name ?? "Nosotros";
  const labelOf = (c: Court) => {
    const [a, b] = c.pair;
    const nm = (p: DbPlayer | null) => (p ? (myPlayer && p.id === myPlayer.id ? "Tú" : p.name.split(" ")[0]) : "—");
    return a || b ? `${nm(a)} / ${nm(b)}` : "Sin alineación";
  };

  function persist(court: number, setIdx: number) {
    const key = `${court}-${setIdx}`;
    const prev = timers.current.get(key);
    if (prev) clearTimeout(prev);
    timers.current.set(
      key,
      setTimeout(async () => {
        timers.current.delete(key);
        const c = courtsRef.current.find((x) => x.court === court);
        if (!c) return;
        const s = c.sets[setIdx];
        setSaving((x) => new Set(x).add(court));
        const res = await guardedWrite("guardar el resultado", () =>
          upsertSetResult(id, court, setIdx + 1, s.us, s.them),
        );
        setSaving((x) => {
          const n = new Set(x);
          n.delete(court);
          return n;
        });
        if (res.ok) setSavedAt((x) => ({ ...x, [court]: Date.now() }));
        else setToast(res.reason);
      }, 450),
    );
  }

  function edit(court: number, setIdx: number, side: "us" | "them", v: number | null) {
    if (!canEdit) return;
    setCourts((cs) =>
      cs.map((c) =>
        c.court !== court ? c : { ...c, sets: c.sets.map((s, i) => (i === setIdx ? { ...s, [side]: v } : s)) },
      ),
    );
    persist(court, setIdx);
  }

  async function saveWo(c: Court) {
    if (woChoice === "played") {
      if (c.forfeit) {
        const res = await guardedWrite("quitar el W.O.", () => setCourtForfeit(id, c.court, false));
        if (!res.ok) setToast(res.reason);
        else setReloadKey((k) => k + 1);
      }
      setWoMode(false);
      return;
    }
    const hasSets = c.sets.some((s) => s.us !== null || s.them !== null);
    if (!c.forfeit && hasSets && !window.confirm("Esta pista tiene juegos apuntados. Al marcar W.O. se borran. ¿Seguir?")) {
      return;
    }
    const res = await guardedWrite("guardar el W.O.", () => setCourtForfeit(id, c.court, true, woChoice === "contra"));
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(woChoice === "favor" ? "W.O. a favor guardado" : "W.O. en contra guardado");
    } else setToast(res.reason);
    setWoMode(false);
  }

  const mine = !isCaptain ? courts.find((c) => c.mine) : undefined;
  const rest = courts.filter((c) => c !== mine);
  const sheet = open != null ? courts.find((c) => c.court === open) ?? null : null;

  const row = (c: Court) => {
    const o = outcome(c);
    const line = c.sets
      .filter((s) => s.us !== null || s.them !== null)
      .map((s) => `${s.us ?? "·"}-${s.them ?? "·"}`)
      .join(" ");
    const doneSets = c.sets.filter((s) => s.us !== null && s.them !== null && s.us !== s.them).length;
    const sub = c.forfeit
      ? c.forfeitUs
        ? "W.O. en contra"
        : "W.O. a favor"
      : o
        ? line
        : line
          ? `Set ${Math.min(doneSets + 1, 3)} en juego · ${line}`
          : "Sin empezar";
    return (
      <MatchRow
        key={c.court}
        badge={`P${c.court}`}
        title={labelOf(c)}
        sub={sub}
        me={c.mine && !isCaptain}
        right={o ? (o === "won" ? "Ganado" : "Perdido") : canEdit ? (line ? "Seguir ›" : "Apuntar ›") : "—"}
        tone={o === "won" ? "win" : o === "lost" ? "loss" : canEdit ? "todo" : "muted"}
        onClick={() => {
          setWoMode(false);
          setOpen(c.court);
        }}
      />
    );
  };

  const tone = closed ? (score.us > score.them ? "accent" : score.us < score.them ? "error" : "warning") : "text";

  return (
    <div className="tw-page-narrow">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <BtnLink href={`/jornada/${m.id}`} variant="quiet" size="sm">
          ‹ Jornada {m.round}
        </BtnLink>
        {closed ? (
          <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Acta cerrada</span>
        ) : started ? (
          <span style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 700 }}>● En directo</span>
        ) : null}
      </div>

      <MatchScoreboard
        eyebrow={`Jornada ${m.round} · ${formatDate(m.date)}${m.time ? ` · ${m.time.slice(0, 5)}` : ""} · ${m.isHome ? "local" : "visitante"}`}
        left={ourName}
        right={m.opponent}
        us={score.played || closed ? score.us : null}
        them={score.played || closed ? score.them : null}
        status={closed ? (score.us > score.them ? "Victoria" : score.us < score.them ? "Derrota" : "Empate") : `${score.played} de ${courts.length}`}
        tone={tone}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {!started && !closed && (
          <Note icon={<IconLock size={15} />}>
            Podrás apuntar a partir del {formatDate(m.date)}
            {m.time ? ` · ${m.time.slice(0, 5)}` : ""}.
          </Note>
        )}
        {started && !closed && playerNoFicha && (
          <Note icon={<IconLock size={15} />}>Vincula tu ficha para apuntar: pídele al capitán tu código de jugador.</Note>
        )}
        {canEdit && !WRITES_ENABLED && (
          <Note tone="warning" icon={<IconLock size={15} />}>
            Modo solo lectura: la web aún no escribe en la base de datos.
          </Note>
        )}

        {mine && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginTop: 4 }}>Tu partido</div>
            {row(mine)}
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginTop: 4 }}>Resto</div>
          </>
        )}
        {rest.map(row)}

        <p style={{ margin: "8px 0 0", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>
          {canEdit
            ? "Se guarda solo · cerrar el acta lo hace el capitán en la Jornada"
            : closed
              ? "Acta cerrada · solo lectura"
              : "Cerrar el acta lo hace el capitán en la Jornada"}
        </p>
      </div>

      <Modal
        open={!!sheet}
        onClose={() => setOpen(null)}
        labelledBy="pista-titulo"
        width={520}
        title={sheet ? (woMode ? `Pista ${sheet.court} · ¿No se jugó?` : `Pista ${sheet.court} · ${labelOf(sheet)}`) : ""}
        lede={
          sheet && saving.has(sheet.court)
            ? "Guardando…"
            : sheet && savedAt[sheet.court]
              ? "Guardado ✓"
              : woMode
                ? "El W.O. da la pista entera a quien sí se presentó."
                : undefined
        }
        footer={
          sheet && !woMode ? (
            <>
              {canEdit && (
                <Btn
                  variant="quiet"
                  onClick={() => {
                    setWoChoice(sheet.forfeit ? (sheet.forfeitUs ? "contra" : "favor") : "favor");
                    setWoMode(true);
                  }}
                >
                  Otro resultado (W.O.)
                </Btn>
              )}
              <Btn variant="accent" icon={<IconCheck size={15} />} onClick={() => setOpen(null)}>
                Listo
              </Btn>
            </>
          ) : sheet ? (
            <>
              <Btn onClick={() => setWoMode(false)}>Cancelar</Btn>
              <Btn variant="accent" onClick={() => void saveWo(sheet)}>
                {woChoice === "played" ? "Volver a los juegos" : woChoice === "favor" ? "Guardar W.O. a favor" : "Guardar W.O. en contra"}
              </Btn>
            </>
          ) : null
        }
      >
        {sheet &&
          (woMode ? (
            <div role="radiogroup" aria-label="Otro resultado" style={{ display: "grid", gap: 8 }}>
              {(
                [
                  { k: "favor", t: "W.O. a favor", s: `${m.opponent} no se presentó · la pista es nuestra` },
                  { k: "contra", t: "W.O. en contra", s: "No nos presentamos · la pista es suya" },
                  { k: "played", t: "Se jugó", s: "Volver a apuntar los juegos" },
                ] as { k: WoChoice; t: string; s: string }[]
              ).map((o) => (
                <button
                  key={o.k}
                  type="button"
                  role="radio"
                  aria-checked={woChoice === o.k}
                  onClick={() => setWoChoice(o.k)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 10,
                    background: woChoice === o.k ? "var(--accent-10)" : "var(--bg-card-2)",
                    border: `1px solid ${woChoice === o.k ? "var(--accent-40)" : "var(--line)"}`,
                    color: "var(--text)",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{o.t}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>{o.s}</span>
                </button>
              ))}
            </div>
          ) : sheet.forfeit ? (
            <Note tone={sheet.forfeitUs ? "error" : "accent"}>
              {sheet.forfeitUs ? "W.O. en contra · la pista es suya" : "W.O. a favor · la pista es nuestra"}
            </Note>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <SetsTable sets={sheet.sets} usLabel={ourName} themLabel={m.opponent} />
              {canEdit ? (
                <SetsEditor
                  sets={sheet.sets}
                  usLabel="Nosotros"
                  themLabel="Rival"
                  allowSuperTiebreak
                  onChange={(si, side, v) => edit(sheet.court, si, side, v)}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  {closed ? "Acta cerrada: no se puede cambiar." : !started ? "Aún no ha empezado el partido." : "Solo lectura."}
                </p>
              )}
            </div>
          ))}
      </Modal>

      {toast && <Toast tone={toast.includes("guardado") ? "success" : "warning"} title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
