"use client";

import { useEffect, useState } from "react";

import { Eyebrow, Modal, Toggle } from "@/components/ui";
import { Toast } from "@/components/states";
import { fetchTeam, updateTeam } from "@/lib/queries";
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
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  initialCategory: string | null;
}) {
  const [cat, setCat] = useState(initialCategory ?? "2ª");
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("A");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  return (
    <Modal open={open} onClose={onClose} labelledBy="edit-equipo" width={520}>
      <Eyebrow>EDITAR EQUIPO</Eyebrow>
      <h2 id="edit-equipo" style={{ margin: "10px 0 6px", fontSize: 23 }}>
        {teamName}
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Corrige la categoría o completa el grupo cuando se sortee la liga.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <span
            className="mono"
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-faint)",
              marginBottom: 8,
            }}
          >
            CATEGORÍA
          </span>
          <div style={cellRow}>
            {TEAM_CATEGORIES.map((v) => {
              const on = cat === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCat(v)}
                  style={{
                    minWidth: 52,
                    padding: "11px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "'Satoshi', sans-serif",
                    fontSize: 15,
                    fontWeight: on ? 700 : 500,
                    color: on ? "var(--accent)" : "var(--text)",
                    background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                    border: on
                      ? "1.5px solid var(--accent)"
                      : "1px solid var(--hair-strong)",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--text-faint)",
              }}
            >
              GRUPO
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Toggle
                on={hasGroup}
                onChange={() => setHasGroup((v) => !v)}
                label="Con grupo"
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {hasGroup ? "Sí" : "Sin grupos"}
              </span>
            </span>
          </div>
          {hasGroup ? (
            <div style={cellRow}>
              {TEAM_GROUPS.map((g) => {
                const on = group === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    style={{
                      flex: 1,
                      minWidth: 60,
                      padding: "12px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontFamily: "'Satoshi', sans-serif",
                      fontSize: 16,
                      fontWeight: on ? 700 : 500,
                      color: on ? "var(--accent)" : "var(--text)",
                      background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                      border: on
                        ? "1.5px solid var(--accent)"
                        : "1px solid var(--hair-strong)",
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
              Actívalo cuando conozcas tu grupo; podrás cambiarlo aquí en
              cualquier momento.
            </p>
          )}
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
          onClick={onClose}
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          Cancelar
        </button>
        <button
          className="btn btn-accent"
          disabled={busy}
          onClick={save}
          style={{ padding: "12px 22px", fontSize: 13.5 }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
}
