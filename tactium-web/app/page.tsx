import { serverUser } from "@/lib/supabase/server";
import { HomeSwitch } from "@/components/home/HomeSwitch";
import { MarketingHome } from "@/components/marketing/MarketingHome";

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
