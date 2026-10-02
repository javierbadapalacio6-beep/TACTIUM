import type { Metadata } from "next";

import { FcpGroupView } from "@/components/federation/Federation";
import { JsonLd } from "@/components/seo/JsonLd";
import { groupJsonLd, groupMetadata, loadFcpGroup } from "@/lib/seo/fcp";

type Params = Promise<{ fed: string; id: string }>;

/**
 * Ficha de grupo (clasificación + jornadas), renderizada en servidor.
 *
 * La clasificación se carga aquí con el cliente anónimo y se entrega a la
 * vista como estado inicial: el HTML que recibe Google (y el visitante) ya
 * lleva la tabla, el título propio del grupo y el JSON-LD. `loadFcpGroup`
 * está memoizado por petición, así que metadatos y página comparten una
 * sola consulta.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return groupMetadata(id, await loadFcpGroup(id));
}

export default async function GrupoPage({ params }: { params: Params }) {
  const { fed, id } = await params;
  const data = await loadFcpGroup(id);
  return (
    <>
      {data ? <JsonLd data={groupJsonLd(id, data)} /> : null}
      <FcpGroupView slug={fed} id={id} initial={data ?? undefined} />
    </>
  );
}
