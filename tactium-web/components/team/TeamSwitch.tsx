"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/session";
import { Roster } from "@/components/team/Roster";
import { ActivateTeamsCard } from "@/components/club/ActivateTeamsCard";
import { Btn, Card, Input, ListRow, PageHeader } from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import { IconUsers } from "@/components/Icon";
import { Stagger, StaggerItem } from "@/components/entry/motion-bits";

/** Acepta el código suelto o el enlace entero (tactium.io/i/XK8R9P3M). */
function normalizeCode(raw: string): string {
  const m = raw.match(/\/i\/([A-Za-z0-9]+)/);
  return (m ? m[1] : raw).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
}

/**
 * «Equipo» de la navegación única. El capitán y el jugador ven su plantilla;
 * el organizador («solo torneos»), la puerta para activar la gestión de
 * equipos; el jugador suelto, el campo del código en la propia página (antes
 * le mandaba a /empezar). El club con equipos tiene su lista en
 * `/club/equipos` y el menú le lleva allí directamente.
 */
export function TeamSwitch() {
  const { role, ready, clubs, clubId } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  if (!ready) return <SkeletonPage />;

  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);

  if (tournamentsOnly) {
    return (
      <div className="tw-page-narrow">
        <PageHeader title="¿Llevas también equipos de liga?" />
        <ActivateTeamsCard full />
      </div>
    );
  }

  if (role === "suelto") {
    const clean = normalizeCode(code);
    const valid = clean.length >= 6;
    return (
      <div className="tw-page-narrow">
        <PageHeader title="Todavía no estás en un equipo" />
        <Stagger gap={0.07}>
          <StaggerItem>
            <Card>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) router.push(`/i/${clean}`);
                }}
                style={{ display: "grid", gap: 12 }}
              >
                <label htmlFor="codigo-equipo" style={{ fontSize: 15, fontWeight: 700 }}>
                  Me han pasado un enlace o un código
                </label>
                <Input
                  id="codigo-equipo"
                  large
                  className="mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="XK8R9P3M"
                  autoComplete="off"
                  style={{ textAlign: "center", letterSpacing: "0.2em" }}
                />
                <Btn type="submit" variant="accent" block disabled={!valid}>
                  Ver el equipo
                </Btn>
              </form>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card flush style={{ marginTop: 16 }}>
              <ListRow
                href="/empezar"
                icon={<IconUsers size={16} />}
                title="Crear mi equipo"
                sub="Capitán · 14 días gratis, sin tarjeta"
              />
            </Card>
          </StaggerItem>
          <StaggerItem>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 12.5,
                color: "var(--text-faint)",
                textAlign: "center",
              }}
            >
              Mientras tanto, tus amistosos y torneos siguen en Inicio y en Competir.
            </p>
          </StaggerItem>
        </Stagger>
      </div>
    );
  }

  return <Roster />;
}
