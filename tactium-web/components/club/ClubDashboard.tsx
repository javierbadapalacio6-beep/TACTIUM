"use client";

import Link from "next/link";
import { useState } from "react";

import {
  coverTeam,
  deleteClub,
  fetchClub,
  fetchClubTeams,
  type DbClubTeam,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  IconTile,
  Input,
  ListRow,
  Modal,
  Note,
  PageHeader,
  Progress,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconBuilding,
  IconClock,
  IconCreditCard,
  IconFlag,
  IconPlus,
  IconReceipt,
  IconSettings,
  IconShield,
} from "@/components/Icon";
import { EditClubModal } from "@/components/club/EditClubModal";

interface ClubData {
  club: { id: string; name: string; federation: string | null } | null;
  teams: DbClubTeam[];
}

const SHORTCUTS = [
  {
    href: "/club/horarios",
    title: "Horarios de local",
    body: "Día, hora y pista de los equipos que juegan en casa",
    Icon: IconClock,
  },
  {
    href: "/club/importar",
    title: "Importar de la Federación",
    body: "Trae equipos y plantillas desde la FCP",
    Icon: IconFlag,
  },
  {
    href: "/club/cobros",
    title: "Cobrar inscripciones",
    body: "Alta en Stripe para cobrar los torneos",
    Icon: IconCreditCard,
  },
  {
    href: "/club/facturacion",
    title: "Facturación del club",
    body: "Plan, equipos cubiertos y próxima renovación",
    Icon: IconReceipt,
  },
];

export function ClubDashboard() {
  const { clubId } = useSession();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading, error } = useAsync<ClubData>(
    async () => {
      const [club, teams] = await Promise.all([
        fetchClub(clubId!),
        fetchClubTeams(clubId!),
      ]);
      return { club, teams };
    },
    [clubId, reloadKey],
    !!clubId
  );

  if (!clubId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="Sin club activo"
            body="Crea un club o pide que te añadan como administrador."
            action={
              <BtnLink href="/empezar/club" variant="accent">
                Crear club
              </BtnLink>
            }
          />
        </Card>
      </div>
    );
  }
  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="No se pudo cargar el club"
            body={error}
          />
        </Card>
      </div>
    );
  }

  const club = data?.club;
  const teams = data?.teams ?? [];
  const covered = teams.filter((t) => t.covered).length;
  const unconfigured = teams.filter((t) => !t.category).length;
  const nameOk = !!club && typed.trim() === club.name;
  const pct = teams.length ? Math.round((covered / teams.length) * 100) : 0;

  async function doDeleteClub() {
    if (!club || busy || !nameOk) return;
    setBusy(true);
    const res = await guardedWrite("borrar el club", () => deleteClub(club.id));
    setBusy(false);
    if (!res.ok) {
      setDeleteOpen(false);
      setToast(res.reason);
      return;
    }
    window.location.href = "/";
  }

  async function doCoverTeam(teamId: string) {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("cubrir el equipo", () => coverTeam(teamId));
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Equipo cubierto con la suscripción del club");
    } else setToast(res.reason);
  }

  return (
    <div className="tw-page">
      <PageHeader
        title={club?.name ?? "Club"}
        meta={[
          club?.federation ? club.federation.toUpperCase() : "Sin federación",
          `${teams.length} ${teams.length === 1 ? "equipo" : "equipos"}`,
        ]}
        actions={
          <>
            {club && (
              <Btn onClick={() => setEditOpen(true)} icon={<IconSettings size={15} />}>
                Editar club
              </Btn>
            )}
            <BtnLink href="/club/equipos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
              Nuevo equipo
            </BtnLink>
          </>
        }
      />

      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Equipos" value={teams.length} icon={<IconShield size={14} />} />
        <Stat
          label="Cubiertos por el plan"
          value={covered}
          unit={`/ ${teams.length}`}
          tone={teams.length > 0 && covered === teams.length ? "accent" : undefined}
          sub={
            teams.length === 0
              ? "Aún sin equipos"
              : covered === teams.length
                ? "Todos los equipos cubiertos"
                : `${teams.length - covered} sin cubrir`
          }
        >
          <Progress value={pct} style={{ marginTop: 10 }} />
        </Stat>
        <Stat
          label="Sin configurar"
          value={unconfigured}
          tone={unconfigured > 0 ? "warning" : undefined}
          sub={unconfigured > 0 ? "Falta categoría o género" : "Todo configurado"}
        />
      </StatRow>

      <div className="tw-club-grid" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)" }}>
        {/* ── Equipos ─────────────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Equipos" count={teams.length}>
            <Link href="/club/equipos" className="link-action">
              Ver todos
            </Link>
          </CardHead>
          {teams.length === 0 ? (
            <EmptyState
              compact
              icon={<IconShield size={22} />}
              title="Aún no hay equipos"
              body="Da de alta el primero y asígnale un capitán."
              action={
                <BtnLink href="/club/equipos/nuevo" variant="accent" size="sm" icon={<IconPlus size={14} />}>
                  Crear equipo
                </BtnLink>
              }
            />
          ) : (
            /* Lista, no tabla: esta tarjeta vive en la columna estrecha del
               panel y una tabla de cuatro columnas se corta. El detalle
               tabular completo está en «Equipos». */
            teams.map((t) => (
              <ListRow
                key={t.id}
                href={`/club/equipos/${t.id}`}
                icon={
                  <IconTile small>
                    <IconShield size={14} />
                  </IconTile>
                }
                title={t.name}
                sub={
                  [t.category, t.gender].filter(Boolean).join(" · ") ||
                  "Sin categoría"
                }
                right={
                  t.covered ? (
                    <Chip>Cubierto</Chip>
                  ) : (
                    <button
                      type="button"
                      className="chip chip-warning"
                      disabled={busy}
                      onClick={(e) => {
                        // La fila entera es un enlace: sin esto, cubrir al
                        // equipo te sacaría de la pantalla.
                        e.preventDefault();
                        e.stopPropagation();
                        void doCoverTeam(t.id);
                      }}
                      title="Cubrir con la suscripción del club"
                    >
                      Cubrir
                    </button>
                  )
                }
              />
            ))
          )}
        </Card>

        {/* ── Gestión ─────────────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Gestión del club" />
          {SHORTCUTS.map((s) => (
            <ListRow
              key={s.href}
              href={s.href}
              icon={
                <IconTile>
                  <s.Icon size={16} />
                </IconTile>
              }
              title={s.title}
              sub={s.body}
            />
          ))}
        </Card>
      </div>

      {/* ── Zona de peligro ───────────────────────────────────────── */}
      <Card danger style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <IconTile mute style={{ color: "var(--error)", background: "var(--error-soft)" }}>
          <IconAlert size={16} />
        </IconTile>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Borrar club</div>
          <div style={{ marginTop: 3, fontSize: 13, color: "var(--text-muted)" }}>
            Se eliminan el club, sus equipos, sus jornadas y sus actas. No se puede deshacer.
          </div>
        </div>
        <Btn variant="danger-ghost" onClick={() => setDeleteOpen(true)}>
          Borrar club
        </Btn>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        labelledBy="borrar-club"
        title={`¿Borrar ${club?.name}?`}
        lede="Escribe el nombre del club para confirmar."
        footer={
          <>
            <Btn onClick={() => setDeleteOpen(false)}>Cancelar</Btn>
            <Btn
              variant="danger"
              disabled={!nameOk || !WRITES_ENABLED || busy}
              onClick={() => void doDeleteClub()}
            >
              {busy ? "Borrando…" : "Borrar club"}
            </Btn>
          </>
        }
      >
        <Input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={club?.name}
          aria-label="Nombre del club"
          large
          style={{ borderColor: nameOk ? "var(--error)" : undefined }}
        />
        {!WRITES_ENABLED && (
          <Note tone="warning" style={{ marginTop: 14 }}>
            {READ_ONLY_MESSAGE}
          </Note>
        )}
      </Modal>

      {club && (
        <EditClubModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          clubId={club.id}
          initialName={club.name}
          initialFederation={club.federation}
        />
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
