import type { Metadata } from "next";

import { Paywall } from "@/components/subscription/Paywall";
import { PublicPricing } from "@/components/marketing/PublicPricing";
import { serverUser } from "@/lib/supabase/server";
import { MAX_ANNUAL_DISCOUNT } from "@/lib/public-copy";

export const metadata: Metadata = {
  title: "Planes y precios",
  description:
    `Planes de TACTIUM para capitanes y clubs de pádel: 14 días de prueba sin tarjeta, anual con hasta un ${MAX_ANNUAL_DISCOUNT} % de ahorro y torneos de hasta 16 parejas gratis.`,
  alternates: { canonical: "/pro" },
};

/**
 * Sin sesión, la página de precios pública (los cuatro planes y una
 * comparativa). Con sesión, el paywall de siempre:
 * `/pro?motivo=…` abre con la línea de por qué estás aquí (el gate que lo
 * abrió) y `/pro?para=club|capitan` elige la familia de planes.
 */
export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await serverUser();
  if (!user) return <PublicPricing />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const para = one(sp.para);
  return (
    <Paywall
      motivo={one(sp.motivo)}
      para={para === "club" || para === "capitan" ? para : undefined}
    />
  );
}
