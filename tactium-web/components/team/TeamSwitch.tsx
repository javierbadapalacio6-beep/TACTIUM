"use client";

import { useSession } from "@/lib/session";
import { Roster } from "@/components/team/Roster";
import { ActivateTeamsCard } from "@/components/club/ActivateTeamsCard";
import { BtnLink, Card, PageHeader } from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { IconUsers } from "@/components/Icon";

/**
 * «Equipo» de la navegación única. El capitán y el jugador ven su plantilla;
 * el organizador («solo torneos»), la puerta para activar la gestión de
 * equipos; el jugador suelto, cómo crear o unirse a uno. El club con equipos
 * tiene su lista en `/club/equipos` y el menú le lleva allí directamente.
 */
export function TeamSwitch() {
  const { role, ready, clubs, clubId } = useSession();
  if (!ready) return <SkeletonPage />;

  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);

  if (tournamentsOnly) {
    return (
      <div className="tw-page-narrow">
        <PageHeader
          title="Equipos"
          lede="Tu espacio es de torneos. Si además llevas equipos de liga, actívalo aquí."
        />
        <ActivateTeamsCard />
      </div>
    );
  }

  if (role === "suelto") {
    return (
      <div className="tw-page-narrow">
        <PageHeader title="Equipo" />
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Crea o únete a un equipo"
            body="Con equipo tendrás jornadas, alineaciones y la plantilla a mano. Si te han pasado un código, úsalo para entrar en el de tus compañeros."
            action={
              <BtnLink href="/empezar" variant="accent" size="sm">
                Empezar
              </BtnLink>
            }
          />
        </Card>
      </div>
    );
  }

  return <Roster />;
}
