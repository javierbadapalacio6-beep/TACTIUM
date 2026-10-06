"use client";

import Link from "next/link";
import type { MouseEvent as ReactMouseEvent } from "react";

import type { FcpRival } from "@/lib/fcp-public";

/**
 * Los demás equipos de un grupo de la liga en inscripción, cada uno con su
 * sede corta y enlazado a su ficha pública.
 *
 * Es lo primero que quiere saber un equipo en cuanto la Federación reparte la
 * categoría en grupos: contra quién juega y dónde. Sale en tres sitios (panel
 * del club, plantilla del equipo y ficha pública) y con la misma forma en los
 * tres. Va en rejilla `22px minmax(0,1fr) auto` (la de la plantilla inscrita)
 * y no en flex: en iOS Safari un nombre largo en flex empuja la sede fuera.
 */
export function FcpGroupRivals({
  rivales,
  slug = "cantabra",
  onOpen,
}: {
  rivales: FcpRival[];
  slug?: string;
  /** En el explorador ancho, abre la ficha en el panel lateral. */
  onOpen?: (idEquipo: number, e: ReactMouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className="tw-insc-roster">
      {rivales.map((r, i) => (
        <Link
          key={r.idEquipo}
          href={`/federacion/${slug}/equipo/${r.idEquipo}`}
          onClick={onOpen ? (e) => onOpen(r.idEquipo, e) : undefined}
          className="tw-insc-roster-row"
          style={{ color: "inherit" }}
          title={r.confirmado ? undefined : "Inscripción sin confirmar"}
        >
          <span className="pos">{i + 1}</span>
          <span className="truncate" style={{ fontWeight: 600 }}>
            {r.equipo}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.sedeCorta ?? "Sin sede"}</span>
        </Link>
      ))}
    </div>
  );
}
