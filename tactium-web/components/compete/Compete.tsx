"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/lib/session";
import { BtnLink, Card, Segmented } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { SeasonsList } from "@/components/seasons/SeasonsList";
import { ClubSchedule } from "@/components/club/ClubSchedule";
import { FederationPicker } from "@/components/federation/Federation";
import { ExploreTournaments } from "@/components/tournaments/ExploreTournaments";
import { IconCalendar, IconCreditCard, IconPlus, IconTrophy, IconUsers } from "@/components/Icon";

/**
 * «Competir»: liga, federación y torneos bajo un mismo apartado, con el
 * selector arriba (como en la app). Cada vista es la pantalla de siempre,
 * embebida tal cual; las rutas antiguas (`/temporadas`, `/federacion`,
 * `/torneos`…) siguen funcionando y encienden también «Competir» en el menú.
 *
 * La vista elegida se recuerda en este navegador.
 */
type Vista = "liga" | "federacion" | "torneos";

const STORAGE_KEY = "tactium-competir-vista";
const VISTAS: { value: Vista; label: string }[] = [
  { value: "liga", label: "Liga" },
  { value: "federacion", label: "Federación" },
  { value: "torneos", label: "Torneos" },
];

function isVista(v: unknown): v is Vista {
  return v === "liga" || v === "federacion" || v === "torneos";
}

export function Compete() {
  const { role, clubs, clubId, ready } = useSession();
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);
  // Sin liga propia (suelto, organizador), lo natural es empezar por torneos.
  const fallback: Vista = role === "suelto" || tournamentsOnly ? "torneos" : "liga";

  const [vista, setVista] = useState<Vista | null>(null);

  useEffect(() => {
    if (!ready) return;
    let saved: unknown = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* sin storage: vista por defecto */
    }
    setVista(isVista(saved) ? saved : fallback);
  }, [ready, fallback]);

  function choose(v: Vista) {
    setVista(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* sin storage: no se recuerda, sin más */
    }
  }

  return (
    <>
      <div className="tw-page" style={{ marginBottom: 20 }}>
        <Segmented<Vista>
          label="Competir"
          value={vista ?? fallback}
          options={VISTAS}
          onChange={choose}
        />
      </div>

      {vista === null ? (
        <div className="tw-page">
          <SkeletonCard />
        </div>
      ) : vista === "liga" ? (
        <Liga role={role} tournamentsOnly={tournamentsOnly} />
      ) : vista === "federacion" ? (
        <FederationPicker />
      ) : (
        <Torneos isClub={role === "club"} tournamentsOnly={tournamentsOnly} />
      )}
    </>
  );
}

function Liga({ role, tournamentsOnly }: { role: string; tournamentsOnly: boolean }) {
  if (role === "capitan" || role === "jugador") return <SeasonsList />;
  if (role === "club" && !tournamentsOnly) return <ClubSchedule />;

  // Suelto u organizador: no hay liga que enseñar todavía.
  return (
    <div className="tw-page">
      <Card>
        {tournamentsOnly ? (
          <EmptyState
            icon={<IconCalendar size={22} />}
            title="La liga llega con los equipos"
            body="Activa la gestión de equipos y tendrás jornadas, alineaciones y horarios de local, sin perder tus torneos."
            action={
              <BtnLink href="/equipo" variant="accent" size="sm">
                Activar equipos
              </BtnLink>
            }
          />
        ) : (
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Aún no juegas en ninguna liga"
            body="Crea tu equipo o únete al de tus compañeros y aquí verás las temporadas y jornadas."
            action={
              <BtnLink href="/empezar" variant="accent" size="sm">
                Crear o unirme
              </BtnLink>
            }
          />
        )}
      </Card>
    </div>
  );
}

function Torneos({ isClub, tournamentsOnly }: { isClub: boolean; tournamentsOnly: boolean }) {
  return (
    <>
      <div
        className="tw-page"
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        <BtnLink href="/torneos/mios" size="sm" icon={<IconTrophy size={15} />}>
          Mis torneos
        </BtnLink>
        {isClub ? (
          <>
            <BtnLink href="/club/torneos" size="sm" icon={<IconPlus size={15} />}>
              {tournamentsOnly ? "Gestionar torneos" : "Torneos del club"}
            </BtnLink>
            <BtnLink href="/club/cobros" size="sm" variant="quiet" icon={<IconCreditCard size={15} />}>
              Cobros
            </BtnLink>
          </>
        ) : (
          <BtnLink href="/torneos/organizar" size="sm" variant="quiet" icon={<IconPlus size={15} />}>
            Organizar un torneo
          </BtnLink>
        )}
      </div>
      <ExploreTournaments />
    </>
  );
}
