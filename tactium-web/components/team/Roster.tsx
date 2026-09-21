"use client";

import { useEffect, useMemo, useState } from "react";

import { type Position } from "@/lib/team-data";
import {
  captainUnclaimPlayer,
  createPlayer,
  deletePlayer,
  fetchPlayers,
  updatePlayer,
  fetchTeamInvitations,
  createInvitation,
  invitationActive,
  type DbPlayer,
  type DbInvitation,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  Input,
  InputWrap,
  Modal,
  Note,
  PageHeader,
  Segmented,
  Stat,
  StatRow,
  Toggle,
} from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import {
  IconCalendar,
  IconCopy,
  IconFlag,
  IconSearch,
  IconSettings,
  IconUpload,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";
import { EditTeamModal } from "@/components/team/EditTeamModal";

type SortKey = "name" | "pts" | "pos";

const POSITIONS: Position[] = ["Drive", "Revés", "Ambos"];

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Roster() {
  const { activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;

  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync(
    () => fetchPlayers(teamId!),
    [teamId, reloadKey],
    !!teamId
  );
  const PLAYERS: DbPlayer[] = data ?? [];

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("pts");
  const [asc, setAsc] = useState(false);
  const [editing, setEditing] = useState<DbPlayer | null>(null);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Alta o edición de un jugador (el modal usa id="new" para el alta).
  async function savePlayer() {
    if (!editing || !teamId || busy) return;
    if (!editing.name.trim()) {
      setToast("Ponle un nombre al jugador.");
      return;
    }
    setBusy(true);
    const isNew = editing.id === "new";
    const res = await guardedWrite(
      isNew ? "añadir el jugador" : "guardar el jugador",
      () =>
        isNew
          ? createPlayer(teamId, {
              name: editing.name.trim(),
              pts: editing.pts,
              position: editing.position,
            })
          : updatePlayer(editing.id, {
              name: editing.name.trim(),
              pts: editing.pts,
              position: editing.position,
              active: editing.active,
              alias: editing.alias,
            }),
    );
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setReloadKey((k) => k + 1);
      setToast(isNew ? "Jugador añadido" : "Jugador guardado");
    } else {
      setToast(res.reason);
    }
  }

  /**
   * Suelta la ficha de la cuenta a la que está vinculada. Útil cuando alguien
   * se vincula al jugador equivocado: la ficha se queda, la cuenta se va.
   */
  async function unlinkAccount() {
    if (busy || !editing || editing.id === "new" || !editing.userId) return;
    setBusy(true);
    const res = await guardedWrite("desvincular al jugador", () =>
      captainUnclaimPlayer(editing.id),
    );
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setReloadKey((k) => k + 1);
      setToast("Jugador desvinculado de su cuenta");
    } else setToast(res.reason);
  }

  async function removePlayer() {
    if (!editing || editing.id === "new" || busy) return;
    setBusy(true);
    const res = await guardedWrite("eliminar el jugador", () =>
      deletePlayer(editing.id),
    );
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setReloadKey((k) => k + 1);
      setToast("Jugador eliminado");
    } else {
      setToast(res.reason);
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? PLAYERS.filter((p) =>
          (p.name + " " + (p.alias ?? "")).toLowerCase().includes(q)
        )
      : PLAYERS;
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort === "pts") return (a.pts - b.pts) * dir;
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      return a.position.localeCompare(b.position) * dir;
    });
  }, [PLAYERS, query, sort, asc]);

  const avg = PLAYERS.length
    ? Math.round(PLAYERS.reduce((s, p) => s + p.pts, 0) / PLAYERS.length)
    : 0;

  function toggleSort(k: SortKey) {
    if (sort === k) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(k === "name");
    }
  }

  // Invitaciones reales del equipo (se cargan al abrir el modal).
  const [invites, setInvites] = useState<DbInvitation[] | null>(null);
  const [invRole, setInvRole] = useState<"player" | "captain">("player");
  const [invBusy, setInvBusy] = useState(false);

  useEffect(() => {
    if (!inviteOpen || !teamId) return;
    let alive = true;
    setInvites(null);
    fetchTeamInvitations(teamId)
      .then((r) => alive && setInvites(r))
      .catch(() => alive && setInvites([]));
    return () => {
      alive = false;
    };
  }, [inviteOpen, teamId]);

  const activeInvite = (invites ?? []).find(invitationActive) ?? null;

  async function generateInvite() {
    if (invBusy || !teamId) return;
    setInvBusy(true);
    const res = await guardedWrite("crear la invitación", () =>
      createInvitation(teamId, invRole),
    );
    setInvBusy(false);
    if (res.ok) {
      setInvites((prev) => [res.data, ...(prev ?? [])]);
      setToast(`Código creado: ${res.data.code}`);
    } else setToast(res.reason);
  }

  const availableCount = PLAYERS.filter((p) => p.available === true).length;
  const inactiveCount = PLAYERS.filter((p) => !p.active).length;

  return (
    <div className="tw-page">
      <PageHeader
        title={activeTeam?.name ?? "Equipo"}
        lede="La plantilla del equipo: puntos, posición y disponibilidad de cada jugador."
        meta={[
          [activeTeam?.category, activeTeam?.gender].filter(Boolean).join(" · ") || null,
        ]}
        actions={
          teamId ? (
            <>
              <Btn variant="quiet" onClick={() => setInviteOpen(true)} icon={<IconUserPlus size={15} />}>
                Invitar con código
              </Btn>
              <Btn onClick={() => setEditTeamOpen(true)} icon={<IconSettings size={15} />}>
                Editar equipo
              </Btn>
            </>
          ) : undefined
        }
      />

      {/* Cifras */}
      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Jugadores" value={PLAYERS.length} icon={<IconUsers size={14} />} />
        <Stat label="Media de puntos" value={avg} tone="accent" />
        <Stat
          label="Disponibles"
          value={availableCount}
          unit={`/ ${PLAYERS.length}`}
          sub="Para la próxima jornada"
        />
        <Stat
          label="Bajas"
          value={inactiveCount}
          tone={inactiveCount > 0 ? "warning" : undefined}
          sub={inactiveCount > 0 ? "Fuera del banquillo" : "Toda la plantilla activa"}
        />
      </StatRow>

      {/* Barra de acciones */}
      <div className="tw-toolbar">
        <InputWrap icon={<IconSearch size={15} />}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador"
            aria-label="Buscar jugador"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="btn btn-icon"
              style={{ width: 24, minHeight: 24, fontSize: 15, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </InputWrap>
        <span className="tw-toolbar-spacer" />
        <Btn variant="quiet" onClick={() => setScanOpen(true)} icon={<IconUpload size={15} />}>
          Escanear ranking
        </Btn>
        <BtnLink href="/temporadas" variant="quiet" icon={<IconCalendar size={15} />}>
          Escanear calendario
        </BtnLink>
        <BtnLink href="/federacion" icon={<IconFlag size={15} />}>
          Importar de la Federación
        </BtnLink>
        <Btn
          variant="accent"
          icon={<IconUserPlus size={15} />}
          onClick={() =>
            setEditing({
              id: "new",
              name: "",
              alias: null,
              pts: 0,
              position: "Ambos",
              active: true,
              available: null,
              userId: null,
              photoUrl: null,
            })
          }
        >
          Añadir jugador
        </Btn>
      </div>

      {/* Tabla */}
      {!teamId ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={24} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo."
          />
        </Card>
      ) : loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={24} />}
            title="No se pudo cargar la plantilla"
            body={error}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={24} />}
            title={query ? "Sin coincidencias" : "Plantilla vacía"}
            body={
              query
                ? "Prueba con otro nombre o alias."
                : "Añade jugadores a mano o escanea el ranking FEP."
            }
          />
        </Card>
      ) : (
        <Card flush>
          <CardHead title="Plantilla" count={rows.length} />
          <div className="tw-roster-scroll">
            <div className="tw-roster-head">
              {(
                [
                  ["name", "Nombre"],
                  ["pos", "Posición"],
                  ["pts", "Puntos FEP"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleSort(k)}
                  aria-sort={
                    sort === k ? (asc ? "ascending" : "descending") : "none"
                  }
                  className="tw-sort-btn"
                  style={{ color: sort === k ? "var(--accent)" : undefined }}
                >
                  {label}
                  {sort === k && <span>{asc ? " ↑" : " ↓"}</span>}
                </button>
              ))}
              <span>Disponibilidad</span>
              <span />
            </div>

            {rows.map((p) => (
              <div key={p.id} className="tw-roster-row">
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    minWidth: 0,
                  }}
                >
                  <Avatar initials={initials(p.name)} src={p.photoUrl} size={30} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      className="truncate"
                      style={{
                        display: "block",
                        fontSize: 13.5,
                        fontWeight: 700,
                      }}
                    >
                      {p.name}
                    </span>
                    {p.alias && (
                      <span
                        className="truncate"
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 12,
                          color: "var(--text-faint)",
                        }}
                      >
                        {p.alias}
                      </span>
                    )}
                  </span>
                </span>

                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {p.position}
                </span>

                <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                  {p.pts}
                </span>

                <span>
                  {!p.active ? (
                    <Chip tone="warning">Baja</Chip>
                  ) : p.available === true ? (
                    <Chip>Disponible</Chip>
                  ) : p.available === false ? (
                    <Chip tone="error">No puede</Chip>
                  ) : (
                    <Chip tone="mute">Sin marcar</Chip>
                  )}
                </span>

                <Btn
                  size="sm"
                  variant="quiet"
                  onClick={() => setEditing(p)}
                  aria-label={`Editar ${p.name}`}
                >
                  Editar
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Editar jugador ───────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        labelledBy="edit-jugador"
        width={520}
        title={editing?.id === "new" ? "Añadir jugador" : "Editar jugador"}
        footer={
          editing ? (
            <>
              {editing.id !== "new" && (
                <Btn
                  variant="danger-ghost"
                  disabled={busy}
                  onClick={removePlayer}
                  style={{ marginRight: "auto" }}
                >
                  Eliminar
                </Btn>
              )}
              {editing.id !== "new" && editing.userId && (
                <Btn variant="quiet" disabled={busy} onClick={() => void unlinkAccount()}>
                  Desvincular cuenta
                </Btn>
              )}
              <Btn onClick={() => setEditing(null)}>Cancelar</Btn>
              <Btn variant="accent" disabled={busy} onClick={savePlayer}>
                {busy ? "Guardando…" : "Guardar"}
              </Btn>
            </>
          ) : null
        }
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Nombre" htmlFor="jugador-nombre">
              <Input
                id="jugador-nombre"
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nombre y apellidos"
              />
            </Field>
            <Field label="Alias" hint="Opcional: cómo le llaman en el equipo" htmlFor="jugador-alias">
              <Input
                id="jugador-alias"
                type="text"
                value={editing.alias ?? ""}
                onChange={(e) => setEditing({ ...editing, alias: e.target.value })}
                placeholder="Cómo le llaman en el equipo"
              />
            </Field>

            <Field label="Posición">
              <Segmented
                label="Posición"
                value={editing.position}
                onChange={(o) => setEditing({ ...editing, position: o })}
                options={POSITIONS.map((o) => ({ value: o, label: o }))}
                style={{ alignSelf: "flex-start" }}
              />
            </Field>

            <Field label="Puntos FEP" htmlFor="jugador-pts">
              <Input
                id="jugador-pts"
                type="text"
                inputMode="numeric"
                className="mono"
                value={editing.pts || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    pts: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                  })
                }
              />
            </Field>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 14,
                borderRadius: 10,
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                  Marcar como baja
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  No aparecerá en el banquillo de la alineación
                </span>
              </span>
              <Toggle
                on={!editing.active}
                onChange={() => setEditing({ ...editing, active: !editing.active })}
                label="Marcar como baja"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Invitación ───────────────────────────────────────────── */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        labelledBy="invitar"
        width={460}
        title={`Invitar a ${activeTeam?.name ?? "tu equipo"}`}
        lede="Comparte el código para que se unan desde la app o la web."
        footer={<Btn onClick={() => setInviteOpen(false)}>Listo</Btn>}
      >
        {invites === null ? (
          <Note>Cargando códigos…</Note>
        ) : activeInvite ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 18px",
                borderRadius: 10,
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                  }}
                >
                  {activeInvite.code}
                </span>
                <span style={{ display: "inline-flex", marginTop: 8 }}>
                  <Chip tone="mute" plain>
                    {activeInvite.role === "captain" ? "Capitán" : "Jugador"}
                  </Chip>
                </span>
              </span>
              <button
                type="button"
                aria-label="Copiar código"
                className="btn btn-icon"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(activeInvite.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    /* el código se ve y se puede copiar a mano */
                  }
                }}
                style={{ color: copied ? "var(--accent)" : undefined }}
              >
                <IconCopy size={17} />
              </button>
            </div>
            <p
              aria-live="polite"
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                fontWeight: 600,
                color: copied ? "var(--accent)" : "transparent",
              }}
            >
              {copied ? "Copiado" : "·"}
            </p>
          </>
        ) : (
          <Note>Aún no hay códigos activos. Genera uno abajo.</Note>
        )}

        {/* Generar un código nuevo con el rol elegido. */}
        <div style={{ marginTop: 18 }}>
          <Field label="Nuevo código">
            <Segmented
              label="Rol de la invitación"
              value={invRole}
              onChange={setInvRole}
              options={[
                { value: "player", label: "Jugador" },
                { value: "captain", label: "Capitán" },
              ]}
              style={{ alignSelf: "flex-start" }}
            />
          </Field>
          <Btn
            variant="accent"
            block
            onClick={generateInvite}
            disabled={invBusy}
            icon={<IconUserPlus size={15} />}
            style={{ marginTop: 10 }}
          >
            {invBusy ? "Generando…" : "Generar código"}
          </Btn>
        </div>
      </Modal>

      {/* ── Escanear ranking ─────────────────────────────────────── */}
      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        labelledBy="escanear"
        width={520}
        title="Escanear ranking"
        lede="En el móvil esto se hace con la cámara. Aquí, arrastrando el archivo."
        footer={
          <>
            <Btn onClick={() => setScanOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled>
              Importar jugadores
            </Btn>
          </>
        }
      >
        <label
          className="card card-quiet"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "32px 20px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <IconTile>
            <IconUpload size={16} />
          </IconTile>
          <span style={{ fontSize: 13, color: "var(--text-muted)", textWrap: "pretty" }}>
            Arrastra una imagen o un PDF, o pega desde el portapapeles
          </span>
          <input type="file" accept="image/*,.pdf" hidden />
        </label>
      </Modal>

      {teamId && (
        <EditTeamModal
          open={editTeamOpen}
          onClose={() => setEditTeamOpen(false)}
          teamId={teamId}
          teamName={activeTeam?.name ?? "Equipo"}
          initialCategory={activeTeam?.category ?? null}
          onDeleted={() => {
            // Recarga completa: la sesión cachea equipos y el que acabamos de
            // borrar seguiría apareciendo en el selector.
            window.location.href = "/";
          }}
        />
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
