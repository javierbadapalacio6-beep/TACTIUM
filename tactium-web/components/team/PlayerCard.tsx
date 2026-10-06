"use client";

import { useMemo } from "react";
import type React from "react";

import type { DbPlayer } from "@/lib/queries";
import {
  computePlayerLeagueStats,
  type LeagueStatsBundle,
} from "@/lib/player-stats";
import { Avatar, Btn, BtnLink, Chip, Modal, Stat, StatRow, Toggle } from "@/components/ui";
import { CountUp } from "@/components/entry/motion-bits";

function initials(n: string) {
  return n
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Punto verde «está en TACTIUM» sobre el avatar. */
export const ACCOUNT_DOT: React.CSSProperties = {
  position: "absolute",
  right: -1,
  bottom: -1,
  width: 11,
  height: 11,
  borderRadius: 6,
  background: "var(--accent)",
  border: "2px solid var(--bg-card)",
};

/** Partidos de liga que dos fichas han jugado juntas, con su marcador. */
function sharedGames(bundle: LeagueStatsBundle, a: string, b: string) {
  const md = new Map(bundle.matchdays.map((m) => [m.id, m]));
  const out: { key: string; jornada: number; court: number; sets: string; won: boolean | null }[] = [];
  for (const p of bundle.pairs) {
    if (!p.matchday_id || p.court_number == null) continue;
    const ids = [p.player_a_id, p.player_b_id];
    if (!ids.includes(a) || !ids.includes(b)) continue;
    const m = md.get(p.matchday_id);
    if (!m) continue;
    const rows = bundle.results
      .filter((r) => r.matchday_id === p.matchday_id && r.court_number === p.court_number)
      .sort((x, y) => (x.set_number ?? 0) - (y.set_number ?? 0));
    const fo = rows.find((r) => r.forfeit);
    let won: boolean | null = null;
    let sets = "";
    if (fo) {
      won = !fo.forfeit_us;
      sets = "W.O.";
    } else {
      let us = 0;
      let them = 0;
      const parts: string[] = [];
      for (const r of rows) {
        if (r.us == null || r.them == null) continue;
        parts.push(`${r.us}-${r.them}`);
        if (r.us > r.them) us++;
        else if (r.them > r.us) them++;
      }
      sets = parts.join(" ");
      if (us >= 2) won = true;
      else if (them >= 2) won = false;
    }
    out.push({
      key: `${p.matchday_id}-${p.court_number}`,
      jornada: (m as { jornada_number?: number }).jornada_number ?? 0,
      court: p.court_number,
      sets,
      won,
    });
  }
  return out.sort((x, y) => x.jornada - y.jornada);
}

/**
 * Ficha de un jugador (rediseño 2026-10), en el mismo modal para el capitán y
 * el jugador. Sustituye al «Editar» directo de cada fila: los números son
 * `computePlayerLeagueStats`, el mismo cálculo que la app.
 */
export function PlayerCard({
  player,
  teamName,
  canManage,
  isCaptainRow,
  myPlayerId,
  bundle,
  loading,
  onClose,
  onEdit,
  onToggleAvailable,
  onRemove,
  profileHref,
}: {
  player: DbPlayer | null;
  teamName: string;
  canManage: boolean;
  isCaptainRow: boolean;
  myPlayerId: string | null;
  bundle: LeagueStatsBundle | null;
  loading: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleAvailable: (v: boolean) => void;
  onRemove: () => void;
  profileHref: string | null;
}) {
  const stats = useMemo(
    () => (player && bundle ? computePlayerLeagueStats(player.id, bundle) : null),
    [player, bundle],
  );
  const topCourt = useMemo(
    () => (stats?.byCourt.length ? [...stats.byCourt].sort((a, b) => b.played - a.played)[0] : null),
    [stats],
  );
  const together = useMemo(
    () =>
      player && bundle && myPlayerId && myPlayerId !== player.id
        ? sharedGames(bundle, myPlayerId, player.id)
        : [],
    [player, bundle, myPlayerId],
  );
  if (!player) return null;
  const available = player.available !== false;
  const togetherWon = together.filter((g) => g.won === true).length;

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="ficha-jugador"
      width={480}
      footer={
        <>
          {canManage && (
            <Btn variant="danger-ghost" onClick={onRemove} style={{ marginRight: "auto" }}>
              Quitar de la plantilla
            </Btn>
          )}
          {canManage && <Btn onClick={onEdit}>Editar</Btn>}
          {profileHref ? (
            <BtnLink href={profileHref} variant="accent">
              Ver perfil
            </BtnLink>
          ) : (
            <Btn onClick={onClose}>Cerrar</Btn>
          )}
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <Avatar initials={initials(player.name)} src={player.photoUrl} size={56} />
          {player.userId && <span aria-hidden="true" style={ACCOUNT_DOT} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{teamName}</div>
          <h2 id="ficha-jugador" style={{ fontSize: 19, margin: "2px 0 0" }}>
            {player.alias?.trim() || player.name}
            {myPlayerId === player.id ? " (tú)" : ""}
          </h2>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
            {[player.position, isCaptainRow ? "capitán" : null, player.userId ? "en TACTIUM" : "sin cuenta"]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
            {player.pts}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>pts</div>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 12.5, fontWeight: 600, color: "var(--text-faint)" }}>
        Liga · todas las temporadas
      </div>
      {loading && !bundle ? (
        <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Cargando…</p>
      ) : stats && stats.played > 0 ? (
        <>
          <StatRow compact style={{ marginTop: 8 }}>
            <Stat label="Partidos" value={<CountUp to={stats.played} duration={0.4} />} />
            <Stat label="Ganados" value={<CountUp to={stats.won} duration={0.4} />} tone="accent" />
            <Stat label="Victorias" value={<CountUp to={stats.winRate ?? 0} duration={0.4} />} unit="%" />
          </StatRow>
          <div style={{ marginTop: 10 }}>
            <div className="list-row">
              <span className="list-row-main">
                <span className="list-row-sub">Mejor pareja</span>
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                {stats.bestPartner
                  ? `con ${stats.bestPartner.name} · ${stats.bestPartner.won} de ${stats.bestPartner.played}`
                  : "Aún sin pareja fija"}
              </span>
            </div>
            <div className="list-row">
              <span className="list-row-main">
                <span className="list-row-sub">Pista más jugada</span>
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                {topCourt
                  ? `Pista ${topCourt.court} · ${topCourt.played} ${topCourt.played === 1 ? "vez" : "veces"}`
                  : "—"}
              </span>
            </div>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0" }}>
          Todavía no ha jugado partidos de liga con acta cerrada.
        </p>
      )}

      {together.length > 0 && (
        <>
          <div style={{ marginTop: 18, fontSize: 12.5, fontWeight: 600, color: "var(--text-faint)" }}>
            Vosotros dos · {together.length} {together.length === 1 ? "partido" : "partidos"} ·{" "}
            {togetherWon} {togetherWon === 1 ? "ganado" : "ganados"}
          </div>
          <div style={{ marginTop: 6 }}>
            {together.slice(-4).map((g) => (
              <div key={g.key} className="list-row">
                <span className="list-row-main">
                  <span className="list-row-sub">
                    J{g.jornada} · Pista {g.court}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{
                    fontWeight: 700,
                    color: g.won === true ? "var(--accent)" : g.won === false ? "var(--error)" : "var(--text-muted)",
                  }}
                >
                  {g.sets || "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* El capitán, en la de cualquiera; el jugador (o el capitán en modo
          jugador), en la suya: si no, abría su ficha y no podía darse de baja. */}
      {(canManage || myPlayerId === player.id) && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 10,
            background: "var(--bg-card-2)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
            {available ? "Disponible" : "De baja"}
          </span>
          {!available && <Chip tone="warning">Baja</Chip>}
          <Toggle on={available} onChange={() => onToggleAvailable(!available)} label="Disponible" />
        </div>
      )}
    </Modal>
  );
}
