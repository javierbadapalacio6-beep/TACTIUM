"use client";

import { useSession } from "@/lib/session";
import { CaptainHome } from "@/components/home/CaptainHome";
import { SoloHome } from "@/components/home/SoloHome";
import { SkeletonCard } from "@/components/states";

/**
 * Inicio. El panel cambia según el rol: el jugador suelto no tiene equipo ni
 * jornadas, así que ve "Mi pádel" en vez del panel del capitán.
 *
 * El club entra por `/club`, que es su propia pantalla — aquí lo mandamos al
 * panel de capitán para no dejar la ruta vacía si llega por accidente.
 */
export default function HomePage() {
  const { role, ready } = useSession();

  // Antes de leer el rol guardado no sabemos qué panel toca: un skeleton evita
  // pintar el del capitán y cambiarlo de golpe.
  if (!ready) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SkeletonCard />
      </div>
    );
  }

  if (role === "suelto") return <SoloHome />;
  return <CaptainHome isCaptain={role === "capitan" || role === "club"} />;
}
