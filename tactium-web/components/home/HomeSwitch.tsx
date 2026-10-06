"use client";

import { Suspense } from "react";
import { useSession } from "@/lib/session";
import { CaptainHome } from "@/components/home/CaptainHome";
import { SoloHome } from "@/components/home/SoloHome";
import { ClubDashboard } from "@/components/club/ClubDashboard";
import { CreateTournament } from "@/components/tournaments/CreateTournament";
import { Feed } from "@/components/social/social";
import { SectionHead } from "@/components/ui";
import { SkeletonCard } from "@/components/states";

/**
 * Inicio con sesión: el panel del rol y, debajo, «Tu gente» (el feed de los
 * que sigues, con kudos). Es el apartado «Inicio» de la navegación única,
 * el mismo para todos los roles:
 *
 *   capitán / jugador → panel del equipo (`CaptainHome`)
 *   suelto            → «Mi pádel» (`SoloHome`)
 *   club              → panel del club (`ClubDashboard`, también en `/club`)
 *   organizador       → sus torneos (`CreateTournament`, también en `/club/torneos`)
 *
 * Sin sesión no se llega a este componente: `app/page.tsx` decide en servidor
 * y pinta la portada pública.
 */
export function HomeSwitch() {
  const { role, ready, user, clubs, clubId } = useSession();

  // Antes de leer el rol guardado no sabemos qué panel toca: un skeleton evita
  // pintar el del capitán y cambiarlo de golpe.
  if (!ready || !user) {
    return (
      <div className="tw-page">
        <SkeletonCard />
      </div>
    );
  }

  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);

  const panel =
    role === "suelto" ? (
      <SoloHome />
    ) : role === "club" ? (
      tournamentsOnly ? (
        // Lee `?nuevo=1` con useSearchParams: su propio Suspense.
        <Suspense>
          <CreateTournament />
        </Suspense>
      ) : (
        <ClubDashboard />
      )
    ) : (
      <CaptainHome isCaptain={role === "capitan"} />
    );

  return (
    <>
      {panel}
      <section className={tournamentsOnly ? "tw-page-narrow" : "tw-page"} aria-label="Tu gente">
        <SectionHead
          title="Tu gente"
          sub="Lo que hacen los jugadores y los clubes a los que sigues."
        />
        <Feed embedded />
      </section>
    </>
  );
}
