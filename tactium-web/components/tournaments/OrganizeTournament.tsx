"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/session";
import { createClub } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { TOURNAMENT_FREE_PAIRS } from "@/lib/tournament-billing";
import { Btn, BtnLink, Card, Field, Input, Note, PageHeader } from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import { IconTrophy } from "@/components/Icon";

/**
 * Organizar un torneo sin ser un club.
 *
 * Un torneo cuelga siempre de un club (es quien cobra las inscripciones y
 * pone las pistas), pero un capitán o un jugador suelto también organiza
 * torneos. La salida es la misma que en la app: crear un club en modo «solo
 * torneos» (`tournaments_only`), sin equipos ni cuota, que hace de espacio de
 * organizador. Quien ya tiene club va directo a sus torneos.
 */
export function OrganizeTournament() {
  const router = useRouter();
  const { user, ready, clubs, role, setRole, availableRoles } = useSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ready && clubs.length > 0) router.replace("/club/torneos");
  }, [ready, clubs.length, router]);

  useEffect(() => {
    if (user && !name) setName(`Torneos de ${user.name.split(" ")[0]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!ready || !user) return <SkeletonPage />;
  if (clubs.length > 0) return <SkeletonPage />;

  async function submit() {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear tu espacio de organizador", () =>
      createClub(name.trim(), null, { tournamentsOnly: true }),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    // Quien ya era capitán sigue viendo su equipo al entrar; el club de
    // torneos queda disponible en el selector de rol.
    if (role !== "club" && availableRoles.includes(role)) setRole(role);
    window.location.href = "/club/torneos";
  }

  return (
    <div className="tw-page-narrow" style={{ maxWidth: 560 }}>
      <PageHeader
        title="Organizar un torneo"
        lede="No hace falta ser un club: creamos tu espacio de organizador y desde ahí montas el cuadro, repartes el horario y publicas resultados."
        back={{ href: "/torneos", label: "Torneos" }}
      />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field
            label="Nombre del organizador"
            hint="Es lo que verán los jugadores al inscribirse. Puedes cambiarlo después."
          >
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Torneos de Javier"
              autoFocus
            />
          </Field>
          <Note tone="accent" icon={<IconTrophy size={15} />}>
            Hasta {TOURNAMENT_FREE_PAIRS} parejas por torneo es gratis; a partir de
            ahí se paga por torneo, sin suscripción. Si algún día quieres llevar
            también equipos, activas la gestión desde el panel.
          </Note>
          {err && <Note tone="error">{err}</Note>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <BtnLink href="/torneos">Cancelar</BtnLink>
            <Btn variant="accent" disabled={busy || name.trim().length < 2} onClick={submit}>
              {busy ? "Creando…" : "Crear espacio y montar torneo"}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
