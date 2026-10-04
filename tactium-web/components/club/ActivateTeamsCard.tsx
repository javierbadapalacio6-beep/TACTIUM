"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useSession } from "@/lib/session";
import { updateClub } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { FCP_FEDERATION_CODE } from "@/lib/federations";
import { proHref } from "@/lib/nav";
import { Btn, Card, IconTile, ListRow, Modal, Note } from "@/components/ui";
import { IconCheck, IconFlag, IconPlus, IconUsers } from "@/components/Icon";
import { EASE, Stagger, StaggerItem } from "@/components/entry/motion-bits";

type Choice = "fcp" | "privada";

const PERKS = [
  "Convocatoria Voy / Duda / No en cada jornada",
  "Alineación por puntos y acta",
  "Un capitán por equipo, sin coste para él",
];

/**
 * Espacio de organizador («solo torneos»): la puerta para activar también la
 * gestión de equipos, como en la app. Rediseño 2026-10:
 *  · `full` (pestaña Equipo): una tarjeta de ejemplo con trazo discontinuo,
 *    tres ventajas y «Tus torneos no cambian».
 *  · El selector es Cántabra / Liga privada / Otra federación («irán
 *    entrando»), no la lista de veinte como si todas funcionaran.
 *  · Al activar, un primer paso («¿Por dónde empiezas?») con el paywall como
 *    enlace, no de golpe.
 */
export function ActivateTeamsCard({ full = false }: { full?: boolean }) {
  const { clubId, clubs } = useSession();
  const reduce = useReducedMotion();
  const club = clubs.find((c) => c.id === clubId);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>("fcp");
  const [otherNote, setOtherNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!club?.tournamentsOnly && !done) return null;

  async function activate() {
    if (busy || !club) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("activar la gestión de equipos", () =>
      updateClub(club.id, {
        tournaments_only: false,
        federation: choice === "fcp" ? FCP_FEDERATION_CODE : null,
      }),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    setDone(true);
  }

  // Navegación con recarga completa: la sesión relee el club y el menú pasa
  // al completo.
  const go = (href: string) => {
    window.location.href = href;
  };

  const optionStyle = (on: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--font-ui)",
    color: "var(--text)",
    background: on ? "var(--accent-10)" : "var(--bg-card-2)",
    border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
  });

  return (
    <>
      {full ? (
        <Stagger gap={0.07}>
          <StaggerItem>
            <div
              className="card card-quiet"
              style={{ padding: 16, borderStyle: "dashed", display: "grid", gap: 12 }}
              aria-label="Así quedará la pestaña (ejemplo)"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <IconTile>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                    TU
                  </span>
                </IconTile>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Tu equipo A</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>2ª Masc. · 12 jugadores</div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--line)",
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                }}
              >
                <span>Próxima jornada</span>
                <span style={{ color: "var(--text-faint)" }}>sáb · 10:00 · local</span>
              </div>
            </div>
          </StaggerItem>
          {PERKS.map((p) => (
            <StaggerItem key={p}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 14 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    background: "var(--accent-10)",
                    color: "var(--accent)",
                    flex: "none",
                  }}
                >
                  <IconCheck size={12} />
                </span>
                {p}
              </div>
            </StaggerItem>
          ))}
          <StaggerItem>
            <p style={{ margin: "18px 0 14px", fontSize: 13.5, color: "var(--text-muted)" }}>
              Tus torneos no cambian.
            </p>
            <Btn variant="accent" size="lg" block onClick={() => setOpen(true)}>
              Activar gestión de equipos
            </Btn>
          </StaggerItem>
        </Stagger>
      ) : (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <IconTile>
              <IconUsers size={16} />
            </IconTile>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>¿Llevas también equipos de liga?</div>
              <div style={{ marginTop: 3, fontSize: 13, color: "var(--text-muted)" }}>
                Convocatoria, alineación y acta de cada jornada. Tus torneos no cambian.
              </div>
            </div>
            <Btn onClick={() => setOpen(true)}>Activar</Btn>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => (done ? go("/equipo") : setOpen(false))}
        labelledBy="activar-equipos"
        width={520}
        title={done ? "Equipos activados" : "¿En qué liga juegan?"}
        lede={done ? "¿Por dónde empiezas?" : "Se puede cambiar más adelante."}
        footer={
          done ? (
            <>
              <Btn variant="quiet" onClick={() => go(proHref(undefined, "club"))} style={{ marginRight: "auto" }}>
                Ver planes de club
              </Btn>
              <Btn onClick={() => go("/equipo")}>Lo haré luego</Btn>
            </>
          ) : (
            <>
              <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
              <Btn variant="accent" disabled={busy} onClick={activate}>
                {busy ? "Activando…" : "Activar"}
              </Btn>
            </>
          )
        }
      >
        {done ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <Card flush>
              {choice === "fcp" && (
                <ListRow
                  onClick={() => go("/club/importar")}
                  icon={
                    <IconTile small>
                      <IconFlag size={14} />
                    </IconTile>
                  }
                  title="Traer mis equipos de la Federación"
                  sub="Busca el club y elige cuáles"
                />
              )}
              <ListRow
                onClick={() => go("/club/equipos/nuevo")}
                icon={
                  <IconTile small>
                    <IconPlus size={14} />
                  </IconTile>
                }
                title="Crear un equipo a mano"
                sub="Nombre, categoría y género"
              />
            </Card>
            <Note tone="accent" style={{ marginTop: 14 }}>
              <strong>14 días con todo, sin tarjeta.</strong> Luego eliges plan de club o sigues en
              gratis.
            </Note>
          </motion.div>
        ) : (
          <div role="radiogroup" aria-label="Liga" style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              role="radio"
              aria-checked={choice === "fcp"}
              onClick={() => setChoice("fcp")}
              style={optionStyle(choice === "fcp")}
            >
              <span className="mono" style={{ width: 44, fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                FCP
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                  Federación Cántabra de Pádel
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                  Calendario, grupos y plantillas oficiales
                </span>
              </span>
              {choice === "fcp" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={choice === "privada"}
              onClick={() => setChoice("privada")}
              style={optionStyle(choice === "privada")}
            >
              <span className="mono" style={{ width: 44, fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                —
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Liga privada</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                  SNP, LAPI, interempresas, de club…
                </span>
              </span>
              {choice === "privada" && <IconCheck size={16} style={{ color: "var(--accent)" }} />}
            </button>
            <button
              type="button"
              onClick={() => setOtherNote((v) => !v)}
              aria-expanded={otherNote}
              style={{ ...optionStyle(false), opacity: 0.75 }}
            >
              <span className="mono" style={{ width: 44, fontSize: 12, fontWeight: 700, color: "var(--text-faint)" }}>
                ···
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Otra federación</span>
                <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                  Irán entrando. Mientras, usa liga privada
                </span>
              </span>
            </button>
            {otherNote && (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
                Hoy solo está activa la Federación Cántabra. Elige «Liga privada» y podrás
                cambiarlo cuando llegue la tuya.
              </p>
            )}
            {err && <Note tone="error">{err}</Note>}
          </div>
        )}
      </Modal>
    </>
  );
}
