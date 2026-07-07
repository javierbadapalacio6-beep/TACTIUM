"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Reveal } from "@/app/app/ui/Reveal";
import { SeasonsManager } from "./SeasonsManager";

// Página de gestión de TEMPORADAS del equipo. Replica el flujo de la app
// móvil (SeasonsScreen + SeasonDetailScreen): alta de temporada, cierre/
// archivado, alta de jornada manual e importación de calendario por imagen.
// La lista de jornadas en sí vive en la pestaña "Jornadas" del equipo; aquí
// sólo se gestionan temporadas + el alta/import de jornadas.
export default function SeasonsPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;

  return (
    <>
      <Reveal>
        <Link
          href={`/app/team/${teamId}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
        >
          <span>←</span> EQUIPO
        </Link>
      </Reveal>

      {teamId && <SeasonsManager teamId={teamId} />}
    </>
  );
}
