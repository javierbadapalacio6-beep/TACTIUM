"use client";

import { useEffect, useState } from "react";

import { Btn, Field, Modal, Toggle } from "@/components/ui";
import { Toast } from "@/components/states";
import { LogoField } from "@/components/LogoField";
import { deleteTeam, fetchTeam, updateTeam } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { TEAM_CATEGORIES, TEAM_GROUPS } from "@/lib/federations";

/**
 * Editar equipo — espejo de `EditTeamSheet` de la app: solo categoría y grupo
 * (el nombre y la competición se fijan al crear). Botones, no texto libre.
 */
export function EditTeamModal({
  open,
  onClose,
  teamId,
  teamName,
  initialCategory,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  initialCategory: string | null;
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
      lede="Escudo, categoría y grupo del equipo."
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
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

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
}
