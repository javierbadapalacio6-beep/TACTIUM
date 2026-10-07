import type { Metadata } from "next";

import { serverUser } from "@/lib/supabase/server";
import { HomeSwitch } from "@/components/home/HomeSwitch";
import { MarketingHome } from "@/components/marketing/MarketingHome";

/**
 * Lo que la gente teclea en Google no es «alineaciones inteligentes»: es la
 * liga, su clasificación y sus resultados. El título y la descripción de la
 * portada apuntan ahí, que es lo que hoy damos de verdad sin cuenta, y
 * dejan las alineaciones como segundo argumento. Sólo se nombra la Cántabra
 * porque es la única federación con datos.
 */
const HOME_TITLE = "Liga Cántabra de Pádel: clasificaciones, resultados y alineaciones";
const HOME_DESCRIPTION =
  "Clasificaciones, calendarios y actas de la Liga Cántabra de Pádel al día, sin cuenta. Y para tu equipo: alineaciones con orden de fuerza, torneos y la jornada en un sitio.";

export const metadata: Metadata = {
  title: { absolute: `${HOME_TITLE} · TACTIUM` },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: HOME_TITLE, description: HOME_DESCRIPTION },
  twitter: { title: HOME_TITLE, description: HOME_DESCRIPTION },
};

/**
 * Inicio. Misma URL para todos a propósito — quien comparte tactium.io no
 * tiene que saber si quien abre el enlace tiene cuenta.
 *
 * Sin sesión es la PORTADA: qué es TACTIUM, y debajo la parte que se puede
 * usar sin cuenta (torneos y federación). Se decide en servidor para que el
 * visitante —y Google— reciba la página ya pintada.
 *
 * Con sesión, el panel del rol (`HomeSwitch`).
 */
export default async function HomePage() {
  const user = await serverUser();
  if (!user) return <MarketingHome />;
  return <HomeSwitch />;
}
