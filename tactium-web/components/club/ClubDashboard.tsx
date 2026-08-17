"use client";

import Link from "next/link";
import { useState } from "react";

import { fetchClub, fetchClubTeams, type DbClubTeam } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED } from "@/lib/writes";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconBuilding,
  IconChevronRight,
  IconClock,
  IconFlag,
  IconPlus,
  IconSettings,
  IconShield,
} from "@/components/Icon";
import { EditClubModal } from "@/components/club/EditClubModal";

interface ClubData {
  club: { id: string; name: string; federation: string | null } | null;
  teams: DbClubTeam[];
}

export function ClubDashboard() {
  const { clubId } = useSession();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const { data, loading, error } = useAsync<ClubData>(
    async () => {
      const [club, teams] = await Promise.all([
        fetchClub(clubId!),
        fetchClubTeams(clubId!),
      ]);
      return { club, teams };
    },
    [clubId],
    !!clubId
  );

  if (!clubId) {
    return (
      <Card>
        <EmptyState
          icon={<IconBuilding size={34} />}
          title="Sin club activo"
          body="Crea un club o pide que te añadan como administrador."
          action={
            <Link href="/empezar/club" className="btn btn-accent" style={{ padding: "13px 22px" }}>
              Crear club
            </Link>
          }
        />
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconBuilding size={34} />}
          title="No se pudo cargar el club"
          body={error}
        />
      </Card>
    );
  }

  const club = data?.club;
  const teams = data?.teams ?? [];
  const covered = teams.filter((t) => t.covered).length;
  const nameOk = !!club && typed.trim() === club.name;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>CLUB · ADMIN</Eyebrow>
          <h1 style={{ marginTop: 10, fontSize: 32 }}>{club?.name ?? "Club"}</h1>
          {club?.federation && (
            <p
              className="mono"
              style={{
                margin: "8px 0 0",
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--text-faint)",
              }}
            >
              {club.federation.toUpperCase()}
            </p>
          )}
        </div>
        {club && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditOpen(true)}
            style={{ padding: "10px 16px", fontSize: 13 }}
          >
            <IconSettings size={14} />
            Editar club
          </button>
        )}
      </div>

      <div className="tw-solo-stats" style={{ marginBottom: 24 }}>
        {[
          { l: "EQUIPOS", v: String(teams.length) },
          { l: "CUBIERTOS", v: `${covered}/${teams.length}`, accent: true },
          {
            l: "SIN CONFIGURAR",
            v: String(teams.filter((t) => !t.category).length),
          },
        ].map((k) => (
          <Card key={k.l} style={{ padding: 20 }}>
            <div className="mono tw-stat-label">{k.l}</div>
            <div
              className="mono tw-stat-value"
              style={{ fontSize: 26, ...(k.accent ? { color: "var(--accent)" } : null) }}
            >
              {k.v}
            </div>
          </Card>
        ))}
      </div>

      <section style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <Eyebrow>EQUIPOS</Eyebrow>
          <Link
            href="/club/equipos/nuevo"
            className="btn btn-accent"
            style={{ padding: "11px 18px", fontSize: 13 }}
          >
            <IconPlus size={15} />
            Crear nuevo equipo
          </Link>
        </div>

        {teams.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconShield size={34} />}
              title="Aún no hay equipos"
              body="Da de alta el primero y asígnale un capitán."
            />
          </Card>
        ) : (
          <div className="tw-club-teams">
            {teams.map((t) => (
              <Link key={t.id} href={`/club/equipos/${t.id}`} style={{ color: "inherit" }}>
                <Card style={{ padding: 20, height: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: "var(--primary-dim)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "none",
                      }}
                    >
                      <IconShield size={17} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {t.name}
                      </span>
                      <span
                        className="mono"
                        style={{
                          display: "block",
                          marginTop: 4,
                          fontSize: 9.5,
                          letterSpacing: "0.14em",
                          color: "var(--text-faint)",
                        }}
                      >
                        {[t.category, t.gender].filter(Boolean).join(" · ").toUpperCase() ||
                          "SIN CATEGORÍA"}
                      </span>
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {t.covered ? (
                      <span className="chip">Cubierto</span>
                    ) : (
                      <span className="chip chip-warning">No cubierto</span>
                    )}
                    <div style={{ flex: 1 }} />
                    <span
                      style={{
                        fontSize: 12.5,
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Gestionar <IconChevronRight size={14} />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="tw-shortcuts">
        {[
          { href: "/club/horarios", title: "Horarios de local", Icon: IconClock },
          { href: "/federacion", title: "Importar de la Federación", Icon: IconFlag },
          { href: "/club/facturacion", title: "Facturación del club", Icon: IconBuilding },
        ].map((s) => (
          <Link key={s.href} href={s.href} style={{ color: "inherit" }}>
            <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--accent-10)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <s.Icon size={17} />
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{s.title}</span>
              <IconChevronRight size={16} />
            </Card>
          </Link>
        ))}
      </div>

      <Card danger style={{ marginTop: 28 }}>
        <Eyebrow tone="error">ZONA DE PELIGRO</Eyebrow>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Borrar club</div>
            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: "var(--text-muted)",
                maxWidth: "56ch",
                textWrap: "pretty",
              }}
            >
              Se eliminan el club, sus equipos, sus jornadas y sus actas. No se
              puede deshacer.
            </div>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => setDeleteOpen(true)}
            style={{ padding: "11px 20px", fontSize: 13.5 }}
          >
            Borrar club
          </button>
        </div>
      </Card>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} labelledBy="borrar-club">
        <h2 id="borrar-club" style={{ fontSize: 23 }}>
          ¿Borrar {club?.name}?
        </h2>
        <p
          style={{
            margin: "10px 0 20px",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          Escribe el nombre del club para confirmar.
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={club?.name}
          aria-label="Nombre del club"
          style={{
            width: "100%",
            padding: "13px 15px",
            borderRadius: 12,
            border: `1px solid ${nameOk ? "var(--error)" : "var(--hair-strong)"}`,
            background: "var(--bg-card)",
            color: "var(--text)",
            fontSize: 14.5,
            outline: "none",
            fontFamily: "'Satoshi', sans-serif",
          }}
        />
        {!WRITES_ENABLED && (
          <p
            style={{
              margin: "16px 0 0",
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--warning-soft)",
              border: "1px solid var(--warning)",
              color: "var(--warning)",
              fontSize: 12.5,
            }}
          >
            {READ_ONLY_MESSAGE}
          </p>
        )}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setDeleteOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            disabled={!nameOk || !WRITES_ENABLED}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            Borrar club
          </button>
        </div>
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
    </div>
  );
}
