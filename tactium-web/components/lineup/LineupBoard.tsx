"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import {
  cloneLineupVariantPairs,
  createLineupVariant,
  deleteLineupVariant,
  fetchLineup,
  fetchMatchdayBundle,
  renameLineupVariant,
  saveLineupVariant,
  setActiveLineupVariant,
  type DbPlayer,
  type MatchdayBundle,
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
  Input,
  InputWrap,
  Modal,
  Note,
  Segmented,
  Toggle,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconLock,
  IconSearch,
  IconZap,
} from "@/components/Icon";

/**
 * Alineación — el lienzo ancho.
 *
 * En el móvil la alineación se monta tocando dos jugadores. Aquí se ARRASTRA,
 * con todo a la vista: cinco pistas a la izquierda y el banquillo a la derecha.
 *
 * El arrastre va con dnd-kit: sensores de puntero, táctil y teclado, y una
 * copia flotante (`DragOverlay`) que sigue al cursor sin el fantasma nativo.
 * El modo tap-para-intercambiar se mantiene: es la alternativa accesible y la
 * que funciona con lectores de pantalla.
 */

type Slot = { court: number; idx: 0 | 1 };
/** Pareja de una pista: dos ids o hueco vacío. */
type Pair = [string | null, string | null];
type Lock = "none" | "notCaptain" | "closed" | "archived";

const LOCK_COPY: Record<Exclude<Lock, "none">, string> = {
  notCaptain: "Solo el capitán puede editar la alineación.",
  closed: "Acta cerrada: la alineación es de solo lectura.",
  archived: "Temporada archivada: la alineación es de solo lectura.",
};

const BENCH_ID = "bench";
const slotId = (s: Slot) => `slot-${s.court}-${s.idx}`;
const parseSlot = (id: string): Slot | null => {
  const m = /^slot-(\d+)-(0|1)$/.exec(id);
  return m ? { court: Number(m[1]), idx: Number(m[2]) as 0 | 1 } : null;
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

/* ── Ficha de jugador ─────────────────────────────────────────────── */
function PlayerChipView({
  p,
  inSlot,
  selected,
  ghost,
  overlay,
  readOnly,
}: {
  p: DbPlayer;
  inSlot?: boolean;
  selected?: boolean;
  ghost?: boolean;
  overlay?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div
      className="tw-player-chip"
      style={{
        cursor: readOnly ? "default" : overlay ? "grabbing" : "grab",
        opacity: ghost ? 0.35 : 1,
        borderColor: selected ? "var(--accent)" : overlay ? "var(--accent-40)" : undefined,
        background: selected ? "var(--accent-10)" : overlay ? "var(--bg-card-3)" : undefined,
        boxShadow: overlay ? "var(--shadow-md)" : undefined,
        transform: overlay ? "scale(1.02)" : undefined,
      }}
    >
      <Avatar initials={initials(p.name)} src={p.photoUrl} size={30} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          className="truncate"
          style={{ display: "block", fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em" }}
        >
          {inSlot ? firstName(p.name) : p.name}
        </span>
        <span style={{ display: "block", marginTop: 1, fontSize: 11.5, color: "var(--text-faint)" }}>
          {p.position}
          {!p.active ? " · baja" : ""}
        </span>
      </span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
        {p.pts}
      </span>
    </div>
  );
}

function DraggableChip({
  p,
  inSlot,
  slot,
  selected,
  readOnly,
  onTap,
}: {
  p: DbPlayer;
  inSlot?: boolean;
  slot?: Slot;
  selected: boolean;
  readOnly: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: p.id,
    data: { slot },
    disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        outline: "none",
        borderRadius: "var(--r-md)",
      }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={readOnly ? -1 : 0}
      aria-pressed={selected}
      aria-label={`${p.name}, ${p.position}, ${p.pts} puntos`}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      <PlayerChipView p={p} inSlot={inSlot} selected={selected} ghost={isDragging} readOnly={readOnly} />
    </div>
  );
}

/* ── Hueco de pista ───────────────────────────────────────────────── */
function SlotBox({
  slot,
  player,
  dragging,
  selected,
  readOnly,
  onTapChip,
  onTapEmpty,
}: {
  slot: Slot;
  player: DbPlayer | null;
  dragging: string | null;
  selected: string | null;
  readOnly: boolean;
  onTapChip: (pid: string) => void;
  onTapEmpty: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: slotId(slot), disabled: readOnly });
  const willSwap = isOver && !!player && player.id !== dragging;
  const empty = !player;

  return (
    <div
      ref={setNodeRef}
      onClick={() => {
        if (empty) onTapEmpty();
      }}
      style={{
        position: "relative",
        borderRadius: "var(--r-md)",
        minHeight: 50,
        border: `1.5px ${empty ? "dashed" : "solid"} ${
          isOver ? "var(--accent)" : empty ? "var(--line-strong)" : "transparent"
        }`,
        background: isOver && empty ? "var(--accent-10)" : "transparent",
        display: "flex",
        alignItems: "center",
        cursor: empty && selected && !readOnly ? "pointer" : "default",
        transition: "border-color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease)",
      }}
    >
      {player ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          <DraggableChip
            p={player}
            inSlot
            slot={slot}
            selected={selected === player.id}
            readOnly={readOnly}
            onTap={() => onTapChip(player.id)}
          />
          {willSwap && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "color-mix(in srgb, var(--accent-16) 100%, var(--bg-card))",
                border: "1.5px solid var(--accent)",
                borderRadius: "var(--r-md)",
                color: "var(--accent)",
                fontSize: 12.5,
                fontWeight: 700,
                pointerEvents: "none",
              }}
            >
              Intercambiar con {firstName(player.name)}
            </span>
          )}
        </div>
      ) : (
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 12.5,
            color: isOver ? "var(--accent)" : "var(--text-faint)",
            fontWeight: isOver ? 700 : 500,
          }}
        >
          {isOver ? "Suelta aquí" : selected ? "Colocar aquí" : "Hueco libre"}
        </span>
      )}
    </div>
  );
}

function BenchDrop({ children, readOnly }: { children: React.ReactNode; readOnly: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: BENCH_ID, disabled: readOnly });
  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: "var(--r-md)",
        outline: isOver ? "1.5px dashed var(--accent)" : "1.5px dashed transparent",
        outlineOffset: 4,
        transition: "outline-color var(--dur-fast) var(--ease)",
        minHeight: 80,
      }}
    >
      {children}
    </div>
  );
}

export function LineupBoard({ id, lock }: { id: string; lock?: Lock }) {
  const { activeTeam, role } = useSession();
  const teamId = activeTeam?.id ?? null;

  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId, reloadKey],
    !!teamId
  );

  const PLAYERS: DbPlayer[] = useMemo(() => data?.players ?? [], [data]);
  const byId = useMemo(() => new Map(PLAYERS.map((p) => [p.id, p])), [PLAYERS]);
  const playerById = useCallback(
    (pid: string | null) => (pid ? (byId.get(pid) ?? null) : null),
    [byId]
  );
  const pairPoints = useCallback(
    (pair: Pair) => pair.reduce((sum, pid) => sum + (playerById(pid)?.pts ?? 0), 0),
    [playerById]
  );

  /** Cinco pistas por defecto; si la alineación guardada tiene más, se respeta. */
  const courtCount = Math.max(5, ...(data?.lineup.map((l) => l.court) ?? [0]));

  const [variantId, setVariantId] = useState<string | null>(null);
  const [courts, setCourts] = useState<Pair[]>([]);
  const [dirty, setDirty] = useState(false);

  const variants = useMemo(() => data?.variants ?? [], [data]);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;

  const buildCourts = useCallback(
    (rows: { court: number; playerA: string | null; playerB: string | null }[]) => {
      const next: Pair[] = Array.from({ length: courtCount }, () => [null, null]);
      for (const l of rows) {
        const i = l.court - 1;
        if (i >= 0 && i < next.length) next[i] = [l.playerA, l.playerB];
      }
      return next;
    },
    [courtCount]
  );

  // Al llegar los datos se monta el tablero con la variante activa.
  useEffect(() => {
    if (!data) return;
    const active = data.variants.find((v) => v.isActive) ?? data.variants[0];
    setVariantId(active?.id ?? null);
    setCourts(buildCourts(data.lineup));
    setDirty(false);
  }, [data, buildCourts]);

  // Cambiar de pestaña carga las parejas de ESA variante (cada una es una
  // alineación distinta guardada en servidor).
  const [switching, setSwitching] = useState(false);
  async function switchVariant(vid: string) {
    if (!data || vid === variantId) return;
    setSwitching(true);
    try {
      const rows = await fetchLineup(id, vid);
      setVariantId(vid);
      setCourts(buildCourts(rows));
      setDirty(false);
      setSelected(null);
    } catch {
      setToast("No se pudo cargar esa variante");
    } finally {
      setSwitching(false);
    }
  }

  const [dragId, setDragId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mix, setMix] = useState(true);
  const [order, setOrder] = useState<"Drive + Revés" | "Por fuerza">("Drive + Revés");
  const [notify, setNotify] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  async function addVariant() {
    if (variantBusy) return;
    setVariantBusy(true);
    const res = await guardedWrite("crear la variante", () =>
      createLineupVariant(id, `Variante ${variants.length + 1}`),
    );
    setVariantBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setVariantId(res.data.id);
      setToast(`«${res.data.label}» creada`);
    } else setToast(res.reason);
  }

  async function saveVariantName() {
    if (!variant || variantBusy) return;
    const label = renameValue.trim();
    if (!label) return;
    setVariantBusy(true);
    const res = await guardedWrite("renombrar la variante", () =>
      renameLineupVariant(variant.id, label),
    );
    setVariantBusy(false);
    setRenameOpen(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Variante renombrada");
    } else setToast(res.reason);
  }

  async function removeVariant() {
    if (!variant || variantBusy || variant.isActive) return;
    setVariantBusy(true);
    const res = await guardedWrite("borrar la variante", () =>
      deleteLineupVariant(variant.id),
    );
    setVariantBusy(false);
    setConfirmDeleteVariant(false);
    if (res.ok) {
      setVariantId(null);
      setReloadKey((k) => k + 1);
      setToast("Variante borrada");
    } else setToast(res.reason);
  }

  async function makeOfficial() {
    if (!variant || variantBusy || variant.isActive) return;
    setVariantBusy(true);
    const res = await guardedWrite("hacer oficial la alineación", () =>
      setActiveLineupVariant(variant.id),
    );
    setVariantBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(`«${variant.label}» es ahora la alineación oficial`);
    } else setToast(res.reason);
  }

  async function copyFrom(sourceId: string, sourceLabel: string) {
    if (!variant || variantBusy) return;
    setVariantBusy(true);
    const res = await guardedWrite("copiar las parejas", () =>
      cloneLineupVariantPairs(sourceId, variant.id),
    );
    setVariantBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(`Parejas copiadas de «${sourceLabel}»`);
    } else setToast(res.reason);
  }

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

  const isAvailable = useCallback(
    (p: DbPlayer) =>
      data && p.id in data.availability ? data.availability[p.id] : p.available === true,
    [data]
  );

  const bench = PLAYERS.filter((p) => !placed.has(p.id) && p.active && isAvailable(p));
  const unavailable = PLAYERS.filter(
    (p) => !placed.has(p.id) && (!p.active || !isAvailable(p))
  );

  const filtered = (list: DbPlayer[]) =>
    query.trim()
      ? list.filter((p) =>
          (p.name + " " + (p.alias ?? "")).toLowerCase().includes(query.trim().toLowerCase())
        )
      : list;

  const points = courts.map((p) => pairPoints(p));
  const maxPoints = Math.max(1, ...points);
  const breaks = points.map((pt, i) => i > 0 && pt > points[i - 1]);
  const filledCourts = courts.filter((p) => p[0] && p[1]).length;
  const complete = courts.length > 0 && filledCourts === courts.length;
  const breakCount = breaks.filter(Boolean).length;

  function setPairs(next: Pair[]) {
    setCourts(next);
    setDirty(true);
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
    if (occupant === pid) return;
    next[target.court][target.idx] = pid;
    if (from) next[from.court][from.idx] = occupant ?? null;
    setPairs(next);
    setSelected(null);
  }

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

  /** Tap sobre una ficha: selecciona, deselecciona o intercambia. */
  function tapChip(pid: string, slot?: Slot) {
    if (readOnly) return;
    if (!selected) {
      setSelected(pid);
      return;
    }
    if (selected === pid) {
      setSelected(null);
      return;
    }
    const target = slot ?? slotOf(pid);
    if (target) place(selected, target);
    else benchDrop(selected);
  }

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
    setSelected(null);
  }

  function onDragEnd(e: DragEndEvent) {
    const pid = String(e.active.id);
    setDragId(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (overId === BENCH_ID) {
      benchDrop(pid);
      return;
    }
    const target = parseSlot(overId);
    if (target) place(pid, target);
  }

  /** Genera parejas: ordena por puntos y, si procede, cruza drive con revés. */
  function generate() {
    const pool = PLAYERS.filter((p) => p.active && isAvailable(p)).sort((a, b) => b.pts - a.pts);
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
      for (let c = 0; c < courts.length; c++) {
        next.push([pool[c * 2]?.id ?? null, pool[c * 2 + 1]?.id ?? null]);
      }
    }

    next.sort((a, b) => pairPoints(b) - pairPoints(a));
    setPairs(next);
    setGenOpen(false);
    setToast(
      next.some((p) => !p[0] || !p[1]) ? "Alineación generada con huecos" : "Alineación generada"
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
    if (res.ok) setDirty(false);
    setToast(res.ok ? "Alineación guardada" : res.reason);
  }

  if (!teamId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
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
            icon={<IconAlert size={24} />}
            title="No se pudo cargar la alineación"
            body={error}
          />
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Jornada no encontrada"
            body="Puede que se haya borrado o que no sea de tu equipo."
          />
        </Card>
      </div>
    );
  }
  const m = data.matchday;
  const dragged = dragId ? playerById(dragId) : null;
  const otherVariants = variant ? variants.filter((v) => v.id !== variant.id) : [];

  return (
    <div className="tw-lineup-wrap">
      {/* ══ Cabecera de herramienta ═══════════════════════════════ */}
      <div className="tw-lineup-head">
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <Link href={`/jornada/${m.id}`} className="tw-back" style={{ marginBottom: 4 }}>
            <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            Jornada {m.round}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="tw-page-title" style={{ fontSize: 22 }}>
              Alineación vs {m.opponent}
            </h1>
            <Chip tone={complete ? "accent" : "mute"} plain>
              {filledCourts}/{courts.length} pistas
            </Chip>
            {dirty && !readOnly && (
              <Chip tone="warning" plain>
                Sin guardar
              </Chip>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Btn
            variant="ghost"
            disabled={readOnly}
            onClick={() => setGenOpen(true)}
            icon={<IconZap size={15} />}
          >
            Generar
          </Btn>
          <Btn
            variant="quiet"
            disabled={readOnly || placed.size === 0}
            onClick={() => setPairs(courts.map(() => [null, null]))}
          >
            Vaciar
          </Btn>
          <Btn
            variant="accent"
            disabled={readOnly || !complete}
            onClick={() => setConfirmOpen(true)}
            icon={<IconCheck size={15} />}
          >
            Confirmar
          </Btn>
        </div>

        {/* Variantes */}
        {variants.length > 0 && (
          <div
            style={{
              flexBasis: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div className="seg" role="tablist" aria-label="Variantes de alineación">
              {variants.map((v) => {
                const on = variant?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    disabled={switching}
                    onClick={() => void switchVariant(v.id)}
                    className={"seg-item" + (on ? " is-on" : "")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {v.label}
                    {v.isActive && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: "var(--accent)",
                        }}
                        title="Alineación oficial"
                      />
                    )}
                  </button>
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void addVariant()}
                  disabled={variantBusy}
                  className="seg-item"
                  title="Preparar otra alineación para esta jornada"
                >
                  + Nueva
                </button>
              )}
            </div>
            {variant?.isActive ? (
              <Chip plain>Oficial</Chip>
            ) : (
              !readOnly &&
              variant && (
                <Btn size="sm" variant="tint" disabled={variantBusy} onClick={() => void makeOfficial()}>
                  Hacer oficial
                </Btn>
              )
            )}
            {!readOnly && variant && (
              <div style={{ position: "relative" }}>
                <Btn
                  size="sm"
                  variant="quiet"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  icon={<IconChevronDown size={14} />}
                >
                  Más
                </Btn>
                {moreOpen && (
                  <div
                    className="tw-popover"
                    style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 240, padding: 6 }}
                  >
                    <button
                      type="button"
                      className="tw-popitem"
                      disabled={variantBusy}
                      onClick={() => {
                        setRenameValue(variant.label);
                        setRenameOpen(true);
                        setMoreOpen(false);
                      }}
                    >
                      Renombrar «{variant.label}»
                    </button>
                    {otherVariants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="tw-popitem"
                        disabled={variantBusy}
                        onClick={() => {
                          setMoreOpen(false);
                          void copyFrom(v.id, v.label);
                        }}
                      >
                        Copiar parejas de «{v.label}»
                      </button>
                    ))}
                    {!variant.isActive && (
                      <>
                        <div className="tw-pop-sep" />
                        <button
                          type="button"
                          className="tw-popitem"
                          style={{ color: "var(--error)" }}
                          disabled={variantBusy}
                          onClick={() => {
                            setMoreOpen(false);
                            setConfirmDeleteVariant(true);
                          }}
                        >
                          Borrar esta variante
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {readOnly && (
        <Note icon={<IconLock size={15} />} style={{ marginBottom: 14 }}>
          {LOCK_COPY[derivedLock as Exclude<Lock, "none">]}
        </Note>
      )}

      {selected && !readOnly && (
        <Note tone="accent" style={{ marginBottom: 14 }}>
          Toca otro jugador o un hueco para colocar a {firstName(playerById(selected)?.name ?? "")}.
          Toca el banquillo para retirarlo.
        </Note>
      )}

      {breakCount > 0 && !readOnly && (
        <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 14 }}>
          {breakCount === 1
            ? "Una pista suma más puntos que la de arriba: el orden de fuerza no se cumple."
            : `${breakCount} pistas suman más que la anterior: el orden de fuerza no se cumple.`}
        </Note>
      )}

      {/* ══ Lienzo ════════════════════════════════════════════════ */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <div className="tw-lineup-grid">
          {/* Pistas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {courts.map((pair, c) => {
              const a = playerById(pair[0]);
              const b = playerById(pair[1]);
              const full = !!a && !!b;
              return (
                <Card
                  key={c}
                  style={{
                    padding: "14px 16px 16px",
                    borderColor: breaks[c] ? "color-mix(in srgb, var(--warning) 55%, transparent)" : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: full ? "var(--accent-10)" : "var(--bg-card-2)",
                        color: full ? "var(--accent)" : "var(--text-faint)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12.5,
                        fontWeight: 700,
                      }}
                    >
                      {c + 1}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>Pista {c + 1}</span>
                    {breaks[c] && (
                      <Chip tone="warning" plain>
                        Rompe el orden
                      </Chip>
                    )}
                    <span style={{ flex: 1 }} />
                    <span
                      className="mono"
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: points[c] ? "var(--text)" : "var(--text-faint)",
                      }}
                    >
                      {points[c]}
                      <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 500 }}> pts</span>
                    </span>
                  </div>

                  <div className="tw-slot-pair">
                    <SlotBox
                      slot={{ court: c, idx: 0 }}
                      player={a}
                      dragging={dragId}
                      selected={selected}
                      readOnly={readOnly}
                      onTapChip={(pid) => tapChip(pid, { court: c, idx: 0 })}
                      onTapEmpty={() => selected && place(selected, { court: c, idx: 0 })}
                    />
                    <SlotBox
                      slot={{ court: c, idx: 1 }}
                      player={b}
                      dragging={dragId}
                      selected={selected}
                      readOnly={readOnly}
                      onTapChip={(pid) => tapChip(pid, { court: c, idx: 1 })}
                      onTapEmpty={() => selected && place(selected, { court: c, idx: 1 })}
                    />
                  </div>

                  {/* Fuerza relativa de la pareja respecto a la más fuerte */}
                  <div
                    className="progress"
                    style={{ marginTop: 12, height: 3 }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${Math.round((points[c] / maxPoints) * 100)}%`,
                        background: breaks[c] ? "var(--warning)" : "var(--accent)",
                        opacity: points[c] ? 0.9 : 0,
                      }}
                    />
                  </div>
                </Card>
              );
            })}

            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
              La pista 1 es la pareja más fuerte: el orden se comprueba por puntos.
            </p>
          </div>

          {/* Banquillo */}
          <Card flush className="tw-bench">
            <CardHead title="Banquillo" count={bench.length} />
            <div style={{ padding: "12px 14px 0" }}>
              <InputWrap icon={<IconSearch size={14} />}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar por nombre"
                  aria-label="Filtrar jugadores"
                />
              </InputWrap>
            </div>

            <div style={{ padding: 14 }}>
              <BenchDrop readOnly={readOnly}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filtered(bench).map((p) => (
                    <DraggableChip
                      key={p.id}
                      p={p}
                      selected={selected === p.id}
                      readOnly={readOnly}
                      onTap={() => tapChip(p.id)}
                    />
                  ))}
                  {filtered(bench).length === 0 && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        color: "var(--text-faint)",
                        textAlign: "center",
                        padding: "18px 0",
                      }}
                    >
                      {bench.length === 0 ? "Todos los disponibles están en pista" : "Sin coincidencias"}
                    </p>
                  )}
                </div>
              </BenchDrop>

              {unavailable.length > 0 && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowUnavailable((v) => !v)}
                    className="btn btn-quiet btn-sm"
                    style={{ width: "100%", justifyContent: "space-between", padding: "0 8px" }}
                    aria-expanded={showUnavailable}
                  >
                    <span>No disponibles · {unavailable.length}</span>
                    <IconChevronDown
                      size={14}
                      style={{
                        transform: showUnavailable ? "rotate(180deg)" : "none",
                        transition: "transform var(--dur-base) var(--ease)",
                      }}
                    />
                  </button>
                  {showUnavailable && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, opacity: 0.6 }}>
                      {filtered(unavailable).map((p) => (
                        <DraggableChip
                          key={p.id}
                          p={p}
                          selected={selected === p.id}
                          readOnly={readOnly}
                          onTap={() => tapChip(p.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {dragged ? <PlayerChipView p={dragged} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* ══ Generador ═════════════════════════════════════════════ */}
      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        labelledBy="gen-titulo"
        width={520}
        title="Generar alineación"
        lede="Por puntos en un segundo. Luego ajusta pista a pista si hace falta."
        footer={
          <>
            <Btn onClick={() => setGenOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" onClick={generate} icon={<IconZap size={15} />}>
              Generar
            </Btn>
          </>
        }
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 14,
            borderRadius: "var(--r-md)",
            background: "var(--bg-card-2)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
              Emparejar drive con revés
            </span>
            <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "var(--text-muted)" }}>
              Si lo desactivas, empareja solo por nivel.
            </span>
          </span>
          <Toggle on={mix} onChange={() => setMix((v) => !v)} label="Emparejar drive y revés" />
        </div>

        <Field label="Orden de parejas" style={{ marginTop: 16 }}>
          <Segmented
            label="Orden de parejas"
            value={order}
            onChange={setOrder}
            options={[
              { value: "Drive + Revés", label: "Drive + revés" },
              { value: "Por fuerza", label: "Por fuerza" },
            ]}
          />
        </Field>
      </Modal>

      {/* ══ Confirmar ═════════════════════════════════════════════ */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        labelledBy="conf-titulo"
        width={520}
        title="Confirmar alineación"
        lede={`Jornada ${m.round} vs ${m.opponent}. Revisa las parejas antes de publicarla.`}
        footer={
          <>
            <Btn onClick={() => setConfirmOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => void confirmLineup()} icon={<IconCheck size={15} />}>
              {notify ? "Guardar y avisar" : "Guardar"}
            </Btn>
          </>
        }
      >
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {courts.map((pair, c) => {
            const a = playerById(pair[0]);
            const b = playerById(pair[1]);
            return (
              <div
                key={c}
                className="list-row"
                style={{ minHeight: 44, padding: "8px 14px" }}
              >
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)", width: 22 }}>
                  P{c + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                  {a && b ? `${firstName(a.name)} · ${firstName(b.name)}` : "Vacío"}
                </span>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {points[c]}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 14,
            borderRadius: "var(--r-md)",
            background: "var(--bg-card-2)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Avisar al equipo</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "var(--text-muted)" }}>
              Cada jugador recibe su pista y su pareja.
            </span>
          </span>
          <Toggle on={notify} onChange={() => setNotify((v) => !v)} label="Avisar al equipo" />
        </div>
      </Modal>

      {renameOpen && variant && (
        <Modal
          open
          onClose={() => setRenameOpen(false)}
          labelledBy="renombrar-variante"
          title="Renombrar alineación"
          lede="Un nombre que diga de un vistazo qué es: «Con Ana fuera», «Plan B»."
          footer={
            <>
              <Btn onClick={() => setRenameOpen(false)}>Cancelar</Btn>
              <Btn
                variant="accent"
                disabled={variantBusy || !renameValue.trim()}
                onClick={() => void saveVariantName()}
              >
                Guardar
              </Btn>
            </>
          }
        >
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveVariantName();
            }}
            autoFocus
            large
            aria-label="Nombre de la variante"
          />
        </Modal>
      )}

      <Modal
        open={confirmDeleteVariant}
        onClose={() => setConfirmDeleteVariant(false)}
        labelledBy="borrar-variante"
        title={`¿Borrar «${variant?.label ?? ""}»?`}
        lede="Se pierden sus parejas. La alineación oficial no se toca."
        footer={
          <>
            <Btn onClick={() => setConfirmDeleteVariant(false)}>Cancelar</Btn>
            <Btn variant="danger" disabled={variantBusy} onClick={() => void removeVariant()}>
              Borrar
            </Btn>
          </>
        }
      >
        <span />
      </Modal>

      {toast && (
        <Toast
          tone={toast.includes("huecos") ? "warning" : "success"}
          title={toast}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <BtnLink href={`/jornada/${m.id}`} variant="quiet">
          Volver a la jornada
        </BtnLink>
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {activeTeam?.name}
          {activeTeam?.category ? ` · ${activeTeam.category}` : ""}
        </span>
      </div>
    </div>
  );
}
