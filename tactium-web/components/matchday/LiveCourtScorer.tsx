"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  activeScorer,
  applyGameLocal,
  claimCourt,
  finishCourt,
  isLockMessage,
  isStaleMessage,
  newEventId,
  releaseCourt,
  scoreGame,
  setsWon,
  undoGame,
  useLiveMatchday,
  useNow,
  type LiveCourtState,
  type LiveSet,
} from "@/lib/live";
import { fetchMatchday, type DbMatchday } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useMatchdayTeam } from "@/lib/use-matchday-team";
import { useAsync } from "@/lib/use-async";
import { Btn, Card, Modal, Note, PageHeader, Segmented } from "@/components/ui";
import { SkeletonPage, Toast } from "@/components/states";

/**
 * /jornada/[id]/directo?pista=N — marcar UNA pista juego a juego (espejo de
 * TACTIUM/src/features/home/screens/LiveScoreScreen.tsx).
 *
 * El tanteo grande con «Set 2» encima (a la manera del contador de pushr) y
 * dos botones enormes al pulgar; «Deshacer último juego» siempre a mano. Al
 * entrar se coge la pista (marcador activo); si otro la lleva se dice y se
 * puede tomar el relevo. Los toques van en cola, con uuid y nº de juegos
 * esperado, así que dos personas a la vez no estropean el tanteo.
 */
export function LiveCourtScorer({ id, court: initialCourt }: { id: string; court: number }) {
  const router = useRouter();
  const { user } = useSession();
  const owner = useMatchdayTeam(id);
  const { state, reload } = useLiveMatchday(id);
  const md = useAsync<DbMatchday | null>(() => fetchMatchday(id), [id], true);
  const now = useNow(10_000);

  const [court, setCourt] = useState(initialCourt);
  const [claiming, setClaiming] = useState(true);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [local, setLocal] = useState<LiveCourtState | null>(null);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const confirmed = useRef<LiveCourtState | null>(null);

  const courtState = state?.courts.find((c) => c.court_number === court) ?? null;
  const serverLive = courtState?.live ?? null;
  const live =
    local &&
    local.court_number === court &&
    (pending > 0 || !serverLive || new Date(local.updated_at).getTime() >= new Date(serverLive.updated_at).getTime())
      ? local
      : serverLive;
  const otherScorer = activeScorer(serverLive, user?.id ?? null, now);
  const blocked = !!lockedBy || !!otherScorer;
  const finished = live?.status === "finished";
  const closed = state?.matchday_status === "finished";

  useEffect(() => {
    if (pending === 0) confirmed.current = serverLive;
  }, [serverLive, pending]);

  const claim = useCallback(
    async (force: boolean) => {
      setClaiming(true);
      const res = await claimCourt(id, court, force);
      setClaiming(false);
      if (res.ok) {
        confirmed.current = res.data;
        setLockedBy(null);
        void reload();
      } else if (isLockMessage(res.reason)) {
        setLockedBy(res.reason.replace(/^Ahora la marca\s*/, "").replace(/:.*$/, ""));
      } else {
        setToast(res.reason);
      }
    },
    [id, court, reload]
  );

  // Coger la pista al entrar (y al cambiar de pista); soltarla al salir.
  useEffect(() => {
    setLocal(null);
    setLockedBy(null);
    void claim(false);
    return () => {
      void releaseCourt(id, court);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, court]);

  function enqueue(job: () => Promise<{ ok: true; data: LiveCourtState } | { ok: false; reason: string }>) {
    setPending((p) => p + 1);
    queue.current = queue.current
      .then(async () => {
        const res = await job();
        if (res.ok) {
          confirmed.current = res.data;
          setLocal(res.data);
          return;
        }
        setLocal(null);
        if (isLockMessage(res.reason)) setLockedBy(res.reason.replace(/^Ahora la marca\s*/, "").replace(/:.*$/, ""));
        else if (isStaleMessage(res.reason)) setToast("El tanteo acaba de cambiar. Revísalo y vuelve a marcar.");
        else setToast(res.reason);
        void reload();
      })
      .catch(() => {})
      .finally(() => setPending((p) => Math.max(0, p - 1)));
  }

  const base = (): LiveCourtState =>
    live ?? {
      id: "",
      court_number: court,
      format: "normal",
      status: "live",
      sets: [{ us: 0, them: 0 }],
      winner: null,
      games_count: 0,
      started_at: new Date().toISOString(),
      finished_at: null,
      updated_at: new Date().toISOString(),
      scorer_id: user?.id ?? null,
      scorer_name: null,
      scorer_seen_at: null,
      scorer_active: true,
    };

  function addGame(side: "us" | "them") {
    if (blocked || finished || closed || claiming) return;
    const next = applyGameLocal(base(), side);
    setLocal(next);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* sin vibración */
    }
    const eventId = newEventId();
    enqueue(() => scoreGame(id, court, side, eventId, confirmed.current?.games_count ?? null));
  }

  function undo() {
    if (blocked || closed || !live || live.games_count === 0) return;
    enqueue(() => undoGame(id, court, confirmed.current?.games_count ?? null));
  }

  function switchCourt(v: string) {
    const k = Number(v.slice(1));
    setCourt(k);
    router.replace(`/jornada/${id}/directo?pista=${k}`, { scroll: false });
  }

  if (!state || md.loading) return <SkeletonPage />;

  const m = md.data;
  const nCourts = Math.max(5, ...state.courts.map((c) => c.court_number));
  const sets: LiveSet[] = live?.sets ?? [{ us: 0, them: 0 }];
  const cur = finished ? null : sets[sets.length - 1];
  const done = finished ? sets : sets.slice(0, -1);
  const won = setsWon(live);
  const setLabel = finished
    ? live?.winner === "us"
      ? "Pista ganada"
      : live?.winner === "them"
        ? "Pista perdida"
        : "Pista terminada"
    : live?.format === "super_tb" && sets.length === 3
      ? "Super tie-break"
      : `Set ${sets.length}`;
  const pair = [courtState?.player_a?.name, courtState?.player_b?.name].filter(Boolean).join(" / ") || "Nosotros";
  const rival = m?.opponent ?? "Rival";
  const disabled = blocked || finished || closed || claiming;
  const undoOff = blocked || closed || !live || live.games_count === 0;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        back={{ href: `/jornada/${id}?tab=resultado`, label: "Jornada" }}
        title={`Pista ${court}`}
        meta={[
          owner.teamName ? `${owner.teamName} vs ${rival}` : `vs ${rival}`,
          m?.round != null ? `Jornada ${m.round}` : null,
        ]}
      />

      <div style={{ marginBottom: 16, overflowX: "auto" }}>
        <Segmented
          label="Pista"
          value={`P${court}`}
          onChange={switchCourt}
          options={Array.from({ length: nCourts }, (_, i) => ({ value: `P${i + 1}`, label: `P${i + 1}` }))}
        />
      </div>

      {closed ? (
        <Note style={{ marginBottom: 16 }}>El acta está cerrada: el directo ya no se puede tocar.</Note>
      ) : blocked ? (
        <Note tone="warning" style={{ marginBottom: 16 }}>
          <strong>La marca {otherScorer ?? lockedBy ?? "otro compañero"}.</strong> Solo una persona lleva cada
          pista para no marcar doble. Si ya no está pendiente, toma tú el relevo.
          <div style={{ marginTop: 10 }}>
            <Btn size="sm" variant="accent" onClick={() => void claim(true)} disabled={claiming}>
              {claiming ? "Un momento…" : "Tomar el relevo"}
            </Btn>
          </div>
        </Note>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: "0 0 12px" }}>
          {claiming ? "Cogiendo la pista…" : "Marcas tú esta pista."}
          {pending > 0 ? " Guardando…" : ""}
        </p>
      )}

      <Card style={{ textAlign: "center", padding: "20px 16px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: finished ? "var(--text-muted)" : "var(--error)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {!finished && !closed ? <span className="tw-live-dot" aria-hidden /> : null}
          {setLabel}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "end", gap: 8, marginTop: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", minHeight: 36 }}>{pair}</div>
            <div className="tw-live-big mono" style={live?.winner === "us" ? { color: "var(--accent)" } : undefined} aria-live="polite">
              {cur ? cur.us : won.us}
            </div>
          </div>
          <div className="mono" style={{ fontSize: 36, color: "var(--text-faint)", paddingBottom: 16 }}>–</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", minHeight: 36 }}>{rival}</div>
            <div className="tw-live-big mono" style={live?.winner === "them" ? { color: "var(--error)" } : undefined} aria-live="polite">
              {cur ? cur.them : won.them}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
          {done.length > 0 ? (
            done.map((s, i) => (
              <span key={i} className={"chip chip-plain" + (s.us > s.them ? "" : " chip-mute")}>
                <span className="mono">
                  {s.us}-{s.them}
                </span>
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
              Toca quién gana cada juego. El set cambia solo.
            </span>
          )}
        </div>
      </Card>

      <div className="tw-live-pad" style={{ marginTop: 16 }}>
        <button type="button" className="is-us" onClick={() => addGame("us")} disabled={disabled} aria-label="Juego para nosotros">
          <span className="plus">+</span>
          Nosotros
        </button>
        <button type="button" onClick={() => addGame("them")} disabled={disabled} aria-label="Juego para el rival">
          <span className="plus">+</span>
          Rival
        </button>
      </div>

      <Btn block size="lg" onClick={undo} disabled={undoOff} style={{ marginTop: 12 }} aria-label="Deshacer último juego">
        ↶ Deshacer último juego
      </Btn>

      {finished ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 12 }}>
          Ya está en el acta. Si algo no cuadra, deshaz el último juego o corrígelo en Resultados.
        </p>
      ) : null}

      {state.is_admin && !closed && live && !finished ? (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Btn variant="danger-ghost" size="sm" onClick={() => setConfirmFinish(true)} disabled={blocked}>
            Terminar pista
          </Btn>
        </div>
      ) : null}

      <Modal
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        labelledBy="terminar-pista"
        width={420}
        title={`¿Terminar la pista ${court}?`}
        lede="Lo marcado pasa al acta tal cual. Después se puede corregir a mano en Resultados."
        footer={
          <>
            <Btn onClick={() => setConfirmFinish(false)}>Cancelar</Btn>
            <Btn
              variant="danger"
              onClick={() => {
                setConfirmFinish(false);
                enqueue(() => finishCourt(id, court));
              }}
            >
              Terminar
            </Btn>
          </>
        }
      >
        {null}
      </Modal>

      {toast && <Toast tone="warning" title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
