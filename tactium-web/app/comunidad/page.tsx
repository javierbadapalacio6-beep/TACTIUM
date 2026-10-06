import type { Metadata } from "next";

import { Community } from "@/components/social/social";
import { PublicHighlights } from "@/components/community/PublicHighlights";
import { serverUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Comunidad de pádel",
  description:
    "Busca jugadores y clubes de pádel, mira sus perfiles públicos y síguelos para tenerlos a la vista.",
  alternates: { canonical: "/comunidad" },
};

export default async function ComunidadPage() {
  const user = await serverUser();
  return (
    <>
      <Community />
      {/* El visitante no tiene «gente que conoces»: le enseñamos quién hay. */}
      {!user && <PublicHighlights />}
    </>
  );
}
