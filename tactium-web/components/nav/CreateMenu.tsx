"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { fetchClubTeams, fetchSeasons, type DbClubTeam } from "@/lib/queries";
import { useSession, type Role } from "@/lib/session";
import { Btn, Card, Field, IconTile, ListRow, Modal, Note, Select } from "@/components/ui";
import { Skeleton, Toast } from "@/components/states";
import { InvitePanel } from "@/components/invite/InvitePanel";
import {
  IconCalendar,
  IconShield,
  IconTrophy,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";

/**
 * «＋ Crear»: las acciones rápidas del rol, con los mismos textos que la app.
 * Cada acción lleva a la pantalla que ya existe; sólo las invitaciones se
 * resuelven aquí mismo, en un modal con el `InvitePanel` de siempre.
 */
type ActionKey =
  | "jornada"
  | "amistoso"
  | "invitarPlantilla"
  | "torneo"
  | "unirme"
  | "crearTorneo"
  | "nuevoEquipo"
  | "invitarCapitan";

interface Action {
  key: ActionKey;
  title: string;
  sub: string;
  icon: ReactNode;
  /** Destino directo; sin él, la acción se resuelve en el propio menú. */
  href?: string;
}

const A: Record<ActionKey, Action> = {
  jornada: {
    key: "jornada",
    title: "Nueva jornada",
    sub: "En la temporada activa de tu equipo",
    icon: <IconCalendar size={16} />,
  },
  amistoso: {
    key: "amistoso",
    title: "Registrar amistoso",
    sub: "Apunta el resultado y suma a tu récord",
    icon: <IconUsers size={16} />,
    href: "/amistosos/nuevo",
  },
  invitarPlantilla: {
    key: "invitarPlantilla",
    title: "Invitar a la plantilla",
    sub: "Comparte el enlace de tu equipo",
    icon: <IconUserPlus size={16} />,
  },
  torneo: {
    key: "torneo",
    title: "Apuntarme a un torneo",
    sub: "Torneos con inscripción abierta",
    icon: <IconTrophy size={16} />,
    href: "/torneos",
  },
  unirme: {
    key: "unirme",
    title: "Unirme a un equipo",
    sub: "Con el código que te han pasado",
    icon: <IconShield size={16} />,
    href: "/ajustes/invitaciones",
  },
  crearTorneo: {
    key: "crearTorneo",
    title: "Crear torneo",
    sub: "Inscripción online, cuadro y horarios",
    icon: <IconTrophy size={16} />,
    // `?nuevo=1`: la pantalla de torneos del club abre directamente el
    // formulario de creación en vez de la lista.
    href: "/club/torneos?nuevo=1",
  },
  nuevoEquipo: {
    key: "nuevoEquipo",
    title: "Nuevo equipo",
    sub: "Da de alta un equipo del club",
    icon: <IconShield size={16} />,
    href: "/club/equipos/nuevo",
  },
  invitarCapitan: {
    key: "invitarCapitan",
    title: "Invitar capitán",
    sub: "Para que gestione uno de tus equipos",
    icon: <IconUserPlus size={16} />,
  },
};

function actionsFor(role: Role, tournamentsOnly: boolean): Action[] {
  if (role === "club") {
    return tournamentsOnly ? [A.crearTorneo] : [A.crearTorneo, A.nuevoEquipo, A.invitarCapitan];
  }
  if (role === "capitan") return [A.jornada, A.amistoso, A.invitarPlantilla, A.torneo];
  return [A.amistoso, A.unirme, A.torneo];
}

export function CreateMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { role, clubs, clubId, activeTeam } = useSession();
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);

  const [invite, setInvite] = useState<"plantilla" | "capitan" | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Al cerrar el menú, el siguiente se abre limpio.
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  /** «Nueva jornada»: a la temporada activa con el formulario ya abierto. */
  async function nuevaJornada() {
    const teamId = activeTeam?.id;
    if (!teamId) return go("/temporadas");
    setBusy(true);
    try {
      const seasons = await fetchSeasons(teamId);
      const active = seasons.find((s) => s.active) ?? null;
      go(active ? `/temporadas/${active.id}?nueva=1` : "/temporadas");
    } catch {
      go("/temporadas");
    }
  }

  function run(a: Action) {
    if (busy) return;
    if (a.href) return go(a.href);
    if (a.key === "jornada") return void nuevaJornada();
    if (a.key === "invitarPlantilla") {
      onClose();
      setInvite("plantilla");
      return;
    }
    if (a.key === "invitarCapitan") {
      onClose();
      setInvite("capitan");
    }
  }

  const actions = actionsFor(role, tournamentsOnly);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        labelledBy="crear-menu"
        width={440}
        title="Crear"
        lede="Lo que más se hace, a un toque."
      >
        <Card flush>
          {actions.map((a) => (
            <ListRow
              key={a.key}
              icon={<IconTile small>{a.icon}</IconTile>}
              title={a.title}
              sub={a.key === "jornada" && busy ? "Buscando la temporada activa…" : a.sub}
              onClick={() => run(a)}
            />
          ))}
        </Card>
      </Modal>

      {invite === "plantilla" && (
        <Modal
          open
          onClose={() => setInvite(null)}
          labelledBy="crear-invitar-plantilla"
          width={460}
          title={`Invitar a ${activeTeam?.name ?? "tu equipo"}`}
          lede="Comparte el enlace: se unen gratis desde la app o desde la web."
          footer={<Btn onClick={() => setInvite(null)}>Listo</Btn>}
        >
          {activeTeam ? (
            <InvitePanel teamId={activeTeam.id} teamName={activeTeam.name} onToast={setToast} />
          ) : (
            <Note>Necesitas un equipo activo para invitar.</Note>
          )}
        </Modal>
      )}

      {invite === "capitan" && (
        <ClubCaptainInvite clubId={clubId} onClose={() => setInvite(null)} onToast={setToast} />
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </>
  );
}

/** «Invitar capitán» del club: se elige el equipo y sale su panel de invitación. */
function ClubCaptainInvite({
  clubId,
  onClose,
  onToast,
}: {
  clubId: string | null;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [teams, setTeams] = useState<DbClubTeam[] | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) {
      setTeams([]);
      return;
    }
    let alive = true;
    fetchClubTeams(clubId)
      .then((t) => {
        if (!alive) return;
        setTeams(t);
        setTeamId(t[0]?.id ?? null);
      })
      .catch(() => alive && setTeams([]));
    return () => {
      alive = false;
    };
  }, [clubId]);

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="crear-invitar-capitan"
      width={460}
      title="Invitar capitán"
      lede="Elige el equipo. El código de capitán es de un solo uso; el enlace de jugadores sirve para toda la plantilla."
      footer={<Btn onClick={onClose}>Listo</Btn>}
    >
      {teams === null ? (
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton h={14} w="60%" />
          <Skeleton h={14} w="40%" />
        </div>
      ) : teams.length === 0 ? (
        <Note>
          Aún no hay equipos en el club. Crea uno primero con «Nuevo equipo».
        </Note>
      ) : (
        <>
          {teams.length > 1 && (
            <Field label="Equipo" htmlFor="crear-capitan-equipo" style={{ marginBottom: 16 }}>
              <Select
                id="crear-capitan-equipo"
                value={teamId ?? ""}
                onChange={(e) => setTeamId(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {teamId && (
            <InvitePanel
              key={teamId}
              teamId={teamId}
              teamName={teams.find((t) => t.id === teamId)?.name ?? "tu equipo"}
              onToast={onToast}
            />
          )}
        </>
      )}
    </Modal>
  );
}

