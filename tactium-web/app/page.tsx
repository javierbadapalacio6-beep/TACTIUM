"use client";

import { useSession } from "@/lib/session";
import { CaptainHome } from "@/components/home/CaptainHome";
import { PublicHome } from "@/components/home/PublicHome";
import { SoloHome } from "@/components/home/SoloHome";
import { SkeletonCard } from "@/components/states";

/**
 * Inicio. Sin sesión es la PORTADA PÚBLICA de explorar; con sesión, el panel
 * del rol: el jugador suelto no tiene equipo ni jornadas, así que ve "Mi
 * pádel" en vez del panel del capitán.
 *
 * Misma URL para las dos cosas a propósito — quien comparte tactium.io no
 * tiene que saber si quien abre el enlace tiene cuenta.
 *
 * El club entra por `/club`, que es su propia pantalla — aquí lo mandamos al
 * panel de capitán para no dejar la ruta vacía si llega por accidente.
 */
export default function HomePage() {
  const { role, ready, user } = useSession();

  // Antes de leer el rol guardado no sabemos qué panel toca: un skeleton evita
  // pintar el del capitán y cambiarlo de golpe.
  if (!ready) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SkeletonCard />
      </div>
    );
  }

  if (!user) return <PublicHome />;
  if (role === "suelto") return <SoloHome />;
  return <CaptainHome isCaptain={role === "capitan" || role === "club"} />;
}
