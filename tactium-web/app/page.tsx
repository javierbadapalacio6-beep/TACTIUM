import type { Metadata } from "next";

import { BRAND_DEFINITION } from "@/lib/site";
import { serverUser } from "@/lib/supabase/server";
import { HomeSwitch } from "@/components/home/HomeSwitch";
import { MarketingHome } from "@/components/marketing/MarketingHome";

/**
 * Lo que la gente teclea en Google no es «alineaciones inteligentes»: es la
 * liga, su clasificación y sus resultados, o la marca. El título empieza por
 * la marca (así Google la reconoce como entidad cuando alguien busca
 * «tactium») y deja la Liga Cántabra como segundo argumento; la descripción
 * abre con la definición del producto y sigue con lo que damos sin cuenta.
 * Sólo se nombra la Cántabra porque es la única federación con datos.
 */
const HOME_TITLE = "TACTIUM · App para equipos de pádel federado · Liga Cántabra";
const HOME_DESCRIPTION = `${BRAND_DEFINITION}: alineaciones con orden de fuerza, torneos y la Liga Cántabra al día (clasificaciones, jornadas y actas), sin cuenta.`;

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
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
