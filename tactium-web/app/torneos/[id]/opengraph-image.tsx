import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";
import { loadTournamentHead, tournamentDates } from "@/lib/seo/tournament";

export const alt = "Torneo de pádel en TACTIUM";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const STATUS: Record<string, string> = {
  open: "Inscripción abierta",
  in_progress: "En juego",
  finished: "Terminado",
};

export default async function TorneoOg({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await loadTournamentHead(id);
  if (!t) return ogImage({ kicker: "Torneo de pádel", title: "Cuadros y resultados en directo" });
  return ogImage({
    kicker: STATUS[t.status] ?? "Torneo de pádel",
    title: t.name,
    lines: [tournamentDates(t.starts_on, t.ends_on) ?? "", t.location ?? ""],
    footer: "Cuadros, horarios y resultados en directo",
  });
}
