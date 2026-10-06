import type { Metadata } from "next";

import { PublicLive } from "@/components/matchday/PublicLive";
import { cleanToken, liveTitle, loadLiveHead } from "@/lib/seo/live";

type Params = Promise<{ token: string }>;

/**
 * tactium.io/directo/{token} — el directo de una jornada para quien no tiene
 * la app (familia, el resto del club). Sin login: lee la RPC anon
 * `public_live_by_token`, que solo devuelve lo de ESE token. No se indexa
 * (robots + `robots.ts`).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const base: Metadata = {
    title: "Directo",
    description: "Marcador en directo de una jornada de pádel, pista a pista.",
    robots: { index: false, follow: false },
  };
  const h = await loadLiveHead(token).catch(() => null);
  if (!h) return base;
  const title = liveTitle(h);
  const description =
    h.matchday_status === "finished" || (h.live === 0 && h.won + h.lost > 0)
      ? `Terminado · ${h.won}–${h.lost} en pistas. Resultado pista a pista en TACTIUM.`
      : `${h.won}–${h.lost} en pistas${h.live ? ` · ${h.live} en juego` : ""}. Síguelo en directo, sin app.`;
  return {
    ...base,
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DirectoPage({ params }: { params: Params }) {
  const { token } = await params;
  return <PublicLive token={cleanToken(token)} />;
}
