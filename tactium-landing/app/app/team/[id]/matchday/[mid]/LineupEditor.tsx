"use client";

import { useMemo, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { Reveal } from "@/app/app/ui/Reveal";

export interface EditorPlayer {
  id: string;
  name: string;
  alias: string | null;
  pts: number | null;
  position: string | null;
  photo_url: string | null;
  available?: boolean | null;
}
export interface Slot {
  court: number;
  aId: string | null;
  bId: string | null;
}

const dn = (p: EditorPlayer) =>
  p.alias && p.alias.trim() ? p.alias.trim() : p.name;
const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
const posColor = (pos: string | null) =>
  pos === "Drive"
    ? "var(--color-accent)"
    : pos === "Revés" || pos === "Reves"
      ? "#60A5FA"
      : "var(--color-text-faint)";

type Origin = "bench" | { court: number; half: "a" | "b" };
type Picked = { id: string; origin: Origin } | null;

export function LineupEditor({
  matchdayId,
  players,
  initialSlots,
  variantId,
  canEdit,
}: {
  matchdayId: string;
  courts: number;
  players: EditorPlayer[];
  initialSlots: Slot[];
  variantId: string | null;
  canEdit: boolean;
}) {
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [picked, setPicked] = useState<Picked>(null);
  const [vId, setVId] = useState<string | null>(variantId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );

  const byId = useMemo(() => {
    const m = new Map<string, EditorPlayer>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const assigned = useMemo(() => {
    const s = new Set<string>();
    slots.forEach((sl) => {
      if (sl.aId) s.add(sl.aId);
      if (sl.bId) s.add(sl.bId);
    });
    return s;
  }, [slots]);

  // Banquillo = jugadores DISPONIBLES no asignados (igual que la app móvil).
  // Los no disponibles ya colocados en pista se mantienen; solo se ocultan
  // como candidatos del banquillo.
  const bench = useMemo(
    () =>
      players
        .filter((p) => !assigned.has(p.id) && p.available !== false)
        .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0)),
    [players, assigned],
  );

  const pairPts = (s: Slot) =>
    (s.aId ? (byId.get(s.aId)?.pts ?? 0) : 0) +
    (s.bId ? (byId.get(s.bId)?.pts ?? 0) : 0);
  const maxPair = Math.max(1, ...slots.map(pairPts));

  const clone = () => slots.map((s) => ({ ...s }));
  const setHalf = (next: Slot[], court: number, half: "a" | "b", id: string | null) => {
    const i = next.findIndex((s) => s.court === court);
    if (i >= 0) next[i] = { ...next[i], [half === "a" ? "aId" : "bId"]: id };
  };
  const getHalf = (court: number, half: "a" | "b") => {
    const s = slots.find((x) => x.court === court);
    return half === "a" ? (s?.aId ?? null) : (s?.bId ?? null);
  };

  const place = (id: string, origin: Origin, court: number, half: "a" | "b") => {
    if (!canEdit) return;
    const occupant = getHalf(court, half);
    const next = clone();
    setHalf(next, court, half, id);
    if (origin !== "bench") setHalf(next, origin.court, origin.half, occupant);
    setSlots(next);
    setPicked(null);
    setDirty(true);
  };
  const toBench = (origin: Origin) => {
    if (!canEdit || origin === "bench") return;
    const next = clone();
    setHalf(next, origin.court, origin.half, null);
    setSlots(next);
    setPicked(null);
    setDirty(true);
  };

  // Click (tap) — alternativa al drag.
  const onZoneClick = (court: number, half: "a" | "b") => {
    if (!canEdit) return;
    const occupant = getHalf(court, half);
    if (picked) place(picked.id, picked.origin, court, half);
    else if (occupant) setPicked({ id: occupant, origin: { court, half } });
  };
  const onTokenClick = (id: string, origin: Origin) => {
    if (!canEdit) return;
    if (picked?.id === id) setPicked(null);
    else setPicked({ id, origin });
  };

  // Drag & drop.
  const dragStart = (e: React.DragEvent, id: string, origin: Origin) => {
    if (!canEdit) return;
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, origin }));
    e.dataTransfer.effectAllowed = "move";
  };
  const parseDrag = (e: React.DragEvent): { id: string; origin: Origin } | null => {
    try {
      return JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return null;
    }
  };

  const save = async () => {
    if (!canEdit || saving) return;
    setSaving(true);
    setMsg(null);
    const sb = getSupabaseApp();
    try {
      let variant = vId;
      if (!variant) {
        const { data, error } = await sb
          .from("lineup_variants")
          .insert({ matchday_id: matchdayId, is_active: true, label: "Principal" })
          .select("id")
          .single();
        if (error) throw error;
        variant = data.id as string;
        setVId(variant);
      }
      const rows = slots.map((s) => ({
        variant_id: variant,
        matchday_id: matchdayId,
        court_number: s.court,
        player_a_id: s.aId,
        player_b_id: s.bId,
      }));
      const { error } = await sb
        .from("lineups")
        .upsert(rows, { onConflict: "variant_id,court_number" });
      if (error) throw error;
      setDirty(false);
      setMsg({ kind: "ok", text: "Alineación guardada." });
    } catch (e) {
      setMsg({
        kind: "error",
        text: (e as { message?: string })?.message ?? "No se pudo guardar.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {canEdit && (
        <div className="flex items-center justify-between gap-3 mb-5">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            {picked ? "Toca una posición para colocarlo." : "Arrastra o toca jugadores."}
          </p>
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="h-10 px-5 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[14px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : dirty ? "Guardar alineación" : "Guardado ✓"}
          </button>
        </div>
      )}
      {msg && (
        <p
          role="alert"
          className={`mb-4 text-[13px] ${msg.kind === "error" ? "text-[var(--color-error)]" : "text-[var(--color-accent)]"}`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid lg:grid-cols-[1fr_240px] gap-6 items-start">
        {/* Pistas en pirámide */}
        <div className="flex flex-col gap-4">
          {slots.map((s, idx) => {
            const pts = pairPts(s);
            return (
              <Reveal
                key={s.court}
                delay={Math.min(idx * 40, 240)}
                className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] overflow-hidden transition hover:border-[var(--color-accent-40)]"
              >
                <div className="flex items-center justify-between px-5 pt-4">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)]">
                      PISTA {s.court}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-faint)]">
                      PAREJA Nº{idx + 1}
                    </span>
                  </div>
                  <span className="font-mono text-[12px] text-[var(--color-text-muted)]">
                    {pts} pts
                  </span>
                </div>
                {/* barra de fuerza */}
                <div className="px-5 pt-2">
                  <div className="h-1 rounded-full bg-[var(--color-hair)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent)] transition-all duration-500"
                      style={{ width: `${(pts / maxPair) * 100}%` }}
                    />
                  </div>
                </div>
                {/* pista cenital */}
                <div
                  className="m-5 mt-3 rounded-xl border border-[var(--color-hair-strong)] grid grid-cols-2 relative"
                  style={{
                    background:
                      "linear-gradient(180deg, var(--color-bg-card-2), var(--color-bg))",
                    minHeight: 116,
                  }}
                >
                  {/* red (línea superior) */}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, var(--color-hair-strong) 0 6px, transparent 6px 12px)",
                    }}
                  />
                  {/* línea central de servicio */}
                  <div
                    aria-hidden
                    className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-[var(--color-hair)]"
                  />
                  <Zone
                    label="JUGADOR 1"
                    id={s.aId}
                    byId={byId}
                    canEdit={canEdit}
                    picked={picked}
                    onClickZone={() => onZoneClick(s.court, "a")}
                    onTokenClick={() => s.aId && onTokenClick(s.aId, { court: s.court, half: "a" })}
                    onRemove={() => toBench({ court: s.court, half: "a" })}
                    onDragStartToken={(e) =>
                      s.aId && dragStart(e, s.aId, { court: s.court, half: "a" })
                    }
                    onDropZone={(e) => {
                      e.preventDefault();
                      const d = parseDrag(e);
                      if (d) place(d.id, d.origin, s.court, "a");
                    }}
                  />
                  <Zone
                    label="JUGADOR 2"
                    id={s.bId}
                    byId={byId}
                    canEdit={canEdit}
                    picked={picked}
                    onClickZone={() => onZoneClick(s.court, "b")}
                    onTokenClick={() => s.bId && onTokenClick(s.bId, { court: s.court, half: "b" })}
                    onRemove={() => toBench({ court: s.court, half: "b" })}
                    onDragStartToken={(e) =>
                      s.bId && dragStart(e, s.bId, { court: s.court, half: "b" })
                    }
                    onDropZone={(e) => {
                      e.preventDefault();
                      const d = parseDrag(e);
                      if (d) place(d.id, d.origin, s.court, "b");
                    }}
                  />
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Banquillo */}
        <div
          className="lg:sticky lg:top-20 rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-4"
          onDragOver={(e) => canEdit && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const d = parseDrag(e);
            if (d) toBench(d.origin);
          }}
        >
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-muted)] mb-3">
            BANQUILLO · {bench.length}
          </p>
          {bench.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-faint)]">
              Todos alineados.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {bench.map((p) => (
                <Token
                  key={p.id}
                  p={p}
                  selected={picked?.id === p.id}
                  canEdit={canEdit}
                  onClick={() => onTokenClick(p.id, "bench")}
                  onDragStart={(e) => dragStart(e, p.id, "bench")}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Zone({
  label,
  id,
  byId,
  canEdit,
  picked,
  onClickZone,
  onTokenClick,
  onRemove,
  onDragStartToken,
  onDropZone,
}: {
  label: string;
  id: string | null;
  byId: Map<string, EditorPlayer>;
  canEdit: boolean;
  picked: Picked;
  onClickZone: () => void;
  onTokenClick: () => void;
  onRemove: () => void;
  onDragStartToken: (e: React.DragEvent) => void;
  onDropZone: (e: React.DragEvent) => void;
}) {
  const p = id ? byId.get(id) ?? null : null;
  return (
    <div
      onClick={onClickZone}
      onDragOver={(e) => canEdit && e.preventDefault()}
      onDrop={onDropZone}
      className={`relative grid place-items-center p-3 min-h-[116px] ${canEdit ? "cursor-pointer" : ""}`}
    >
      <span className="absolute top-1.5 left-0 right-0 text-center font-mono text-[8px] tracking-[0.2em] text-[var(--color-text-faint)]">
        {label}
      </span>
      {p ? (
        <div className="relative">
          <Token
            p={p}
            selected={picked?.id === p.id}
            canEdit={canEdit}
            big
            onClick={(e) => {
              e?.stopPropagation();
              onTokenClick();
            }}
            onDragStart={onDragStartToken}
          />
          {canEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 grid place-items-center rounded-full bg-[var(--color-bg)] border border-[var(--color-hair-strong)] text-[var(--color-text-faint)] hover:text-[var(--color-error)] hover:border-[var(--color-error)] transition text-[12px] leading-none"
              aria-label="Quitar"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <span className="font-mono text-[11px] text-[var(--color-text-faint)]">
          + asignar
        </span>
      )}
    </div>
  );
}

function Token({
  p,
  selected,
  canEdit,
  big,
  onClick,
  onDragStart,
}: {
  p: EditorPlayer;
  selected: boolean;
  canEdit: boolean;
  big?: boolean;
  onClick?: (e?: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const name = dn(p);
  const ring = posColor(p.position);
  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border pl-1 pr-3 py-1 transition select-none ${
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-10)]"
          : "border-[var(--color-hair-strong)] bg-[var(--color-bg)]"
      } ${canEdit ? "cursor-grab active:cursor-grabbing hover:border-[var(--color-accent-40)]" : ""}`}
    >
      <span
        className={`grid place-items-center rounded-full shrink-0 overflow-hidden ${big ? "w-8 h-8" : "w-7 h-7"}`}
        style={{ boxShadow: `0 0 0 1.5px ${ring}` }}
      >
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center bg-[var(--color-bg-raised)] font-mono text-[10px] text-[var(--color-text-muted)]">
            {initials(name)}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold tracking-tight truncate max-w-[110px]">
          {name}
        </span>
        {p.pts != null && (
          <span className="block font-mono text-[9px] text-[var(--color-text-faint)] leading-none">
            {p.pts} pts
          </span>
        )}
      </span>
    </div>
  );
}
