import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";
import { loadLiveHead } from "@/lib/seo/live";

export const alt = "Directo de pádel en TACTIUM";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function DirectoOg({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await loadLiveHead(token).catch(() => null);
  if (!h) return ogImage({ kicker: "En directo", title: "Marcador pista a pista", footer: "Síguelo sin app" });
  const done = h.matchday_status === "finished" || (h.live === 0 && h.won + h.lost > 0);
  return ogImage({
    kicker: done ? "Terminado" : "En directo",
    title: `${h.team_name} vs ${h.opponent}`,
    lines: [
      `${h.won}–${h.lost} en pistas${h.live ? ` · ${h.live} en juego` : ""}`,
      [h.jornada_number != null ? `Jornada ${h.jornada_number}` : null, h.category].filter(Boolean).join(" · "),
    ],
    footer: "Marcador pista a pista, sin app",
  });
}
