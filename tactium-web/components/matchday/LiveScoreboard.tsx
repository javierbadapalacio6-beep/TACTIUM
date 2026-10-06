"use client";

import { useState } from "react";

import { fetchTeamPro } from "@/lib/account-queries";
import {
  activeScorer,
  courtOutcome,
  createShareToken,
  isLiveNow,
  liveShareText,
  liveTotals,
  liveUrl,
  useLiveMatchday,
  useNow,
} from "@/lib/live";
import { proHref } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Btn, Card, CardHead, Chip } from "@/components/ui";
import { IconShare } from "@/components/Icon";

import { LiveCourtRow } from "./LiveCourtRow";

/**
 * «EN DIRECTO» del equipo en la Jornada (espejo de
 * TACTIUM/src/features/home/components/live/LiveScoreboard.tsx).
 *
 * Arriba el total en pistas ganadas (como el marcador grande de Fixtured);
 * debajo una fila por pista estilo Sofascore. Se mueve solo por Realtime.
 * Cada pista lleva a /jornada/[id]/directo?pista=N para marcarla (Pro por
 * equipo, como «Apuntar resultados»; al jugador no se le bloquea). El
 * capitán comparte el enlace público.
 */
export function LiveScoreboard({
  matchdayId,
  teamId,
  courts,
  teamName,
  opponent,
  jornada,
  started,
  closed,
  onToast,
}: {
  matchdayId: string;
  teamId: string | null;
  courts: number;
  teamName: string;
  opponent: string;
  jornada: number | null;
  started: boolean;
  closed: boolean;
  onToast: (msg: string) => void;
}) {
  const { user, role } = useSession();
  const { state } = useLiveMatchday(matchdayId);
  const now = useNow();
  const [sharing, setSharing] = useState(false);
  const isManager = role === "capitan" || role === "club";
  const pro = useAsync(
    () => fetchTeamPro(teamId!).catch(() => null),
    [teamId],
    !!teamId && isManager
  );
  // Mismo criterio que el gate de la app: al jugador nunca; al capitán/club
  // según el equipo; ante la duda (null), no se bloquea.
  const locked = isManager && pro.data === false;

  const hasAnyLive = !!state?.courts.some((c) => c.live);
  if (!state || (!started && !hasAnyLive)) return null;

  const live = isLiveNow(state);
  const totals = liveTotals(state.courts);
  const canScore = state.can_score && !closed;
  const byCourt = new Map(state.courts.map((c) => [c.court_number, c]));
  const n = Math.max(courts, ...state.courts.map((c) => c.court_number), 1);

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      let token = state!.share_token;
      if (!token) {
        const res = await createShareToken(matchdayId);
        if (!res.ok) {
          onToast(res.reason);
          return;
        }
        token = res.data;
      }
      const text = liveShareText({ teamName, opponent, jornada, token });
      try {
        if (navigator.share) await navigator.share({ text, url: liveUrl(token) });
        else {
          await navigator.clipboard.writeText(text);
          onToast("Enlace del directo copiado");
        }
      } catch {
        /* cancelado */
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <Card flush style={{ marginBottom: 16 }}>
      <CardHead
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {live ? <span className="tw-live-dot" aria-hidden /> : null}
            {live ? "En directo" : closed || hasAnyLive ? "Terminado" : "Marcador en directo"}
          </span>
        }
        sub={
          canScore
            ? "Cualquiera del equipo puede llevar una pista: elige la que estés viendo."
            : undefined
        }
      >
        {state.is_admin && !closed ? (
          <Btn size="sm" icon={<IconShare size={14} />} onClick={() => void share()} disabled={sharing}>
            {sharing ? "Creando…" : "Compartir directo"}
          </Btn>
        ) : null}
      </CardHead>

      <div className="tw-live-total">
        <span className="tw-live-total-num mono" aria-label={`${totals.won} pistas ganadas, ${totals.lost} perdidas`}>
          {totals.won}
          <span style={{ color: "var(--text-faint)" }}> – </span>
          {totals.lost}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {totals.live > 0 ? `Pistas ganadas · ${totals.live} en juego` : "Pistas ganadas"}
        </span>
      </div>

      {Array.from({ length: n }, (_, i) => i + 1).map((k) => {
        const c = byCourt.get(k);
        const lv = c?.live ?? null;
        const scorer = activeScorer(lv, user?.id ?? null, now);
        const pair = [c?.player_a?.name, c?.player_b?.name].filter(Boolean).join(" / ") || "Sin pareja";
        const disabled = !canScore || !!c?.forfeit;
        const action = disabled
          ? null
          : scorer
            ? `La marca ${scorer}`
            : lv?.status === "finished"
              ? "Corregir"
              : lv
                ? "Marcar esta pista"
                : "Empezar a marcar";
        const href = disabled
          ? null
          : locked
            ? proHref("results_edit")
            : `/jornada/${matchdayId}/directo?pista=${k}`;
        return (
          <LiveCourtRow
            key={k}
            n={k}
            pair={pair}
            rival={opponent}
            outcome={courtOutcome(c)}
            forfeit={!!c?.forfeit}
            sets={c?.forfeit ? [] : lv?.sets ?? []}
            currentIdx={lv && lv.status === "live" ? lv.sets.length - 1 : -1}
            action={action && locked ? `${action} · Pro` : action}
            actionTone={scorer ? "warning" : "accent"}
            href={href}
          />
        );
      })}
      {locked && canScore ? (
        <div style={{ padding: "10px 16px 14px" }}>
          <Chip tone="accent" plain>
            Pro
          </Chip>{" "}
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Marcar en directo entra en Pro; verlo es libre para todo el equipo.
          </span>
        </div>
      ) : null}
    </Card>
  );
}
