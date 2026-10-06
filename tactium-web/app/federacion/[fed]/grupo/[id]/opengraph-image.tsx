import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";
import { FCP_LEAGUE_NAME, loadFcpGroup, prettyFcpName } from "@/lib/seo/fcp";

export const alt = "Clasificación de un grupo de la Liga Cántabra de Pádel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function GrupoOg({ params }: { params: Promise<{ fed: string; id: string }> }) {
  const { id } = await params;
  const data = await loadFcpGroup(id);
  const nombre = prettyFcpName(data?.header?.nombre) || "Clasificación";
  const temporada = data?.header?.temporada;
  const top = (data?.standings ?? [])
    .slice(0, 3)
    .map((r, i) => `${r.posicion || i + 1}. ${r.equipo} · ${r.puntos} pts`);
  return ogImage({
    kicker: `${FCP_LEAGUE_NAME}${temporada ? ` ${temporada}` : ""}`,
    title: nombre,
    lines: top,
    footer: "Clasificación, jornadas y actas, sin cuenta",
  });
}
