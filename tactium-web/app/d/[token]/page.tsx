import type { Metadata } from "next";

import { PublicAvailability } from "@/components/availability/PublicAvailability";
import { availabilityTitle, availabilityWhen, loadAvailabilityHead } from "@/lib/seo/availability";
import { cleanToken } from "@/lib/seo/live";

type Params = Promise<{ token: string }>;

/**
 * tactium.io/d/{token} — disponibilidad de una jornada para el grupo de
 * WhatsApp: cada jugador, sin cuenta, se elige en la lista y marca Voy / Duda /
 * No. Lee y escribe con RPC anon que solo ven lo de ESE token
 * (`public_availability_by_token`, `public_respond_availability`). No se
 * indexa (robots + `robots.ts`).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const base: Metadata = {
    title: "Disponibilidad",
    description: "Marca si puedes jugar la próxima jornada. Sin app, con un toque.",
    robots: { index: false, follow: false },
  };
  const h = await loadAvailabilityHead(token).catch(() => null);
  if (!h) return base;
  const title = availabilityTitle(h);
  const description = [
    `${h.team_name}${availabilityWhen(h) ? ` · ${availabilityWhen(h)}` : ""}`,
    `${h.yes} van, ${h.pending} sin contestar. Marca tu respuesta, sin app.`,
  ].join(". ");
  return {
    ...base,
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DisponibilidadPage({ params }: { params: Params }) {
  const { token } = await params;
  return <PublicAvailability token={cleanToken(token)} />;
}
