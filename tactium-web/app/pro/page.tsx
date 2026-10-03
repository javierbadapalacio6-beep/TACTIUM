import type { Metadata } from "next";

import { Paywall } from "@/components/subscription/Paywall";

export const metadata: Metadata = {
  title: "TACTIUM Pro",
  description:
    "Alineaciones, actas, torneos y federación en un sitio hecho para capitanes. 14 días de prueba.",
};

/**
 * `/pro?motivo=…` abre con la línea de por qué estás aquí (el gate que lo
 * abrió) y `/pro?para=club|capitan` elige la familia de planes.
 */
export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
