import { ogImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/seo/og";

export const alt = "TACTIUM · El sistema operativo del pádel federado";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OpengraphImage() {
  return ogImage({
    kicker: "iOS, Android y web",
    title: "El sistema operativo del pádel federado",
    lines: ["Convoca, alinea y cierra la jornada.", "Torneos completos y la competición federada al día."],
    footer: "Para capitanes, clubs y organizadores",
  });
}
