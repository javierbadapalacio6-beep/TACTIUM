"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { type Position } from "@/lib/team-data";
import { fetchPlayers, type DbPlayer } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow, Modal, Toggle } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconCalendar,
  IconCopy,
  IconFlag,
  IconSearch,
  IconUpload,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";

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

  const { data, loading, error } = useAsync(
    () => fetchPlayers(teamId!),
    [teamId],
    !!teamId
  );
  const PLAYERS: DbPlayer[] = data ?? [];

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("pts");
  const [asc, setAsc] = useState(false);
  const [editing, setEditing] = useState<DbPlayer | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const INVITE = "HLC-4X2";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>EQUIPO</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>{activeTeam?.name ?? "Equipo"}</h1>
      </div>

      {/* Indicadores */}
      <div className="tw-solo-stats" style={{ marginBottom: 20 }}>
        {[
          { label: "JUGADORES", value: String(PLAYERS.length) },
          { label: "MEDIA", value: String(avg), accent: true },
          {
            label: "DISPONIBLES",
            value: String(PLAYERS.filter((p) => p.available === true).length),
          },
          {
            label: "BAJAS",
            value: String(PLAYERS.filter((p) => !p.active).length),
          },
        ].map((k) => (
          <Card key={k.label} style={{ padding: 18 }}>
            <div className="mono tw-stat-label">{k.label}</div>
            <div
              className="mono tw-stat-value"
              style={{
                fontSize: 24,
                ...(k.accent ? { color: "var(--accent)" } : null),
              }}
            >
              {k.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Barra de acciones */}
      <Card style={{ marginBottom: 20, padding: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--hair-strong)",
              background: "var(--bg-card-2)",
              flex: 1,
              minWidth: 220,
            }}
          >
            <IconSearch size={15} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar jugador"
              aria-label="Buscar jugador"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                color: "var(--text)",
                fontSize: 13.5,
                outline: "none",
                fontFamily: "'Satoshi', sans-serif",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                  fontSize: 15,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          <button
            className="btn btn-accent"
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
            style={{ padding: "11px 18px", fontSize: 13 }}
          >
            <IconUserPlus size={15} />
            Añadir jugador
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setScanOpen(true)}
            style={{ padding: "11px 16px", fontSize: 13 }}
          >
            <IconUpload size={15} />
            Escanear ranking
          </button>
          <Link
            href="/temporadas"
            className="btn btn-ghost"
            style={{ padding: "11px 16px", fontSize: 13 }}
          >
            <IconCalendar size={15} />
            Escanear calendario
          </Link>
          <Link
            href="/federacion"
            className="btn btn-ghost"
            style={{ padding: "11px 16px", fontSize: 13 }}
          >
            <IconFlag size={15} />
            Importar de la Federación
          </Link>
          <button
            className="btn btn-ghost"
            onClick={() => setInviteOpen(true)}
            style={{ padding: "11px 16px", fontSize: 13 }}
          >
            Invitar con código
          </button>
        </div>
      </Card>

      {/* Tabla */}
      {!teamId ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo."
          />
        </Card>
      ) : loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title="No se pudo cargar la plantilla"
            body={error}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title={query ? "Sin coincidencias" : "Plantilla vacía"}
            body={
              query
                ? "Prueba con otro nombre o alias."
                : "Añade jugadores a mano o escanea el ranking FEP."
            }
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
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
                  className="mono tw-sort-btn"
                  style={{ color: sort === k ? "var(--accent)" : undefined }}
                >
                  {label}
                  {sort === k && <span>{asc ? " ↑" : " ↓"}</span>}
                </button>
              ))}
              <span className="mono">Disponibilidad</span>
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
                  <span
                    className="mono"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: "var(--primary-dim)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10.5,
                      fontWeight: 700,
                      flex: "none",
                    }}
                  >
                    {initials(p.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
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
                        style={{
                          display: "block",
                          marginTop: 2,
                          fontSize: 11.5,
                          color: "var(--text-faint)",
                        }}
                      >
                        {p.alias}
                      </span>
                    )}
                  </span>
                </span>

                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.16em",
                    color: "var(--text-muted)",
                  }}
                >
                  {p.position.toUpperCase()}
                </span>

                <span
                  className="mono"
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}
                >
                  {p.pts}
                </span>

                <span>
                  {!p.active ? (
                    <span className="chip chip-warning">Baja</span>
                  ) : p.available === true ? (
                    <span className="chip">Disponible</span>
                  ) : p.available === false ? (
                    <span
                      className="chip"
                      style={{
                        color: "var(--error)",
                        borderColor: "var(--error)",
                      }}
                    >
                      No puede
                    </span>
                  ) : (
                    <span className="chip chip-mute">Sin marcar</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="mono tw-edit-btn"
                  aria-label={`Editar ${p.name}`}
                >
                  EDITAR
                </button>
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
      >
        {editing && (
          <>
            <h2 id="edit-jugador" style={{ fontSize: 23 }}>
              {editing.id === "new" ? "Añadir jugador" : "Editar jugador"}
            </h2>

            <div
              style={{
                marginTop: 22,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {[
                { label: "NOMBRE", value: editing.name, ph: "Nombre y apellidos" },
                {
                  label: "ALIAS (OPCIONAL)",
                  value: editing.alias ?? "",
                  ph: "Cómo le llaman en el equipo",
                },
              ].map((f) => (
                <label key={f.label}>
                  <span
                    className="mono"
                    style={{
                      display: "block",
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      color: "var(--text-faint)",
                      marginBottom: 7,
                    }}
                  >
                    {f.label}
                  </span>
                  <input
                    type="text"
                    defaultValue={f.value}
                    placeholder={f.ph}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--hair-strong)",
                      background: "var(--bg-card)",
                      color: "var(--text)",
                      fontSize: 14,
                      outline: "none",
                      fontFamily: "'Satoshi', sans-serif",
                    }}
                  />
                </label>
              ))}

              <div>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: "var(--text-faint)",
                    marginBottom: 7,
                  }}
                >
                  POSICIÓN
                </span>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    padding: 4,
                    borderRadius: 12,
                    background: "var(--bg-card-2)",
                  }}
                >
                  {POSITIONS.map((o) => {
                    const on = editing.position === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setEditing({ ...editing, position: o })}
                        style={{
                          flex: 1,
                          padding: "9px 10px",
                          borderRadius: 9,
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "'Satoshi', sans-serif",
                          fontSize: 13,
                          fontWeight: on ? 700 : 500,
                          background: on ? "var(--accent-10)" : "transparent",
                          color: on ? "var(--accent)" : "var(--text-muted)",
                          boxShadow: on
                            ? "inset 0 0 0 1.5px var(--accent)"
                            : "none",
                        }}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: "var(--text-faint)",
                    marginBottom: 7,
                  }}
                >
                  PUNTOS FEP
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  defaultValue={editing.pts || ""}
                  className="mono"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--hair-strong)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--bg-card-2)",
                }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                    Marcar como baja
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 5,
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

            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {editing.id !== "new" && (
                <button
                  className="btn btn-danger-ghost"
                  style={{ padding: "12px 18px", fontSize: 13.5, marginRight: "auto" }}
                >
                  Eliminar
                </button>
              )}
              <button
                className="btn btn-ghost"
                onClick={() => setEditing(null)}
                style={{ padding: "12px 20px", fontSize: 13.5 }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-accent"
                onClick={() => setEditing(null)}
                style={{ padding: "12px 22px", fontSize: 13.5 }}
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Invitación ───────────────────────────────────────────── */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        labelledBy="invitar"
        width={460}
      >
        <Eyebrow>INVITACIÓN</Eyebrow>
        <h2 id="invitar" style={{ margin: "14px 0 6px", fontSize: 23 }}>
          Invitar jugadores
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            color: "var(--text-muted)",
          }}
        >
          Comparte el código para que se unan desde la app.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "18px 20px",
            borderRadius: 12,
            background: "var(--bg-card-2)",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "var(--accent)",
            }}
          >
            {INVITE}
          </span>
          <button
            type="button"
            aria-label="Copiar código"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(INVITE);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                /* el código se ve y se puede copiar a mano */
              }
            }}
            style={{
              border: "none",
              background: "transparent",
              color: copied ? "var(--accent)" : "var(--text-faint)",
              cursor: "pointer",
              display: "flex",
              padding: 4,
            }}
          >
            <IconCopy size={17} />
          </button>
        </div>

        <p
          className="mono"
          style={{
            marginTop: 14,
            fontSize: 11,
            letterSpacing: "0.06em",
            color: "var(--text-faint)",
            wordBreak: "break-all",
          }}
        >
          tactium.app/unirse/{INVITE}
        </p>

        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setInviteOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Listo
          </button>
        </div>
      </Modal>

      {/* ── Escanear ranking ─────────────────────────────────────── */}
      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        labelledBy="escanear"
        width={520}
      >
        <Eyebrow>ESCANEAR RANKING</Eyebrow>
        <h2 id="escanear" style={{ margin: "14px 0 6px", fontSize: 23 }}>
          Importa la plantilla desde una imagen
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
          En el móvil esto se hace con la cámara. Aquí, arrastrando el archivo.
        </p>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "36px 20px",
            borderRadius: 12,
            border: "1px dashed var(--hair-strong)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <span style={{ color: "var(--accent)" }}>
            <IconUpload size={28} />
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)", textWrap: "pretty" }}>
            Arrastra una imagen o un PDF, o pega desde el portapapeles
          </span>
          <input type="file" accept="image/*,.pdf" hidden />
        </label>

        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setScanOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button className="btn btn-accent" disabled style={{ padding: "12px 22px", fontSize: 13.5 }}>
            Importar jugadores
          </button>
        </div>
      </Modal>
    </div>
  );
}
