"use client";

import { useSession } from "@/lib/session";
import { CaptainHome } from "@/components/home/CaptainHome";
import { SoloHome } from "@/components/home/SoloHome";
import { SkeletonCard } from "@/components/states";

/**
 * Inicio con sesión: el panel del rol. El jugador suelto no tiene equipo ni
 * jornadas, así que ve "Mi pádel" en vez del panel del capitán. El club entra
 * por `/club`; si llega aquí por accidente se le enseña el panel de capitán
 * para no dejar la ruta vacía.
 *
 * Sin sesión no se llega a este componente: `app/page.tsx` decide en servidor
 * y pinta la portada pública.
 */
export function HomeSwitch() {
  const { role, ready, user } = useSession();

  // Antes de leer el rol guardado no sabemos qué panel toca: un skeleton evita
  // pintar el del capitán y cambiarlo de golpe.
  if (!ready || !user) {
    return (
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SkeletonCard />
      </div>
    );
  }

  if (role === "suelto") return <SoloHome />;
  return <CaptainHome isCaptain={role === "capitan" || role === "club"} />;
}
