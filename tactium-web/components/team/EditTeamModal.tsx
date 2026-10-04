"use client";

import { useEffect, useState } from "react";

import { Btn, Field, Modal, Toggle } from "@/components/ui";
import { Toast } from "@/components/states";
import { LogoField } from "@/components/LogoField";
import { deleteTeam, fetchTeam, updateTeam } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { supabaseBrowser } from "@/lib/supabase/client";
import { TEAM_CATEGORIES, TEAM_GROUPS } from "@/lib/federations";

const DOW = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 22; h++) {
    const hh = String(h).padStart(2, "0");
    out.push(`${hh}:00`, `${hh}:30`);
  }
  out.push("23:00");
  return out;
})();
/** Franja «D|HH:MM» (con día) o la antigua «HH:MM». Mismo formato que la app. */
function fmtSlot(s: string): string {
  if (!s.includes("|")) return s;
  const [d, time] = s.split("|");
  const n = parseInt(d, 10);
  return n >= 1 && n <= 7 ? `${DOW[n]} ${time}` : time;
}

/**
 * Editar equipo — espejo de `EditTeamSheet` de la app: escudo, categoría,
 * grupo y, desde el rediseño 2026-10, las franjas favoritas de local (antes
 * solo en la app). «Borrar el equipo» solo si NO es de un club: los de un club
 * los borra el club (decisión 3 del bloque Equipo).
 */
export function EditTeamModal({
  open,
  onClose,
  teamId,
  teamName,
  initialCategory,
  isClubTeam = false,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  initialCategory: string | null;
  /** Equipo de un club: lo borra el club, no el capitán. */
  isClubTeam?: boolean;
  /** El padre decide a dónde ir: aquí ya no hay equipo que enseñar. */
  onDeleted?: () => void;
}) {
  const [cat, setCat] = useState(initialCategory ?? "2ª");
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("A");
  const [logo, setLogo] = useState<string | null>(null);
  // Si el escudo cambió, al cerrar hay que recargar aunque no se pulse Guardar.
  const [logoDirty, setLogoDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Horarios de local: franjas favoritas y, si las pone un club sede, aviso.
  const [slots, setSlots] = useState<string[]>([]);
  const [venue, setVenue] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [addDow, setAddDow] = useState(6);
  const [addTime, setAddTime] = useState("10:00");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabaseBrowser()
      .from("teams")
      .select("preferred_home_slots, venue_club_id")
      .eq("id", teamId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const row = data as { preferred_home_slots: string[] | null; venue_club_id: string | null };
        setSlots(row.preferred_home_slots ?? []);
        setVenue(!!row.venue_club_id);
      });
    return () => {
      alive = false;
    };
  }, [open, teamId]);

  async function saveSlots(next: string[]) {
    const uniq = Array.from(new Set(next)).sort();
    const prev = slots;
    setSlots(uniq);
    const res = await guardedWrite("guardar las franjas", async () => {
      const { error } = await supabaseBrowser()
        .from("teams")
        .update({ preferred_home_slots: uniq })
        .eq("id", teamId);
      if (error) throw error;
    });
    if (!res.ok) {
      setSlots(prev);
      setToast(res.reason);
    }
  }

  async function doDelete() {
    if (deleting) return;
    setDeleting(true);
    const res = await guardedWrite("borrar el equipo", () => deleteTeam(teamId));
    setDeleting(false);
    if (!res.ok) {
      setConfirmDelete(false);
      setToast(res.reason);
      return;
    }
    onClose();
    onDeleted?.();
  }

  // Rehidrata al abrir: la sesión no trae el grupo, así que se lee de la BD.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCat(initialCategory ?? "2ª");
    fetchTeam(teamId)
      .then((t) => {
        if (!alive || !t) return;
        setCat(t.category ?? "2ª");
        setHasGroup(!!t.group_name);
        setGroup(t.group_name ?? "A");
        setLogo(t.logo_url ?? null);
        setLogoDirty(false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, teamId, initialCategory]);

  async function save() {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("guardar el equipo", () =>
      updateTeam(teamId, {
        category: cat || null,
        group_name: hasGroup ? group : null,
      }),
    );
    setBusy(false);
    if (res.ok) {
      // Recarga: la sesión relee la categoría/grupo y el resto de vistas.
      window.location.reload();
    } else {
      setToast(res.reason);
    }
  }

  const cellRow: React.CSSProperties = {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  };

  /** Botón "tarjeta" de elección única (categoría, grupo). */
  const cell = (on: boolean): React.CSSProperties => ({
    minWidth: 52,
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: "var(--font-ui)",
    fontSize: 14,
    fontWeight: on ? 700 : 500,
    color: on ? "var(--accent)" : "var(--text)",
    background: on ? "var(--accent-10)" : "var(--bg-card-2)",
    border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
    transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
  });

  return (
    <Modal
      open={open}
      onClose={() => (logoDirty ? window.location.reload() : onClose())}
      labelledBy="edit-equipo"
      width={520}
      title={teamName}
      lede="Escudo, categoría, grupo y horarios de local."
      footer={
        <>
          <Btn onClick={() => (logoDirty ? window.location.reload() : onClose())}>
            {logoDirty ? "Cerrar" : "Cancelar"}
          </Btn>
          <Btn variant="accent" disabled={busy} onClick={save}>
            {busy ? "Guardando…" : "Guardar"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Escudo">
          <LogoField
            kind="team"
            id={teamId}
            value={logo}
            onChange={(url) => {
              setLogo(url);
              setLogoDirty(true);
            }}
            onError={setToast}
          />
        </Field>

        <Field label="Categoría">
          <div style={cellRow} role="radiogroup" aria-label="Categoría">
            {TEAM_CATEGORIES.map((v) => {
              const on = cat === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCat(v)}
                  style={cell(on)}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="field">
          <div
            className="field-label"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>Grupo</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
              <span>{hasGroup ? "Con grupo" : "Sin grupos"}</span>
              <Toggle
                on={hasGroup}
                onChange={() => setHasGroup((v) => !v)}
                label="Con grupo"
              />
            </span>
          </div>
          {hasGroup ? (
            <div style={cellRow} role="radiogroup" aria-label="Grupo">
              {TEAM_GROUPS.map((g) => {
                const on = group === g;
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setGroup(g)}
                    style={{ ...cell(on), flex: 1, minWidth: 60 }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="field-hint">
              Actívalo cuando conozcas tu grupo; podrás cambiarlo aquí en
              cualquier momento.
            </span>
          )}
        </div>
      </div>

      <div className="divider" style={{ margin: "22px 0 16px" }} />

      {/* Horarios de local: una fila propia que se despliega. */}
      <button
        type="button"
        onClick={() => setSlotsOpen((v) => !v)}
        aria-expanded={slotsOpen}
        className="list-row"
        style={{
          width: "100%",
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "var(--bg-card-2)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span className="list-row-main">
          <span className="list-row-title">Horarios de local</span>
          <span className="list-row-sub">
            {venue
              ? "Los pone el club donde juegas de local"
              : slots.length
                ? slots.map(fmtSlot).join(" · ")
                : "Tus franjas favoritas"}
          </span>
        </span>
        <span
          className="list-row-chev"
          style={{ transform: slotsOpen ? "rotate(90deg)" : "none", transition: "transform var(--dur-base) var(--ease)" }}
        >
          ›
        </span>
      </button>
      {slotsOpen && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <span className="field-hint">
            Las horas habituales de local. El club las usa para poner los horarios.
          </span>
          {slots.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip chip-mute"
                  onClick={() => void saveSlots(slots.filter((x) => x !== s))}
                  aria-label={`Quitar ${fmtSlot(s)}`}
                  style={{ cursor: "pointer" }}
                >
                  {fmtSlot(s)} ×
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="tw-select"
              value={addDow}
              onChange={(e) => setAddDow(Number(e.target.value))}
              aria-label="Día"
              style={{ width: "auto" }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {DOW[d]}
                </option>
              ))}
            </select>
            <select
              className="tw-select"
              value={addTime}
              onChange={(e) => setAddTime(e.target.value)}
              aria-label="Hora"
              style={{ width: "auto" }}
            >
              {TIMES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <Btn size="sm" onClick={() => void saveSlots([...slots, `${addDow}|${addTime}`])}>
              Añadir franja
            </Btn>
          </div>
        </div>
      )}

      {isClubTeam ? (
        <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
          Este equipo es de un club: solo el club puede borrarlo.
        </p>
      ) : (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginTop: 16,
          padding: 14,
          borderRadius: 10,
          background: "var(--bg-card-2)",
          border: "1px solid color-mix(in srgb, var(--error) 45%, transparent)",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Borrar equipo</div>
          <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--text-muted)", textWrap: "pretty" }}>
            {`Se borrará «${teamName}» con su plantilla, jornadas y alineaciones. No se puede deshacer.`}
          </div>
        </div>
        {!confirmDelete ? (
          <Btn variant="danger-ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            Borrar equipo
          </Btn>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancelar
            </Btn>
            <Btn variant="danger" size="sm" onClick={() => void doDelete()} disabled={deleting}>
              {deleting ? "Borrando…" : "Sí, borrar el equipo"}
            </Btn>
          </div>
        )}
      </div>
      )}

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
}
