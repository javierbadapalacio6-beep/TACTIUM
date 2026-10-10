import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";
import { availabilityWhen, loadAvailabilityHead } from "@/lib/seo/availability";

export const alt = "Disponibilidad de la jornada en TACTIUM";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function DisponibilidadOg({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await loadAvailabilityHead(token).catch(() => null);
  if (!h) {
    return ogImage({ kicker: "Disponibilidad", title: "¿Puedes jugar la jornada?", footer: "Un toque, sin app" });
  }
  return ogImage({
    kicker: "¿Puedes jugar?",
    title: `${h.team_name} vs ${h.opponent}`,
    lines: [
      availabilityWhen(h) ?? "",
      `${h.yes} van · ${h.pending} sin contestar`,
      [h.jornada_number != null ? `Jornada ${h.jornada_number}` : null, h.category].filter(Boolean).join(" · "),
    ].filter(Boolean),
    footer: "Marca tu respuesta con un toque, sin app",
  });
}
