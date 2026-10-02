import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FcpTeamView } from "@/components/federation/Federation";
import { JsonLd } from "@/components/seo/JsonLd";
import { loadFcpTeam, teamJsonLd, teamMetadata } from "@/lib/seo/fcp";

type Params = Promise<{ fed: string; id: string }>;

/**
 * Ficha de equipo federado, renderizada en servidor.
 *
 * El perfil (cifras, racha, plantilla) se resuelve aquí con el cliente
 * anónimo y llega a la vista como estado inicial, de modo que el HTML ya
 * trae el nombre del equipo, su grupo y sus jugadores: es lo que busca
 * alguien que teclea el nombre de su club en Google.
 */
function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const idEquipo = parseId(id);
  if (idEquipo == null) return { title: "Equipo no encontrado", robots: { index: false } };
  return teamMetadata(idEquipo, await loadFcpTeam(idEquipo));
}

export default async function FcpEquipoPage({ params }: { params: Params }) {
  const { fed, id } = await params;
  const idEquipo = parseId(id);
  if (idEquipo == null) notFound();
  const data = await loadFcpTeam(idEquipo);
  return (
    <>
      {data ? <JsonLd data={teamJsonLd(idEquipo, data)} /> : null}
      <FcpTeamView slug={fed} id={id} initial={data?.profile} />
    </>
  );
}
