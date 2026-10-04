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
import { motion, useReducedMotion } from "motion/react";

import {
  cloneLineupVariantPairs,
  createLineupVariant,
  deleteLineupVariant,
  fetchAvailabilityDetail,
  fetchLineup,
  fetchMatchdayBundle,
  fetchTeamPairStats,
  renameLineupVariant,
  respondAvailability,
  saveLineupVariant,
  setActiveLineupVariant,
  type AvailRow,
  type AvailStatus,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { notifyLineupPublished } from "@/lib/match-data";
import {
  generateLineupOptions,
  pairKey,
  type LineupOption,
  type PairStatsMap,
} from "@/lib/lineup-generator";
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
  Input,
  InputWrap,
  Modal,
  Note,
  Toggle,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconLock,
  IconSearch,
  IconZap,
} from "@/components/Icon";

/**
 * Alineación (rediseño bloque «Partido», 2026-10; espejo de
 * TACTIUM/src/features/home/screens/LineupScreen.tsx).
 *
 *  · Capitán: una línea de estado («4/5 parejas · orden correcto ✓»), «≥»
 *    entre pistas, banquillo de la CONVOCATORIA (Voy · Duda · Sin contestar;
 *    los «No» plegados), Generar con las estrategias de la app y Publicar
 *    con «Avisar al equipo».
 *  · Jugador: lectura con «Tu pareja» arriba.
 *  · Club: lectura con aviso de cómo editar.
 *
 * En la web se mantiene arrastrar y soltar (dnd-kit) además de tocar y tocar.
 */

type Slot = { court: number; idx: 0 | 1 };
type Pair = [string | null, string | null];
type Lock = "none" | "notCaptain" | "closed" | "archived";
type Group = "yes" | "maybe" | "pending" | "no";

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
const firstName = (n: string) => n.split(" ")[0];
const lastName = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? p[p.length - 1] : p[0];
};
const fmt = (n: number) => n.toLocaleString("es-ES");

const GROUP_DOT: Record<Group, React.CSSProperties> = {
  yes: { background: "var(--accent)" },
  maybe: { background: "var(--warning)" },
  pending: { border: "1px dashed var(--text-faint)" },
  no: { background: "var(--error)" },
};
const GROUP_LABEL: Record<Group, string> = {
  yes: "Voy",
  maybe: "Duda",
  pending: "Sin contestar",
  no: "No puede",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

/* ── Ficha de jugador ─────────────────────────────────────────────── */
function PlayerChipView({
  p,
  inSlot,
  selected,
  ghost,
  overlay,
  readOnly,
  group,
  me,
}: {
  p: DbPlayer;
  inSlot?: boolean;
  selected?: boolean;
  ghost?: boolean;
  overlay?: boolean;
  readOnly?: boolean;
  group?: Group;
  me?: boolean;
}) {
  return (
    <div
      className="tw-player-chip"
      style={{
        cursor: readOnly ? "default" : overlay ? "grabbing" : "grab",
        opacity: ghost ? 0.35 : 1,
        padding: inSlot ? "6px 8px" : undefined,
        borderColor: selected ? "var(--accent)" : overlay ? "var(--accent-40)" : undefined,
        background: selected ? "var(--accent-10)" : overlay ? "var(--bg-card-3)" : undefined,
        boxShadow: overlay ? "var(--shadow-md)" : undefined,
        transform: overlay ? "scale(1.02)" : undefined,
      }}
    >
      {group && (
        <span
          aria-hidden="true"
          title={GROUP_LABEL[group]}
          style={{ width: 7, height: 7, borderRadius: 999, flex: "none", ...GROUP_DOT[group] }}
        />
      )}
      <Avatar initials={initials(p.name)} src={p.photoUrl} size={inSlot ? 24 : 28} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          className="truncate"
          style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: me ? "var(--accent)" : undefined }}
        >
          {me ? "Tú" : inSlot ? firstName(p.name) : p.name}
        </span>
        {!inSlot && (
          <span style={{ display: "block", marginTop: 1, fontSize: 12, color: "var(--text-faint)" }}>
            {p.position}
            {group ? ` · ${GROUP_LABEL[group]}` : ""}
          </span>
        )}
      </span>
      <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>
        {fmt(p.pts)}
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
  group,
  me,
  onTap,
}: {
  p: DbPlayer;
  inSlot?: boolean;
  slot?: Slot;
  selected: boolean;
  readOnly: boolean;
  group?: Group;
  me?: boolean;
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
      style={{ transform: CSS.Translate.toString(transform), outline: "none", borderRadius: "var(--r-md)" }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={readOnly ? -1 : 0}
      aria-pressed={selected}
      aria-label={`${p.name}, ${p.position}, ${p.pts} puntos${group ? `, ${GROUP_LABEL[group]}` : ""}`}
      onClick={onTap}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      <PlayerChipView p={p} inSlot={inSlot} selected={selected} ghost={isDragging} readOnly={readOnly} group={group} me={me} />
    </div>
  );
}

/* ── Hueco de pista ───────────────────────────────────────────────── */
function SlotBox({
  slot,
  player,
  dragging,
  selectedName,
  selectedId,
  readOnly,
  me,
  onTapChip,
  onTapEmpty,
}: {
  slot: Slot;
  player: DbPlayer | null;
  dragging: string | null;
  selectedName: string | null;
  selectedId: string | null;
  readOnly: boolean;
  me?: boolean;
  onTapChip: (pid: string) => void;
  onTapEmpty: () => void;
}) {
  const reduce = useReducedMotion();
  const { isOver, setNodeRef } = useDroppable({ id: slotId(slot), disabled: readOnly });
  const willSwap = isOver && !!player && player.id !== dragging;
  const empty = !player;
  const target = empty && !!selectedName && !readOnly;

  return (
    <motion.div
      ref={setNodeRef}
      onClick={() => {
        if (empty) onTapEmpty();
      }}
      animate={target && !reduce ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
      transition={target && !reduce ? { duration: 1.6, repeat: Infinity } : { duration: 0.15 }}
      style={{
        position: "relative",
        borderRadius: "var(--r-md)",
        minHeight: 42,
        border: `1.5px ${empty ? "dashed" : "solid"} ${
          isOver || target ? "var(--accent-40)" : empty ? "var(--line-strong)" : "transparent"
        }`,
        background: (isOver || target) && empty ? "var(--accent-10)" : "transparent",
        display: "flex",
        alignItems: "center",
        cursor: target ? "pointer" : "default",
      }}
    >
      {player ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          <DraggableChip
            p={player}
            inSlot
            slot={slot}
            selected={selectedId === player.id}
            readOnly={readOnly}
            me={me}
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
            color: isOver || target ? "var(--accent)" : "var(--text-faint)",
            fontWeight: isOver || target ? 700 : 500,
          }}
        >
          {isOver ? "Suelta aquí" : target ? `Colocar a ${selectedName}` : "Vacío"}
        </span>
      )}
    </motion.div>
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
        minHeight: 60,
      }}
    >
      {children}
    </div>
  );
}

/* ── Pista compacta (lectura y edición) ──────────────────────────── */
function CourtLine({
  n,
  pts,
  sub,
  broken,
  me,
  children,
}: {
  n: number;
  pts: number;
  sub?: string | null;
  broken?: boolean;
  me?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "30px minmax(0,1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: me
          ? "1.5px solid var(--accent)"
          : `1px solid ${broken ? "color-mix(in srgb, var(--warning) 55%, transparent)" : "var(--line)"}`,
      }}
    >
      <span className="mono" style={{ textAlign: "center", fontSize: 12.5, fontWeight: 700, color: broken ? "var(--warning)" : "var(--accent)" }}>
        P{n}
      </span>
      <div className="tw-slot-pair" style={{ gap: 6 }}>
        {children}
      </div>
      <span style={{ textAlign: "right", minWidth: 52 }}>
        <span className="mono" style={{ display: "block", fontSize: 13, fontWeight: 700, color: pts ? (broken ? "var(--warning)" : "var(--text)") : "var(--text-faint)" }}>
          {pts ? fmt(pts) : "—"}
        </span>
        {sub && (
          <span className="mono" style={{ display: "block", fontSize: 11, color: "var(--text-faint)" }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function Gap({ broken }: { broken: boolean }) {
  return (
    <div
      className="mono"
      aria-hidden="true"
      style={{ textAlign: "center", fontSize: 12, lineHeight: "12px", margin: "-2px 0", color: broken ? "var(--warning)" : "var(--text-faint)", fontWeight: broken ? 700 : 400 }}
    >
      {broken ? "‹" : "≥"}
    </div>
  );
}

function ReadSlot({ p, name, me }: { p: DbPlayer | null; name: string | null; me?: boolean }) {
  const label = me ? "Tú" : p ? firstName(p.name) : name;
  return (
    <div className="tw-player-chip" style={{ padding: "6px 8px", cursor: "default" }}>
      {label ? (
        <>
          <Avatar initials={initials(p?.name ?? label)} src={p?.photoUrl ?? null} size={24} />
          <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: me ? "var(--accent)" : undefined }}>
            {label}
          </span>
        </>
      ) : (
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Vacío</span>
      )}
    </div>
  );
}

export function LineupBoard({ id, lock }: { id: string; lock?: Lock }) {
  const { activeTeam, role, user } = useSession();
  const teamId = activeTeam?.id ?? null;
  const reduce = useReducedMotion();

  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId, reloadKey],
    !!teamId,
  );
  // Convocatoria de ESTA jornada (Voy · Duda · No). null = no se pudo leer.
  const [availKey, setAvailKey] = useState(0);
  const { data: availDetail, error: availError } = useAsync<Record<string, AvailRow>>(
    () => fetchAvailabilityDetail(id),
    [id, availKey],
    true,
  );
  const { data: pairStatsRaw } = useAsync(
    () => fetchTeamPairStats(teamId!).catch(() => []),
    [teamId],
    !!teamId,
  );
  const pairStats = useMemo<PairStatsMap | undefined>(() => {
    if (!pairStatsRaw || pairStatsRaw.length === 0) return undefined;
    const m: PairStatsMap = new Map();
    for (const r of pairStatsRaw) m.set(pairKey(r.a, r.b), { wins: r.wins, played: r.played });
    return m;
  }, [pairStatsRaw]);

  const PLAYERS: DbPlayer[] = useMemo(() => data?.players ?? [], [data]);
  const byId = useMemo(() => new Map(PLAYERS.map((p) => [p.id, p])), [PLAYERS]);
  const playerById = useCallback((pid: string | null) => (pid ? byId.get(pid) ?? null : null), [byId]);
  const pairPoints = useCallback(
    (pair: Pair) => pair.reduce((sum, pid) => sum + (playerById(pid)?.pts ?? 0), 0),
    [playerById],
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
    [courtCount],
  );

  useEffect(() => {
    if (!data) return;
    const active = data.variants.find((v) => v.isActive) ?? data.variants[0];
    setVariantId(active?.id ?? null);
    setCourts(buildCourts(data.lineup));
    setDirty(false);
  }, [data, buildCourts]);

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
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [usePosition, setUsePosition] = useState(true);
  const [includeMaybe, setIncludeMaybe] = useState(false);
  const [notify, setNotify] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "warning">("success");
  const [variantBusy, setVariantBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showNo, setShowNo] = useState(false);
  const [genKey, setGenKey] = useState(0);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function say(msg: string, tone: "success" | "warning" = "success") {
    setToastTone(tone);
    setToast(msg);
  }

  function nextLabel() {
    const used = new Set<number>();
    for (const v of variants) {
      const m = v.label.match(/^Variante (\d+)$/);
      if (m) used.add(Number(m[1]));
    }
    let n = 1;
    while (used.has(n)) n++;
    return `Variante ${n}`;
  }

  async function addVariant(cloneFrom?: { id: string; label: string }) {
    if (variantBusy || variants.length >= 5) return;
    setVariantBusy(true);
    const res = await guardedWrite(cloneFrom ? "duplicar la variante" : "crear la variante", async () => {
      const created = await createLineupVariant(id, nextLabel());
      if (cloneFrom) await cloneLineupVariantPairs(cloneFrom.id, created.id);
      return created;
    });
    setVariantBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setVariantId(res.data.id);
      say(cloneFrom ? `«${res.data.label}»: copia de «${cloneFrom.label}»` : `«${res.data.label}» creada`);
    } else say(res.reason, "warning");
  }

  async function saveVariantName() {
    if (!variant || variantBusy) return;
    const label = renameValue.trim();
    if (!label) return;
    setVariantBusy(true);
    const res = await guardedWrite("renombrar la variante", () => renameLineupVariant(variant.id, label));
    setVariantBusy(false);
    setRenameOpen(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      say("Variante renombrada");
    } else say(res.reason, "warning");
  }

  async function removeVariant() {
    if (!variant || variantBusy || variant.isActive) return;
    setVariantBusy(true);
    const res = await guardedWrite("borrar la variante", () => deleteLineupVariant(variant.id));
    setVariantBusy(false);
    setConfirmDeleteVariant(false);
    if (res.ok) {
      setVariantId(null);
      setReloadKey((k) => k + 1);
      say("Variante borrada");
    } else say(res.reason, "warning");
  }

  async function makeOfficial() {
    if (!variant || variantBusy || variant.isActive) return;
    setVariantBusy(true);
    const res = await guardedWrite("hacer oficial la alineación", () => setActiveLineupVariant(variant.id));
    setVariantBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      say(`«${variant.label}» es ahora la alineación oficial`);
    } else say(res.reason, "warning");
  }

  async function copyFrom(sourceId: string, sourceLabel: string) {
    if (!variant || variantBusy) return;
    setVariantBusy(true);
    const res = await guardedWrite("copiar las parejas", () => cloneLineupVariantPairs(sourceId, variant.id));
    setVariantBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      say(`Parejas copiadas de «${sourceLabel}»`);
    } else say(res.reason, "warning");
  }

  // Solo el capitán edita. El club ve la de cualquiera de sus equipos en
  // lectura (como en la app: el club_admin no edita).
  const derivedLock: Lock =
    lock ?? (role !== "capitan" ? "notCaptain" : data?.matchday.status === "finished" ? "closed" : "none");
  const readOnly = derivedLock !== "none";

  const placed = useMemo(() => new Set(courts.flat().filter(Boolean) as string[]), [courts]);

  // Convocatoria: sin poder leerla, cae a la marca general de la jornada.
  const availMap = availError ? null : availDetail ?? null;
  const noReplies = !availMap || Object.keys(availMap).length === 0;
  const groupOf = useCallback(
    (p: DbPlayer): Group => {
      if (!availMap) {
        const legacy = data && p.id in data.availability ? data.availability[p.id] : p.available;
        return legacy === true ? "yes" : legacy === false ? "no" : "pending";
      }
      const st = availMap[p.id]?.status;
      return st === "yes" ? "yes" : st === "maybe" ? "maybe" : st === "no" ? "no" : "pending";
    },
    [availMap, data],
  );

  const counts = useMemo(() => {
    const r = { yes: 0, maybe: 0, pending: 0, no: 0 };
    PLAYERS.filter((p) => p.active).forEach((p) => {
      r[groupOf(p)] += 1;
    });
    return r;
  }, [PLAYERS, groupOf]);

  const bench = useMemo(() => {
    const g: Record<Group, DbPlayer[]> = { yes: [], maybe: [], pending: [], no: [] };
    PLAYERS.filter((p) => !placed.has(p.id) && p.active)
      .sort((a, b) => b.pts - a.pts)
      .forEach((p) => g[groupOf(p)].push(p));
    return g;
  }, [PLAYERS, placed, groupOf]);

  const filtered = (list: DbPlayer[]) =>
    query.trim()
      ? list.filter((p) => (p.name + " " + (p.alias ?? "")).toLowerCase().includes(query.trim().toLowerCase()))
      : list;

  const points = courts.map((p) => pairPoints(p));
  const filledArr = courts.map((p) => !!p[0] && !!p[1]);
  const breaks = points.map((pt, i) => i > 0 && filledArr[i] && filledArr[i - 1] && pt > points[i - 1]);
  const filledCourts = filledArr.filter(Boolean).length;
  const complete = courts.length > 0 && filledCourts === courts.length;
  const firstBreak = breaks.findIndex(Boolean);
  const teamPts = points.reduce((a, b) => a + b, 0);

  function setPairs(next: Pair[]) {
    setCourts(next);
    setDirty(true);
  }

  function slotOf(pid: string): Slot | null {
    for (let c = 0; c < courts.length; c++) {
      for (const i of [0, 1] as const) if (courts[c][i] === pid) return { court: c, idx: i };
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
    // Aviso (no bloquea) si alguien que dijo «No» entra a pista.
    const p = playerById(pid);
    if (!from && p && !noReplies && groupOf(p) === "no") {
      say(`${firstName(p.name)} dijo que no puede ir a esta jornada`, "warning");
    }
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

  /** Ordena las parejas por puntos (la más fuerte en la pista 1). */
  function sortByPoints() {
    const next = courts
      .map((p) => {
        const a = playerById(p[0]);
        const b = playerById(p[1]);
        return (a && b && b.pts > a.pts ? [p[1], p[0]] : p) as Pair;
      })
      .sort((x, y) => {
        const fx = (x[0] ? 1 : 0) + (x[1] ? 1 : 0);
        const fy = (y[0] ? 1 : 0) + (y[1] ? 1 : 0);
        if (fx !== fy) return fy - fx;
        return pairPoints(y) - pairPoints(x);
      });
    setPairs(next);
  }

  /** «Rellenar con los que van»: huecos vacíos con los Voy, por puntos. */
  function fillWithGoers() {
    const pool = (noReplies ? [...bench.yes, ...bench.pending] : bench.yes).slice();
    if (pool.length === 0) {
      say("No queda nadie que vaya en el banquillo", "warning");
      return;
    }
    const next = courts.map((p) => [...p] as Pair);
    for (const pair of next) {
      for (const i of [0, 1] as const) {
        if (!pair[i] && pool.length) pair[i] = pool.shift()!.id;
      }
    }
    setPairs(next);
  }

  // Generador: parte de quienes dijeron Voy; Duda con un toque.
  const genOptions = useMemo<LineupOption[]>(() => {
    if (!genOpen) return [];
    const pool = PLAYERS.map((p) => {
      const g = groupOf(p);
      const available = noReplies ? g === "yes" || g === "pending" : g === "yes" || (includeMaybe && g === "maybe");
      return { id: p.id, pts: p.pts, position: p.position, active: p.active, available };
    });
    return generateLineupOptions(pool, courts.length, { stats: pairStats, usePosition, mustOrder: true });
  }, [genOpen, PLAYERS, groupOf, noReplies, includeMaybe, courts.length, pairStats, usePosition]);

  function chemistryLine(opt: LineupOption): string | null {
    if (opt.key !== "quimica" || !pairStats) return null;
    let best: { a: DbPlayer; b: DbPlayer; wins: number; played: number } | null = null;
    for (const s of opt.result.slots) {
      if (!s.playerAId || !s.playerBId) continue;
      const st = pairStats.get(pairKey(s.playerAId, s.playerBId));
      const a = playerById(s.playerAId);
      const b = playerById(s.playerBId);
      if (!st || !a || !b || !st.played) continue;
      if (!best || st.wins > best.wins) best = { a, b, wins: st.wins, played: st.played };
    }
    return best ? `${lastName(best.a.name)} y ${lastName(best.b.name)}: ${best.wins} de ${best.played}` : null;
  }

  function applyOption(opt: LineupOption) {
    const next: Pair[] = Array.from({ length: courts.length }, () => [null, null]);
    for (const s of opt.result.slots) {
      if (s.court - 1 < next.length) next[s.court - 1] = [s.playerAId, s.playerBId];
    }
    setPairs(next);
    setGenOpen(false);
    setGenKey((k) => k + 1);
    if (opt.result.warnings.length) say(opt.result.warnings.join(" · "), "warning");
    else say(`Alineación generada · ${opt.label}`);
  }

  function openPublish() {
    setNotify(dirty || !variant?.isActive);
    setPublishOpen(true);
  }

  async function publish() {
    if (!variantId) {
      setPublishOpen(false);
      say("No hay una variante de alineación para guardar.", "warning");
      return;
    }
    setPublishing(true);
    const wasActive = !!variant?.isActive;
    const res = await guardedWrite("publicar la alineación", async () => {
      await saveLineupVariant(id, variantId, courts);
      if (!wasActive) await setActiveLineupVariant(variantId);
    });
    setPublishing(false);
    setPublishOpen(false);
    if (res.ok) {
      setDirty(false);
      if (notify) void notifyLineupPublished(id);
      setReloadKey((k) => k + 1);
      say(notify ? "Publicada · el equipo recibe el aviso" : "Publicada");
    } else say(res.reason, "warning");
  }

  async function respond(status: AvailStatus, playerId: string) {
    setRsvpBusy(true);
    const res = await guardedWrite("guardar tu respuesta", () => respondAvailability(id, playerId, status));
    setRsvpBusy(false);
    if (res.ok) setAvailKey((k) => k + 1);
    else say(res.reason, "warning");
  }

  if (!teamId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconCalendar size={24} />} title="Sin equipo activo" body="Entra con una cuenta que pertenezca a un equipo." />
        </Card>
      </div>
    );
  }
  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconAlert size={24} />} title="No se pudo cargar la alineación" body={error} />
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconCalendar size={24} />} title="Jornada no encontrada" body="Puede que se haya borrado o que no sea de tu equipo." />
        </Card>
      </div>
    );
  }

  const m = data.matchday;
  const dragged = dragId ? playerById(dragId) : null;
  const otherVariants = variant ? variants.filter((v) => v.id !== variant.id) : [];
  const stripSub = [formatDate(m.date), m.time ? m.time.slice(0, 5) : null, m.isHome ? "local" : "visitante"]
    .filter(Boolean)
    .join(" · ");
  const selectedName = selected ? firstName(playerById(selected)?.name ?? "") : null;
  const myPlayer = user ? PLAYERS.find((p) => p.userId === user.id) ?? null : null;

  const statusLine = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5 }}>
      <strong>
        {filledCourts}/{courts.length} parejas
      </strong>
      <span style={{ color: "var(--text-faint)" }}>·</span>
      {firstBreak === -1 ? (
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>orden correcto ✓</span>
      ) : (
        <span style={{ color: "var(--warning)", fontWeight: 700 }}>P{firstBreak + 1} rompe el orden</span>
      )}
      {teamPts > 0 && (
        <>
          <span style={{ color: "var(--text-faint)" }}>·</span>
          <span className="mono" style={{ color: "var(--text-muted)" }}>
            {fmt(teamPts)} pts
          </span>
        </>
      )}
    </div>
  );

  const strip = (pill?: string | null) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <Avatar initials={initials(activeTeam?.name ?? "")} size={36} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 className="tw-page-title truncate" style={{ margin: 0 }}>
          J{m.round} · vs {m.opponent}
        </h1>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{stripSub}</div>
      </div>
      {pill && <Chip>{pill}</Chip>}
    </div>
  );
  const goersPill = !noReplies && counts.yes > 0 ? `${counts.yes} van` : null;

  /* ── Vista de lectura (jugador y club) ─────────────────────────── */
  if (role !== "capitan") {
    const isClub = role === "club";
    const active = variants.find((v) => v.isActive) ?? null;
    const published = !!active && courts.some((p) => p[0] || p[1]);
    const myCourt = myPlayer ? courts.findIndex((p) => p[0] === myPlayer.id || p[1] === myPlayer.id) : -1;
    const partnerId = myCourt >= 0 ? (courts[myCourt][0] === myPlayer!.id ? courts[myCourt][1] : courts[myCourt][0]) : null;
    const partner = playerById(partnerId);
    const st = myPlayer && partnerId && pairStats ? pairStats.get(pairKey(myPlayer.id, partnerId)) : undefined;
    const myStatus = myPlayer && availMap ? availMap[myPlayer.id]?.status ?? null : null;
    const roles =
      myPlayer && partner
        ? myPlayer.position === "Drive" && partner.position === "Revés"
          ? `Tú de drive y ${firstName(partner.name)} de revés`
          : myPlayer.position === "Revés" && partner.position === "Drive"
            ? `Tú de revés y ${firstName(partner.name)} de drive`
            : null
        : null;

    return (
      <div className="tw-page-narrow">
        <Link href={`/jornada/${m.id}`} className="tw-back" style={{ marginBottom: 8 }}>
          <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
          Jornada {m.round}
        </Link>
        <Card style={{ marginBottom: 16 }}>{strip(published ? null : goersPill)}</Card>

        {isClub && (
          <Note icon={<IconLock size={15} />} style={{ marginBottom: 16 }}>
            Vista del club, solo lectura. Para editarla, pasa a modo capitán desde tu perfil.
          </Note>
        )}

        {!published ? (
          <>
            <Card quiet>
              <EmptyState
                icon={<IconClock size={22} />}
                title="Aún no hay alineación"
                body="El capitán la publica cuando cierre la convocatoria. Te llegará un aviso."
              />
            </Card>
            {!isClub && myPlayer && m.status !== "finished" && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tu respuesta</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                  {(["yes", "maybe", "no"] as AvailStatus[]).map((s) => (
                    <Btn
                      key={s}
                      variant={myStatus === s ? (s === "yes" ? "accent" : "tint") : "ghost"}
                      disabled={rsvpBusy}
                      onClick={() => void respond(s, myPlayer.id)}
                      aria-pressed={myStatus === s}
                    >
                      {s === "yes" ? "Voy" : s === "maybe" ? "Duda" : "No puedo"}
                    </Btn>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          <>
            {!isClub && myCourt >= 0 && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="card"
                style={{
                  padding: 16,
                  marginBottom: 16,
                  borderColor: "var(--accent-40)",
                  background: "radial-gradient(120% 90% at 0% 0%, var(--accent-16), var(--bg-card) 60%)",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", marginBottom: 10 }}>
                  Tu pareja · pista {myCourt + 1}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "flex" }}>
                    <Avatar initials={initials(myPlayer!.name)} src={myPlayer!.photoUrl} size={40} />
                    <Avatar
                      initials={initials(partner?.name ?? "?")}
                      src={partner?.photoUrl ?? null}
                      size={40}
                      style={{ marginLeft: -14, boxShadow: "0 0 0 2px var(--bg-card)" }}
                    />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>Con {partner?.name ?? "tu pareja"}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {[roles, points[myCourt] ? `${fmt(points[myCourt])} pts` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </div>
                {st && st.played > 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>
                    Habéis jugado {st.played} {st.played === 1 ? "partido" : "partidos"} juntos y ganado {st.wins}
                  </div>
                )}
              </motion.div>
            )}
            {isClub && <div style={{ marginBottom: 10 }}>{statusLine}</div>}
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Alineación oficial</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {courts.map((pair, c) => {
                const a = playerById(pair[0]);
                const b = playerById(pair[1]);
                const mine = !isClub && c === myCourt;
                return (
                  <div key={c} style={{ display: "contents" }}>
                    {c > 0 && <Gap broken={breaks[c]} />}
                    <CourtLine n={c + 1} pts={points[c]} broken={breaks[c]} me={mine}>
                      <ReadSlot p={a} name={null} me={!!myPlayer && a?.id === myPlayer.id && !isClub} />
                      <ReadSlot p={b} name={null} me={!!myPlayer && b?.id === myPlayer.id && !isClub} />
                    </CourtLine>
                  </div>
                );
              })}
            </div>
            {isClub && !noReplies && (
              <p style={{ marginTop: 12, textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>
                Convocatoria: {counts.yes} van · {counts.maybe} con duda · {counts.no} no
                {counts.pending ? ` · ${counts.pending} sin contestar` : ""}
              </p>
            )}
          </>
        )}

        {toast && <Toast tone={toastTone} title={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  /* ── Editor del capitán ────────────────────────────────────────── */
  return (
    <div className="tw-lineup-wrap">
      <div className="tw-lineup-head">
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <Link href={`/jornada/${m.id}`} className="tw-back" style={{ marginBottom: 6 }}>
            <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            Jornada {m.round}
          </Link>
          {strip(goersPill)}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {dirty && !readOnly && (
            <Chip tone="warning" plain>
              Sin guardar
            </Chip>
          )}
          <Btn variant="ghost" disabled={readOnly || !variantId} onClick={() => setGenOpen(true)} icon={<IconZap size={15} />}>
            Generar
          </Btn>
          <Btn variant="accent" disabled={readOnly || !complete} onClick={openPublish} icon={<IconCheck size={15} />}>
            {complete ? "Publicar" : `Faltan ${courts.length - filledCourts}`}
          </Btn>
        </div>

        {variants.length > 0 && (
          <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                    title={v.isActive ? "Alineación oficial" : undefined}
                  >
                    {v.isActive && <span style={{ color: "var(--accent)" }}>★ </span>}
                    {v.label}
                  </button>
                );
              })}
              {!readOnly && variants.length < 5 && (
                <button type="button" onClick={() => void addVariant()} disabled={variantBusy} className="seg-item" aria-label="Nueva variante">
                  ＋
                </button>
              )}
            </div>
            {!readOnly && variant && (
              <div style={{ position: "relative" }}>
                <Btn size="sm" variant="quiet" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} icon={<IconChevronDown size={14} />}>
                  Más
                </Btn>
                {moreOpen && (
                  <div className="tw-popover" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 260, padding: 6, zIndex: 40 }}>
                    {!variant.isActive && (
                      <button type="button" className="tw-popitem" disabled={variantBusy} onClick={() => { setMoreOpen(false); void makeOfficial(); }}>
                        ★ Marcar oficial
                      </button>
                    )}
                    <button
                      type="button"
                      className="tw-popitem"
                      disabled={variantBusy || variants.length >= 5}
                      onClick={() => { setMoreOpen(false); void addVariant({ id: variant.id, label: variant.label }); }}
                    >
                      Duplicar «{variant.label}»
                    </button>
                    <button type="button" className="tw-popitem" disabled={variantBusy} onClick={() => { setRenameValue(variant.label); setRenameOpen(true); setMoreOpen(false); }}>
                      Renombrar
                    </button>
                    {otherVariants.map((v) => (
                      <button key={v.id} type="button" className="tw-popitem" disabled={variantBusy} onClick={() => { setMoreOpen(false); void copyFrom(v.id, v.label); }}>
                        Copiar parejas de «{v.label}»
                      </button>
                    ))}
                    <div className="tw-pop-sep" />
                    <button type="button" className="tw-popitem" onClick={() => { setMoreOpen(false); sortByPoints(); }}>
                      Ordenar por puntos
                    </button>
                    <button type="button" className="tw-popitem" onClick={() => { setMoreOpen(false); fillWithGoers(); }}>
                      Rellenar con los que van
                    </button>
                    <button
                      type="button"
                      className="tw-popitem"
                      disabled={placed.size === 0}
                      onClick={() => { setMoreOpen(false); setPairs(courts.map(() => [null, null])); }}
                    >
                      Vaciar alineación
                    </button>
                    {!variant.isActive && (
                      <>
                        <div className="tw-pop-sep" />
                        <button type="button" className="tw-popitem" style={{ color: "var(--error)" }} disabled={variantBusy} onClick={() => { setMoreOpen(false); setConfirmDeleteVariant(true); }}>
                          Borrar esta variante
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <span style={{ marginLeft: "auto" }}>{statusLine}</span>
          </div>
        )}
      </div>

      {readOnly && (
        <Note icon={<IconLock size={15} />} style={{ marginBottom: 14 }}>
          {derivedLock === "archived" ? "Temporada archivada: la alineación es de solo lectura." : "Acta cerrada: la alineación es de solo lectura."}
        </Note>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <div className="tw-lineup-grid">
          <div className="tw-courts" style={{ gridTemplateColumns: "minmax(0,1fr)", gap: 6 }}>
            {courts.map((pair, c) => {
              const a = playerById(pair[0]);
              const b = playerById(pair[1]);
              return (
                <motion.div
                  key={`${genKey}-${c}`}
                  initial={genKey > 0 && !reduce ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: c * 0.04 }}
                  style={{ display: "grid", gap: 6 }}
                >
                  {c > 0 && <Gap broken={breaks[c]} />}
                  <CourtLine n={c + 1} pts={points[c]} sub={a && b ? `${fmt(a.pts)}·${fmt(b.pts)}` : null} broken={breaks[c]}>
                    {([0, 1] as const).map((idx) => (
                      <SlotBox
                        key={idx}
                        slot={{ court: c, idx }}
                        player={idx === 0 ? a : b}
                        dragging={dragId}
                        selectedName={selectedName}
                        selectedId={selected}
                        readOnly={readOnly}
                        onTapChip={(pid) => tapChip(pid, { court: c, idx })}
                        onTapEmpty={() => selected && place(selected, { court: c, idx })}
                      />
                    ))}
                  </CourtLine>
                </motion.div>
              );
            })}
            {selected && !readOnly && (
              <Note tone="accent" style={{ marginTop: 6 }}>
                Toca un hueco o a otro jugador para colocar a {selectedName}. Toca el banquillo para retirarlo.
              </Note>
            )}
          </div>

          <Card flush className="tw-bench">
            <CardHead title={`Banquillo · convocatoria J${m.round}`} count={bench.yes.length + bench.maybe.length + bench.pending.length} />
            <div style={{ padding: "12px 14px 0" }}>
              <InputWrap icon={<IconSearch size={14} />}>
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nombre" aria-label="Filtrar jugadores" />
              </InputWrap>
            </div>
            <div style={{ padding: 14 }}>
              <BenchDrop readOnly={readOnly}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {(["yes", "maybe", "pending"] as Group[]).flatMap((g) =>
                    filtered(bench[g]).map((p) => (
                      <DraggableChip key={p.id} p={p} group={g} selected={selected === p.id} readOnly={readOnly} onTap={() => tapChip(p.id)} />
                    )),
                  )}
                  {bench.yes.length + bench.maybe.length + bench.pending.length === 0 && (
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-faint)", textAlign: "center", padding: "18px 0" }}>
                      Los que van ya están en pista
                    </p>
                  )}
                </div>
              </BenchDrop>

              {bench.no.length > 0 && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowNo((v) => !v)}
                    className="btn btn-quiet btn-sm"
                    style={{ width: "100%", justifyContent: "space-between" }}
                    aria-expanded={showNo}
                  >
                    <span>
                      {bench.no.length} {bench.no.length === 1 ? "no puede" : "no pueden"}
                    </span>
                    <IconChevronDown size={14} style={{ transform: showNo ? "rotate(180deg)" : "none" }} />
                  </button>
                  {showNo && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, opacity: 0.65 }}>
                      {filtered(bench.no).map((p) => (
                        <DraggableChip key={p.id} p={p} group="no" selected={selected === p.id} readOnly={readOnly} onTap={() => tapChip(p.id)} />
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

      {/* ══ Generar ═══════════════════════════════════════════════ */}
      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        labelledBy="gen-titulo"
        width={560}
        title="Generar con los que van"
        lede="Elige cómo armarla. No se aplica hasta que tocas «Usar»."
        footer={<Btn onClick={() => setGenOpen(false)}>Cancelar</Btn>}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 14, borderRadius: "var(--r-md)", background: "var(--bg-card-2)", border: "1px solid var(--line)" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Emparejar drive y revés</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "var(--text-muted)" }}>Si lo quitas, empareja solo por puntos.</span>
          </span>
          <Toggle on={usePosition} onChange={() => setUsePosition((v) => !v)} label="Emparejar drive y revés" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {genOptions.map((opt, i) => {
            const chem = chemistryLine(opt);
            return (
              <div
                key={opt.key}
                style={{
                  padding: 14,
                  borderRadius: "var(--r-md)",
                  background: "var(--bg-card-2)",
                  border: `1px solid ${i === 0 ? "var(--accent-40)" : "var(--line)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{opt.label}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {opt.hint}
                      {chem ? ` · ${chem}` : ""}
                    </span>
                  </span>
                  <Btn size="sm" variant={i === 0 ? "accent" : "ghost"} onClick={() => applyOption(opt)}>
                    Usar
                  </Btn>
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 2 }}>
                  {opt.result.slots.map((s) => {
                    const a = playerById(s.playerAId);
                    const b = playerById(s.playerBId);
                    return (
                      <div key={s.court} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
                        <span className="truncate">
                          {s.court} · {a ? lastName(a.name) : "—"} / {b ? lastName(b.name) : "—"}
                        </span>
                        <span className="mono" style={{ color: "var(--text-faint)" }}>
                          {a && b ? fmt(a.pts + b.pts) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {opt.result.warnings.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--warning)" }}>{opt.result.warnings.join(" · ")}</div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--text-faint)", textAlign: "center" }}>
          {noReplies ? (
            "Nadie ha contestado aún: se usa la disponibilidad general."
          ) : (
            <>
              {includeMaybe ? "Con los de Voy y Duda" : `Solo con los que han dicho Voy (${counts.yes})`}
              {counts.maybe > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="link-action"
                    style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontSize: "inherit" }}
                    onClick={() => setIncludeMaybe((v) => !v)}
                  >
                    {includeMaybe ? "quitar a los de Duda" : `incluir a los de Duda (${counts.maybe})`}
                  </button>
                </>
              )}
            </>
          )}
        </p>
      </Modal>

      {/* ══ Publicar ══════════════════════════════════════════════ */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        labelledBy="pub-titulo"
        width={520}
        title={`Publicar la alineación de la J${m.round}`}
        lede={`vs ${m.opponent} · ${stripSub}`}
        footer={
          <>
            <Btn onClick={() => setPublishOpen(false)}>Seguir editando</Btn>
            <Btn
              variant={firstBreak === -1 ? "accent" : "tint"}
              disabled={publishing}
              onClick={() => void publish()}
              icon={<IconCheck size={15} />}
            >
              {publishing ? "Publicando…" : firstBreak === -1 ? "Publicar" : "Publicar igualmente"}
            </Btn>
          </>
        }
      >
        {firstBreak > 0 && (
          <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
            <strong>
              La P{firstBreak + 1} suma más que la P{firstBreak}
            </strong>
            {" · "}
            {fmt(points[firstBreak])} frente a {fmt(points[firstBreak - 1])}. La federación puede rechazar el acta.
          </Note>
        )}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {courts.map((pair, c) => {
            const a = playerById(pair[0]);
            const b = playerById(pair[1]);
            const warn = breaks[c] || breaks[c + 1];
            return (
              <div key={c} className="list-row" style={{ minHeight: 40, padding: "8px 14px", color: warn ? "var(--warning)" : undefined }}>
                <span className="mono" style={{ fontSize: 12.5, width: 26 }}>
                  P{c + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                  {a && b ? `${lastName(a.name)} / ${lastName(b.name)}` : "Vacío"}
                </span>
                <span className="mono" style={{ fontSize: 12.5 }}>
                  {fmt(points[c])}
                </span>
              </div>
            );
          })}
        </div>
        {firstBreak > 0 && (
          <Btn size="sm" variant="ghost" style={{ marginTop: 10 }} onClick={sortByPoints} icon={<IconZap size={14} />}>
            Ordenar por puntos
          </Btn>
        )}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 16, padding: 14, borderRadius: "var(--r-md)", background: "var(--bg-card-2)", border: "1px solid var(--line)" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Avisar al equipo</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 12.5, color: "var(--text-muted)" }}>
              A los {filledCourts * 2} convocados les llega «Ya está la alineación».
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
              <Btn variant="accent" disabled={variantBusy || !renameValue.trim()} onClick={() => void saveVariantName()}>
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

      {toast && <Toast tone={toastTone} title={toast} onClose={() => setToast(null)} />}

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
