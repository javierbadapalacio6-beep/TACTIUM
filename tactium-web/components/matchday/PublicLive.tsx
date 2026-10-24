"use client";

import { useCallback, useEffect, useState } from "react";

import {
  courtOutcome,
  courtSets,
  fetchPublicLive,
  liveCtx,
  liveTotals,
  type PublicLive as PublicLiveData,
} from "@/lib/live";
import { BtnLink, Card, Chip } from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconShare } from "@/components/Icon";

import { LiveCourtRow } from "./LiveCourtRow";

/**
 * Página pública del directo (/directo/[token]), sin login.
 *
 * Cabecera como la ficha de partido en directo de X (equipos a los lados,
 * marcador grande en medio, estado en rojo y compartir arriba a la derecha) y
 * debajo las pistas en filas estilo Sofascore, con el set en curso resaltado
 * como el rótulo de marcador de una retransmisión de YouTube. Se refresca cada
 * 7 s con la RPC anon (Realtime no es viable para anon con la RLS del equipo,
 * y así el token no abre nada más). Al cerrar el acta pasa a «Terminado» y
 * deja de pedir.
 */
const POLL_MS = 7000;

function fmtDate(d: string | null, t: string | null): string | null {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  if (Number.isNaN(date.getTime())) return d;
  const s = date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return t ? `${s} · ${t.slice(0, 5)}` : s;
}

export function PublicLive({ token }: { token: string }) {
  const [data, setData] = useState<PublicLiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchPublicLive(token);
      if (!d) setMissing(true);
      else {
        setData(d);
        setLastOk(Date.now());
      }
    } catch {
      /* sin red: se reintenta en el siguiente ciclo */
    } finally {
      setLoading(false);
    }
  }, [token]);

  const finishedMd = data?.matchday_status === "finished";

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (finishedMd || missing) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, finishedMd, missing]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <SkeletonPage />;
  if (missing || !data) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState
            icon={<IconCalendar size={22} />}
            title="Este directo no existe"
            body="Puede que el enlace esté mal copiado o que el capitán lo haya cambiado."
          />
        </Card>
      </div>
    );
  }

  // «En directo» desde la hora del partido (sin que nadie pulse «Marcar») y
  // con el acta mandando: un resultado metido a mano cierra la pista.
  const ctx = liveCtx(data, now);
  const courts = data.courts.map((c) => ({ c, sets: courtSets(c), outcome: courtOutcome(c, ctx) }));
  const totals = liveTotals(data, now);
  const anyLive = courts.some((x) => x.outcome === "live");
  const done = finishedMd || (!anyLive && totals.won + totals.lost > 0);
  const scoreUs = finishedMd && data.score_for != null ? data.score_for : totals.won;
  const scoreThem = finishedMd && data.score_against != null ? data.score_against : totals.lost;
  const ago = lastOk ? Math.max(0, Math.round((now - lastOk) / 1000)) : null;
  const meta = [
    data.jornada_number != null ? `Jornada ${data.jornada_number}` : null,
    data.category,
    fmtDate(data.match_date, data.match_time),
    data.location,
  ]
    .filter(Boolean)
    .join(" · ");

  async function share() {
    const text = `🎾 ${done ? "Resultado" : "En directo"}: ${data!.team_name} ${scoreUs}–${scoreThem} ${data!.opponent}`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        setToast("Enlace copiado");
      }
    } catch {
      /* cancelado */
    }
  }

  return (
    <div className="tw-page-narrow">
      <Card style={{ padding: "18px 16px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {done ? (
            <Chip tone="mute" plain>
              Terminado
            </Chip>
          ) : anyLive ? (
            <Chip tone="error" plain style={{ gap: 8 }}>
              <span className="tw-live-dot" aria-hidden />
              En directo
            </Chip>
          ) : (
            <Chip tone="mute" plain>
              Aún no ha empezado
            </Chip>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void share()} aria-label="Compartir">
            <IconShare size={15} />
            Compartir
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, textAlign: "center", overflowWrap: "anywhere" }}>
            {data.team_name}
          </div>
          <div
            className="mono"
            aria-label={`${data.team_name} ${scoreUs}, ${data.opponent} ${scoreThem}`}
            aria-live="polite"
            style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}
          >
            {scoreUs}
            <span style={{ color: "var(--text-faint)" }}>–</span>
            {scoreThem}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              textAlign: "center",
              color: "var(--text-muted)",
              overflowWrap: "anywhere",
            }}
          >
            {data.opponent}
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
          Pistas ganadas{anyLive && !done ? ` · ${courts.filter((x) => x.outcome === "live").length} en juego` : ""}
        </div>
        {meta ? (
          <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>{meta}</div>
        ) : null}
      </Card>

      {courts.length > 0 ? (
        <Card flush>
          {courts.map(({ c, sets, outcome }, i) => (
            <div key={c.court_number} style={i === 0 ? { marginTop: -1 } : undefined}>
              <LiveCourtRow
                n={c.court_number}
                pair={c.pair ?? `Pareja ${c.court_number}`}
                rival={data.opponent}
                outcome={outcome}
                forfeit={c.forfeit}
                sets={sets}
                currentIdx={outcome === "live" && c.live?.status === "live" ? sets.length - 1 : -1}
              />
            </div>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState compact icon={<IconCalendar size={22} />} title="Aún no hay pistas" body="En cuanto empiece el primer partido, el marcador sale aquí." />
        </Card>
      )}

      <p style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", margin: "12px 0 0" }}>
        {done
          ? "Resultado final de la jornada."
          : ago != null
            ? `Se actualiza solo · hace ${ago < 5 ? "un momento" : `${ago} s`}`
            : "Se actualiza solo"}
      </p>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
        <BtnLink href="/" variant="quiet" size="sm">
          Marcador hecho con TACTIUM ›
        </BtnLink>
      </div>

      {toast && <Toast tone="success" title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
