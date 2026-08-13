"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchMatchdayBundle,
  saveLineupVariant,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import { Card, Eyebrow, Modal, Toggle } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconLock,
  IconSearch,
  IconZap,
} from "@/components/Icon";

/**
 * Alineación — el lienzo ancho.
 *
 * En el móvil la alineación se monta tocando dos jugadores. Aquí se ARRASTRA,
 * con todo a la vista: cinco pistas a la izquierda y el banquillo a la derecha.
 * Es el mayor motivo para tener versión web.
 *
 * El arrastre usa la API nativa de HTML5 (sin dependencias). El modo
 * tap-para-intercambiar se mantiene como alternativa accesible: es la única
 * que funciona con teclado y lectores de pantalla.
 */

type Slot = { court: number; idx: 0 | 1 };
/** Pareja de una pista: dos ids o hueco vacío. */
type Pair = [string | null, string | null];
type Lock = "none" | "notCaptain" | "closed" | "archived";

const LOCK_COPY: Record<Exclude<Lock, "none">, string> = {
  notCaptain: "Solo el capitán puede editar la alineación.",
  closed: "Acta cerrada · solo lectura.",
  archived: "Temporada archivada · alineación en solo lectura.",
};

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function firstName(n: string) {
  return n.split(" ")[0];
}

export function LineupBoard({ id, lock }: { id: string; lock?: Lock }) {
  const { activeTeam, role } = useSession();
  const teamId = activeTeam?.id ?? null;

  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId],
    !!teamId
  );

  const PLAYERS: DbPlayer[] = useMemo(() => data?.players ?? [], [data]);
  const byId = useMemo(
    () => new Map(PLAYERS.map((p) => [p.id, p])),
    [PLAYERS]
  );
  const playerById = (pid: string | null) => (pid ? (byId.get(pid) ?? null) : null);
  const pairPoints = (pair: Pair) =>
    pair.reduce((sum, pid) => sum + (playerById(pid)?.pts ?? 0), 0);

  /** Cinco pistas por defecto; si la alineación guardada tiene más, se respeta. */
  const courtCount = Math.max(5, ...(data?.lineup.map((l) => l.court) ?? [0]));

  const [variantId, setVariantId] = useState<string | null>(null);
  const [courts, setCourts] = useState<Pair[]>([]);

  const variants = data?.variants ?? [];
  const variant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;

  // Al llegar los datos se monta el tablero con la variante activa.
  useEffect(() => {
    if (!data) return;
    const active = data.variants.find((v) => v.isActive) ?? data.variants[0];
    setVariantId(active?.id ?? null);

    const next: Pair[] = Array.from({ length: courtCount }, () => [null, null]);
    for (const l of data.lineup) {
      const i = l.court - 1;
      if (i >= 0 && i < next.length) next[i] = [l.playerA, l.playerB];
    }
    setCourts(next);
  }, [data, courtCount]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<Slot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mix, setMix] = useState(true);
  const [order, setOrder] = useState<"Drive + Revés" | "Por fuerza">("Drive + Revés");
  const [notify, setNotify] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // El bloqueo se deduce: no es capitán, acta cerrada, o forzado por props.
  const derivedLock: Lock =
    lock ??
    (role !== "capitan" && role !== "club"
      ? "notCaptain"
      : data?.matchday.status === "finished"
        ? "closed"
        : "none");
  const readOnly = derivedLock !== "none";

  const placed = useMemo(
    () => new Set(courts.flat().filter(Boolean) as string[]),
    [courts]
  );

  /** Disponible para esta jornada; si nadie se ha marcado, cae al flag general. */
  const isAvailable = (p: DbPlayer) =>
    data && p.id in data.availability
      ? data.availability[p.id]
      : p.available === true;

  const bench = PLAYERS.filter(
    (p) => !placed.has(p.id) && p.active && isAvailable(p)
  );
  const unavailable = PLAYERS.filter(
    (p) => !placed.has(p.id) && (!p.active || !isAvailable(p))
  );

  const filtered = (list: DbPlayer[]) =>
    query.trim()
      ? list.filter((p) =>
          (p.name + " " + (p.alias ?? ""))
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        )
      : list;

  const points = courts.map((p) => pairPoints(p));
  /** Una pista rompe el orden si suma más que la de arriba. */
  const breaks = points.map((pt, i) => i > 0 && pt > points[i - 1]);
  const filledCourts = courts.filter((p) => p[0] && p[1]).length;
  const complete = filledCourts === courts.length;

  function setPairs(next: Pair[]) {
    setCourts(next);
  }

  function slotOf(pid: string): Slot | null {
    for (let c = 0; c < courts.length; c++) {
      for (const i of [0, 1] as const) {
        if (courts[c][i] === pid) return { court: c, idx: i };
      }
    }
    return null;
  }

  /** Coloca `pid` en el hueco; si estaba ocupado, intercambia. */
  function place(pid: string, target: Slot) {
    if (readOnly) return;
    const next = courts.map((p) => [...p] as Pair);
    const from = slotOf(pid);
    const occupant = next[target.court][target.idx];

    next[target.court][target.idx] = pid;
    if (from) {
      // Venía de otra pista: el ocupante hace el camino inverso.
      next[from.court][from.idx] = occupant ?? null;
    }
    setPairs(next);
    setSelected(null);
  }

  /** Devuelve al banquillo el jugador de ese hueco. */
  function clearSlot(target: Slot) {
    if (readOnly) return;
    const next = courts.map((p) => [...p] as Pair);
    next[target.court][target.idx] = null;
    setPairs(next);
  }

  function benchDrop(pid: string) {
    if (readOnly) return;
    const from = slotOf(pid);
    if (from) clearSlot(from);
    setSelected(null);
  }

  /** Genera parejas: ordena por puntos y, si procede, cruza drive con revés. */
  function generate() {
    const pool = PLAYERS.filter((p) => p.active && isAvailable(p)).sort(
      (a, b) => b.pts - a.pts
    );
    const next: Pair[] = [];

    if (mix && order === "Drive + Revés") {
      const drives = pool.filter((p) => p.position === "Drive" || p.position === "Ambos");
      const reves = pool.filter((p) => p.position === "Revés");
      const used = new Set<string>();
      for (let c = 0; c < courts.length; c++) {
        const d = drives.find((p) => !used.has(p.id));
        const r =
          reves.find((p) => !used.has(p.id)) ??
          pool.find((p) => !used.has(p.id) && p.id !== d?.id);
        if (d) used.add(d.id);
        if (r) used.add(r.id);
        next.push([d?.id ?? null, r?.id ?? null]);
      }
    } else {
      // Sólo por nivel: parejas consecutivas del pool ordenado.
      for (let c = 0; c < courts.length; c++) {
        next.push([pool[c * 2]?.id ?? null, pool[c * 2 + 1]?.id ?? null]);
      }
    }

    // El orden de fuerza manda: pista 1 la pareja más fuerte.
    next.sort((a, b) => pairPoints(b) - pairPoints(a));
    setPairs(next);
    setGenOpen(false);
    setToast(
      next.some((p) => !p[0] || !p[1])
        ? "Alineación generada con avisos"
        : "Alineación generada"
    );
  }

  async function confirmLineup() {
    if (!variantId) {
      setConfirmOpen(false);
      setToast("No hay una variante de alineación activa para guardar.");
      return;
    }
    const res = await guardedWrite("guardar la alineación", () =>
      saveLineupVariant(id, variantId, courts),
    );
    setConfirmOpen(false);
    // El «avisar al equipo» (notificación push/in-app) es una escritura aparte
    // que aún no está portada; por eso el mensaje solo confirma el guardado.
    setToast(res.ok ? "Alineación guardada" : res.reason);
  }

  if (!teamId) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="Sin equipo activo"
          body="Entra con una cuenta que pertenezca a un equipo."
        />
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconAlert size={34} />}
          title="No se pudo cargar la alineación"
          body={error}
        />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={34} />}
          title="Jornada no encontrada"
          body="Puede que se haya borrado o que no sea de tu equipo."
        />
      </Card>
    );
  }
  const m = data.matchday;

  /* ── Ficha de jugador ─────────────────────────────────────────── */
  function PlayerChip({
    p,
    inSlot,
    slot,
  }: {
    p: DbPlayer;
    inSlot?: boolean;
    slot?: Slot;
  }) {
    const isSelected = selected === p.id;
    return (
      <div
        role="button"
        tabIndex={readOnly ? -1 : 0}
        aria-pressed={isSelected}
        aria-label={`${p.name}, ${p.position}, ${p.pts} puntos`}
        draggable={!readOnly}
        onDragStart={(e) => {
          setDragId(p.id);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", p.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setHover(null);
        }}
        onClick={() => {
          if (readOnly) return;
          if (!selected) {
            setSelected(p.id);
            return;
          }
          if (selected === p.id) {
            setSelected(null);
            return;
          }
          // Intercambio por tap: el seleccionado va al hueco de este.
          const target = slot ?? slotOf(p.id);
          if (target) place(selected, target);
          else benchDrop(selected);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).click();
          }
        }}
        className="tw-player-chip"
        style={{
          cursor: readOnly ? "default" : "grab",
          opacity: dragId === p.id ? 0.4 : 1,
          borderColor: isSelected ? "var(--accent)" : "var(--hair-strong)",
          background: isSelected ? "var(--accent-10)" : "var(--bg-card-2)",
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
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 13.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {inSlot ? firstName(p.name) : p.name}
          </span>
          <span
            className="mono"
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 9.5,
              letterSpacing: "0.14em",
              color: "var(--text-faint)",
            }}
          >
            {p.position.toUpperCase()}
          </span>
        </span>
        <span
          className="mono"
          style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}
        >
          {p.pts}
        </span>
        {!p.active && <span className="chip chip-warning">Baja</span>}
      </div>
    );
  }

  /* ── Hueco de pista ───────────────────────────────────────────── */
  function SlotBox({ court, idx }: Slot) {
    const pid = courts[court][idx];
    const p = playerById(pid);
    const isHover =
      hover?.court === court && hover?.idx === idx && dragId !== null;
    const willSwap = isHover && !!pid && pid !== dragId;

    return (
      <div
        onDragOver={(e) => {
          if (readOnly) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setHover({ court, idx });
        }}
        onDragLeave={() => setHover(null)}
        onDrop={(e) => {
          e.preventDefault();
          const pid2 = e.dataTransfer.getData("text/plain") || dragId;
          if (pid2) place(pid2, { court, idx });
          setDragId(null);
          setHover(null);
        }}
        onClick={() => {
          if (readOnly || !selected) return;
          place(selected, { court, idx });
        }}
        style={{
          borderRadius: 12,
          minHeight: 62,
          border: `1.5px ${pid ? "solid" : "dashed"} ${
            isHover ? "var(--accent)" : "var(--hair-strong)"
          }`,
          background: isHover ? "var(--accent-10)" : "transparent",
          display: "flex",
          alignItems: "center",
          padding: pid ? 0 : 10,
          transition: "all var(--dur-fast) var(--ease)",
        }}
      >
        {p ? (
          <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
            <PlayerChip p={p} inSlot slot={{ court, idx }} />
            {willSwap && (
              <span
                className="mono"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--accent-10)",
                  border: "1.5px solid var(--accent)",
                  borderRadius: 12,
                  color: "var(--accent)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  pointerEvents: "none",
                }}
              >
                ⇄ INTERCAMBIAR CON {firstName(p.name).toUpperCase()}
              </span>
            )}
          </div>
        ) : (
          <span
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 12.5,
              color: "var(--text-faint)",
            }}
          >
            {isHover ? "Suelta aquí" : selected ? "Toca para colocar" : "Vacío"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="tw-lineup-wrap">
      {/* ══ Cabecera de herramienta ═══════════════════════════════ */}
      <div className="tw-lineup-head">
        <div style={{ minWidth: 0 }}>
          <Eyebrow>JORNADA · J·{m.round} · ALINEACIÓN</Eyebrow>
          <h1 style={{ marginTop: 8, fontSize: 26 }}>vs {m.opponent}</h1>
        </div>

        <div className="tw-variants" role="tablist" aria-label="Variantes">
          {variants.map((v) => {
            const on = v.id === variant.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setVariantId(v.id)}
                className="btn"
                style={{
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  background: on ? "var(--accent-10)" : "transparent",
                  color: on ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                }}
              >
                {v.label}
                {v.isActive && (
                  <span
                    className="mono"
                    style={{
                      marginLeft: 8,
                      fontSize: 8.5,
                      letterSpacing: "0.16em",
                      color: "var(--accent)",
                    }}
                  >
                    OFICIAL
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={readOnly}
            onClick={() => setGenOpen(true)}
            style={{ padding: "11px 18px", fontSize: 13 }}
          >
            <IconZap size={15} />
            Generar
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={readOnly}
            onClick={() => setPairs(courts.map(() => [null, null]))}
            style={{ padding: "11px 16px", fontSize: 13 }}
          >
            Vaciar
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={readOnly || !complete}
            onClick={() => setConfirmOpen(true)}
            style={{ padding: "11px 20px", fontSize: 13 }}
          >
            Confirmar alineación
          </button>
        </div>
      </div>

      {/* Banner de bloqueo */}
      {readOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderRadius: 12,
            background: "var(--bg-card-2)",
            border: "1px solid var(--hair-strong)",
            color: "var(--text-muted)",
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          <IconLock size={16} />
          {LOCK_COPY[derivedLock as Exclude<Lock, "none">]}
        </div>
      )}

      {selected && !readOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            borderRadius: 12,
            background: "var(--accent-10)",
            border: "1px solid var(--accent-25)",
            color: "var(--accent)",
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          Toca otro jugador para intercambiar · o el banquillo
        </div>
      )}

      {/* ══ Lienzo ════════════════════════════════════════════════ */}
      <div className="tw-lineup-grid">
        {/* Pistas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {courts.map((pair, c) => (
            <Card
              key={c}
              style={{
                padding: 18,
                border: `1.5px solid ${breaks[c] ? "var(--warning)" : "transparent"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: "0.18em",
                    color: "var(--text-faint)",
                  }}
                >
                  PISTA {c + 1}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: points[c] ? "var(--accent)" : "var(--text-faint)",
                  }}
                >
                  {points[c]} PTS
                </span>
              </div>

              <div className="tw-slot-pair">
                <SlotBox court={c} idx={0} />
                <SlotBox court={c} idx={1} />
              </div>

              {breaks[c] && (
                <div
                  className="mono"
                  style={{
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 9.5,
                    letterSpacing: "0.16em",
                    color: "var(--warning)",
                  }}
                >
                  <IconAlert size={13} />
                  ROMPE EL ORDEN POR PUNTOS
                </div>
              )}
            </Card>
          ))}

          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12.5,
              color: "var(--text-faint)",
              textAlign: "center",
            }}
          >
            Las parejas se ordenan por puntos automáticamente
          </p>
        </div>

        {/* Banquillo */}
        <Card
          className="tw-bench"
          style={{ padding: 18 }}
          onDragOver={(e) => {
            if (!readOnly) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const pid = e.dataTransfer.getData("text/plain") || dragId;
            if (pid) benchDrop(pid);
            setDragId(null);
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Eyebrow>BANQUILLO</Eyebrow>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--text-faint)" }}
            >
              {bench.length}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid var(--hair-strong)",
              background: "var(--bg-card-2)",
              marginBottom: 14,
            }}
          >
            <IconSearch size={14} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtra por nombre"
              aria-label="Filtrar jugadores"
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                background: "transparent",
                color: "var(--text)",
                fontSize: 13,
                outline: "none",
                fontFamily: "'Satoshi', sans-serif",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered(bench).map((p) => (
              <PlayerChip key={p.id} p={p} />
            ))}
            {filtered(bench).length === 0 && (
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--text-faint)",
                  textAlign: "center",
                  padding: "18px 0",
                }}
              >
                Sin coincidencias
              </p>
            )}
          </div>

          {unavailable.length > 0 && (
            <>
              <div
                className="mono"
                style={{
                  marginTop: 20,
                  marginBottom: 10,
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  color: "var(--text-faint)",
                }}
              >
                NO DISPONIBLES
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  opacity: 0.5,
                }}
              >
                {filtered(unavailable).map((p) => (
                  <PlayerChip key={p.id} p={p} />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ══ Generador ═════════════════════════════════════════════ */}
      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        labelledBy="gen-titulo"
        width={520}
      >
        <Eyebrow>GENERADOR</Eyebrow>
        <h2 id="gen-titulo" style={{ margin: "14px 0 6px", fontSize: 24 }}>
          Generar alineación
        </h2>
        <p
          style={{
            margin: "0 0 22px",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          Genérala por puntos FEP en un segundo, o colócala tú pista a pista.
        </p>

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
              Emparejar Drive + Revés
            </span>
            <span
              style={{
                display: "block",
                marginTop: 5,
                fontSize: 12.5,
                color: "var(--text-muted)",
              }}
            >
              Si lo desactivas, empareja solo por nivel
            </span>
          </span>
          <Toggle
            on={mix}
            onChange={() => setMix((v) => !v)}
            label="Emparejar Drive y Revés"
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-faint)",
              marginBottom: 8,
            }}
          >
            ORDEN DE PAREJAS
          </div>
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: "var(--bg-card-2)",
            }}
          >
            {(["Drive + Revés", "Por fuerza"] as const).map((o) => {
              const on = order === o;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrder(o)}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Satoshi', sans-serif",
                    fontSize: 13,
                    fontWeight: on ? 700 : 500,
                    background: on ? "var(--accent-10)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text-muted)",
                    boxShadow: on ? "inset 0 0 0 1.5px var(--accent)" : "none",
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => setGenOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={generate}
            style={{ padding: "12px 24px", fontSize: 13.5 }}
          >
            Aplicar
          </button>
        </div>
      </Modal>

      {/* ══ Confirmar ═════════════════════════════════════════════ */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        labelledBy="conf-titulo"
        width={520}
      >
        <Eyebrow>CONFIRMAR · J·{m.round}</Eyebrow>
        <h2 id="conf-titulo" style={{ margin: "14px 0 6px", fontSize: 24 }}>
          Confirmar alineación
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          Revisa las cinco parejas antes de publicarla al equipo.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {courts.map((pair, c) => {
            const a = playerById(pair[0]);
            const b = playerById(pair[1]);
            return (
              <div
                key={c}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "var(--bg-card-2)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "var(--text-faint)",
                  }}
                >
                  P{c + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                  {a && b ? `${firstName(a.name)} · ${firstName(b.name)}` : "Vacío"}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--accent)" }}
                >
                  {points[c]}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 20,
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
              Avisar al equipo
            </span>
            <span
              style={{
                display: "block",
                marginTop: 5,
                fontSize: 12.5,
                color: "var(--text-muted)",
              }}
            >
              Reciben un aviso con su pista y su pareja
            </span>
          </span>
          <Toggle
            on={notify}
            onChange={() => setNotify((v) => !v)}
            label="Avisar al equipo"
          />
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => setConfirmOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => void confirmLineup()}
            style={{ padding: "12px 24px", fontSize: 13.5 }}
          >
            <IconCheck size={15} />
            {notify ? "Guardar con aviso" : "Guardar igual"}
          </button>
        </div>
      </Modal>

      {toast && (
        <Toast
          tone={toast.includes("avisos") ? "warning" : "success"}
          title={toast}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ marginTop: 24 }}>
        <Link
          href={`/jornada/${m.id}`}
          className="btn btn-ghost"
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          Volver a la jornada
        </Link>
      </div>

      <p
        className="mono"
        style={{
          marginTop: 16,
          fontSize: 9.5,
          letterSpacing: "0.14em",
          color: "var(--text-faint)",
        }}
      >
        {activeTeam?.name} · {activeTeam?.category ?? ""} · {filledCourts}/{courts.length} PISTAS
      </p>
    </div>
  );
}
