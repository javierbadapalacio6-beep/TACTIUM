"use client";

import Link from "next/link";

import { isLiveNow, liveTotals, useLiveMatchday } from "@/lib/live";

/**
 * Inicio: la jornada que se está jugando AHORA, con el marcador global en
 * pistas (espejo de TACTIUM/src/features/home/components/live/LiveHomeCard.tsx).
 * Solo se pinta con alguna pista en directo.
 */
export function LiveHomeCard({
  matchdayId,
  teamName,
  opponent,
  jornada,
}: {
  matchdayId: string;
  teamName: string;
  opponent: string;
  jornada: number | null;
}) {
  const { state } = useLiveMatchday(matchdayId);
  if (!isLiveNow(state)) return null;
  const t = liveTotals(state!.courts);
  return (
    <Link
      href={`/jornada/${matchdayId}?tab=resultado`}
      className="card card-hover"
      style={{
        display: "block",
        padding: 18,
        marginBottom: 16,
        borderColor: "color-mix(in srgb, var(--error) 40%, transparent)",
        color: "inherit",
        textDecoration: "none",
      }}
      aria-label={`En directo: ${teamName} ${t.won}, ${opponent} ${t.lost}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
        <span className="tw-live-dot" aria-hidden />
        <span style={{ color: "var(--error)" }}>En directo</span>
        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
          {jornada != null ? `J${jornada} · ` : ""}
          {t.live} {t.live === 1 ? "pista en juego" : "pistas en juego"}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{teamName}</span>
        <span className="mono" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
          {t.won}–{t.lost}
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)", textAlign: "right", overflowWrap: "anywhere" }}>
          {opponent}
        </span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", marginTop: 10 }}>Ver pista a pista ›</div>
    </Link>
  );
}
