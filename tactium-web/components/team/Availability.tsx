"use client";

import { useEffect, useMemo, useState } from "react";

import { type Availability as Av, type Position } from "@/lib/team-data";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  clearPlayerAvailability,
  fetchAvailability,
  fetchMatchday,
  fetchPlayers,
  setPlayerAvailability,
  setSelfAvailability,
  type DbMatchday,
} from "@/lib/queries";
import { guardedWrite, WRITES_ENABLED } from "@/lib/writes";
import {
  Avatar,
  Btn,
  Card,
  Chip,
  Note,
  PageHeader,
  Progress,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCheck, IconUsers } from "@/components/Icon";

type Filter = "todos" | "disp" | "bajas";

/** Fila de la plantilla con su estado de disponibilidad para esta jornada. */
interface Row {
  id: string;
  name: string;
  pts: number;
  pos: Position;
  /** Baja: no entra en alineación aunque esté disponible. */
  out: boolean;
  avail: Av;
  /** El jugador vinculado a la cuenta que mira la pantalla. */
  isMe: boolean;
}

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Disponibilidad — datos reales.
 *
 * La plantilla sale de `players` (bajo RLS, la del equipo activo) y el estado
 * por jornada de la tabla `availability`: si un jugador no tiene fila, aún no ha
 * marcado y sale como «sin marcar». Los controles se mantienen visibles pero
 * NO persisten: marcar disponibilidad es una fase posterior. Aquí sólo se lee.
 */
export function AvailabilityView({ id }: { id: string }) {
  const { activeTeam, role, user } = useSession();
  const teamId = activeTeam?.id ?? null;
  const isCaptain = role === "capitan" || role === "club";

  const { data, loading, error } = useAsync(
    () =>
      Promise.all([
        fetchMatchday(id),
        fetchPlayers(teamId!),
        fetchAvailability(id),
      ]),
    [id, teamId],
    !!teamId
  );

  const matchday: DbMatchday | null = data?.[0] ?? null;

  const players: Row[] = useMemo(() => {
    if (!data) return [];
    const [, dbPlayers, avail] = data;
    return dbPlayers.map((p) => {
      const a = avail[p.id];
      return {
        id: p.id,
        name: p.name,
        pts: p.pts,
        pos: p.position,
        out: !p.active,
        avail: a === undefined ? "unset" : a ? "yes" : "no",
        isMe: !!user && p.userId === user.id,
      };
    });
  }, [data, user]);

  const [state, setState] = useState<Record<string, Av>>({});
  const [filter, setFilter] = useState<Filter>("todos");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // El estado editable arranca del estado real cuando llegan los datos.
  useEffect(() => {
    setState(Object.fromEntries(players.map((p) => [p.id, p.avail])));
  }, [players]);

  if (!teamId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconUsers size={24} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo."
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
            icon={<IconUsers size={24} />}
            title="No se pudo cargar la disponibilidad"
            body={error}
          />
        </Card>
      </div>
    );
  }
  if (!matchday) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconUsers size={24} />}
            title="Jornada no encontrada"
            body="Abre una jornada del calendario para ver la disponibilidad."
          />
        </Card>
      </div>
    );
  }

  const active = players.filter((p) => !p.out);
  const yes = active.filter((p) => state[p.id] === "yes").length;
  const unset = active.filter((p) => state[p.id] === "unset").length;
  const pct = active.length ? Math.round((yes / active.length) * 100) : 0;

  const list = players.filter((p) => {
    if (filter === "disp") return state[p.id] === "yes";
    if (filter === "bajas") return state[p.id] === "no" || p.out;
    return true;
  });
  // El jugador vinculado a la cuenta va primero: es su propia marca.
  const sorted = [...list].sort((a, b) => Number(!!b.isMe) - Number(!!a.isMe));

  // Marca un jugador. Optimista en local + persistencia por el camino que toca:
  //  · capitán/club → upsert directo (o borrado si «sin marcar»),
  //  · el propio jugador → RPC set_player_self_availability.
  // Todo pasa por `guardedWrite`: con las escrituras apagadas no toca la BD.
  async function mark(rowId: string, v: Av) {
    const next: Av = state[rowId] === v ? "unset" : v;
    setState((s) => ({ ...s, [rowId]: next }));
    const res = await guardedWrite("guardar la disponibilidad", async () => {
      if (isCaptain) {
        if (next === "unset") await clearPlayerAvailability(id, rowId);
        else await setPlayerAvailability(id, rowId, next === "yes");
      } else if (next !== "unset") {
        // El RPC del propio jugador no admite «sin marcar».
        await setSelfAvailability(rowId, next === "yes");
      }
    });
    if (!res.ok) setToast(res.reason);
  }

  // «Marcar todo» (solo capitán): pone disponibles a los que no son baja.
  async function markAll() {
    setSaving(true);
    setState((s) =>
      Object.fromEntries(
        Object.entries(s).map(([k, v]) => [
          k,
          players.find((p) => p.id === k)?.out ? v : "yes",
        ]),
      ),
    );
    const targets = active.filter((p) => state[p.id] !== "yes");
    const res = await guardedWrite("marcar disponibles", async () => {
      for (const p of targets) await setPlayerAvailability(id, p.id, true);
    });
    setSaving(false);
    setToast(res.ok ? "Disponibilidad guardada" : res.reason);
  }

  const noCount = active.filter((p) => state[p.id] === "no").length;

  return (
    <div className="tw-page">
      <PageHeader
        title={isCaptain ? "¿Quién está disponible?" : "¿Estás disponible?"}
        meta={[
          `Jornada ${matchday.round}`,
          `vs ${matchday.opponent}`,
          "Cierra el jueves a las 20:00",
        ]}
        actions={
          isCaptain ? (
            <Btn variant="accent" onClick={markAll} disabled={saving} icon={<IconCheck size={15} />}>
              {saving ? "Marcando…" : "Marcar todo"}
            </Btn>
          ) : undefined
        }
      />

      <StatRow style={{ marginBottom: 16 }}>
        <Stat
          label="Disponibles"
          value={yes}
          unit={`/ ${active.length}`}
          tone={active.length > 0 && pct >= 70 ? "accent" : undefined}
        >
          <Progress value={pct} style={{ marginTop: 10 }} tone={pct < 50 ? "warning" : undefined} />
        </Stat>
        <Stat
          label="Sin marcar"
          value={unset}
          tone={unset > 0 ? "warning" : undefined}
          sub={unset > 0 ? "Aún no han respondido" : "Todos han respondido"}
        />
        <Stat label="No pueden" value={noCount} sub={`${players.length - active.length} bajas en plantilla`} />
      </StatRow>

      <div className="tw-toolbar">
        <Segmented
          label="Filtrar jugadores"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos" },
            { value: "disp", label: "Disponibles" },
            { value: "bajas", label: "Bajas" },
          ]}
        />
        <span className="tw-toolbar-spacer" />
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {sorted.length} de {players.length} jugadores
        </span>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Nadie en este filtro"
            body="Prueba con otro filtro o marca a alguien."
          />
        </Card>
      ) : (
        <div className="tw-avail-grid">
          {sorted.map((p) => {
            const v = state[p.id];
            const locked = p.out || (!isCaptain && !p.isMe);
            return (
              <Card
                key={p.id}
                style={{
                  borderColor: p.isMe ? "var(--accent-40)" : undefined,
                  opacity: p.out ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar initials={initials(p.name)} size={36} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      className="truncate"
                      style={{ display: "block", fontSize: 14, fontWeight: 700 }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontSize: 12.5,
                        color: "var(--text-muted)",
                      }}
                    >
                      {p.pos} · <span className="mono">{p.pts}</span> pts
                    </span>
                  </span>
                  {p.isMe && <Chip plain>Soy yo</Chip>}
                  {p.out && <Chip tone="warning">Baja</Chip>}
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  {(
                    [
                      ["yes", "Disponible", "var(--accent)", "var(--accent-10)"],
                      ["no", "No puedo", "var(--error)", "var(--error-soft)"],
                    ] as const
                  ).map(([k, label, color, bg]) => {
                    const on = v === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => mark(p.id, k as Av)}
                        className="btn btn-ghost btn-sm"
                        style={{
                          flex: 1,
                          ...(on
                            ? { background: bg, color, borderColor: color, fontWeight: 700 }
                            : null),
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {saving && (
        <Note tone="accent" icon={<IconCheck size={15} />} style={{ marginTop: 16 }}>
          Marcando a toda la plantilla…
        </Note>
      )}

      {!WRITES_ENABLED && (
        <Note tone="warning" style={{ marginTop: 16 }}>
          Modo solo lectura: los cambios aún no se guardan.
        </Note>
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
