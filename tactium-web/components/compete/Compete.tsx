"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useSession } from "@/lib/session";
import { BtnLink, Card, PageHeader } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { SeasonsList } from "@/components/seasons/SeasonsList";
import { ClubSchedule } from "@/components/club/ClubSchedule";
import { FederationForMe } from "@/components/federation/Federation";
import { ExploreTournaments } from "@/components/tournaments/ExploreTournaments";
import { IconCalendar, IconCreditCard, IconPlus, IconTrophy, IconUsers } from "@/components/Icon";

/**
 * «Competir»: liga, federación y torneos bajo un mismo apartado. Título
 * «Competir» y, debajo, las pestañas (como en la app). Cada vista es la
 * pantalla de siempre, embebida; las rutas antiguas (`/temporadas`,
 * `/federacion`, `/torneos`…) siguen funcionando y encienden también
 * «Competir» en el menú.
 *
 * La vista va en la URL (`/competir?vista=liga|federacion|torneos`) para
 * poder enlazarla y volver atrás; sin parámetro, la última elegida en este
 * navegador o la que toque por rol.
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);
  // Sin liga propia (suelto, organizador), lo natural es empezar por torneos.
  const fallback: Vista = role === "suelto" || tournamentsOnly ? "torneos" : "liga";

  const fromUrl = params.get("vista");
  const [saved, setSaved] = useState<Vista | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ready) return;
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (isVista(s)) setSaved(s);
    } catch {
      /* sin storage: vista por defecto */
    }
    setLoaded(true);
  }, [ready]);

  const vista: Vista | null = isVista(fromUrl) ? fromUrl : loaded ? (saved ?? fallback) : null;

  function choose(v: Vista) {
    setSaved(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* sin storage: no se recuerda, sin más */
    }
    const q = new URLSearchParams(params.toString());
    q.set("vista", v);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  return (
    <>
      <div className="tw-page">
        <PageHeader title="Competir" />
        <VistaTabs value={vista ?? fallback} onChange={choose} />
      </div>

      <div id={`competir-${vista ?? fallback}`} role="tabpanel" aria-labelledby={`competir-tab-${vista ?? fallback}`}>
        {vista === null ? (
          <div className="tw-page">
            <SkeletonCard />
          </div>
        ) : vista === "liga" ? (
          <Liga role={role} tournamentsOnly={tournamentsOnly} />
        ) : vista === "federacion" ? (
          <FederationForMe />
        ) : (
          <Torneos isClub={role === "club"} tournamentsOnly={tournamentsOnly} />
        )}
      </div>
    </>
  );
}

/**
 * Pestañas de navegación (no un control de formulario): `role="tablist"`,
 * flechas, Inicio y Fin. Usa las clases del `Segmented` de `ui.tsx`, que
 * es un `radiogroup` y no sirve aquí.
 */
function VistaTabs({ value, onChange }: { value: Vista; onChange: (v: Vista) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const i = VISTAS.findIndex((v) => v.value === value);
    let j = i;
    if (e.key === "ArrowRight") j = (i + 1) % VISTAS.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + VISTAS.length) % VISTAS.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = VISTAS.length - 1;
    else return;
    e.preventDefault();
    onChange(VISTAS[j].value);
    refs.current[j]?.focus();
  }
  return (
    <div className="seg" role="tablist" aria-label="Competir" onKeyDown={onKey} style={{ marginBottom: 20 }}>
      {VISTAS.map((v, i) => {
        const on = v.value === value;
        return (
          <button
            key={v.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`competir-tab-${v.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`competir-${v.value}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(v.value)}
            className={"seg-item" + (on ? " is-on" : "")}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function Liga({ role, tournamentsOnly }: { role: string; tournamentsOnly: boolean }) {
  if (role === "capitan" || role === "jugador") return <SeasonsList embedded />;
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
            title="La liga es cosa de equipos"
            body="Temporadas, jornadas y alineaciones viven en tu equipo. Únete con el enlace de tu capitán o crea uno."
            action={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <BtnLink href="/empezar" variant="accent" size="sm">
                  Crear o unirme
                </BtnLink>
                <BtnLink href="/federacion/cantabra" size="sm">
                  Mientras, mira la Federación
                </BtnLink>
              </div>
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
