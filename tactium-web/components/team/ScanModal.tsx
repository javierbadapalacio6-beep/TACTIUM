"use client";

import { useEffect, useRef, useState } from "react";

import {
  SCAN_ACCEPT,
  scanCalendar,
  scanRanking,
  type ScannedMatchday,
  type ScannedPlayer,
} from "@/lib/parse-image";
import { proHref } from "@/lib/nav";
import { Btn, BtnLink, IconTile, Modal, Note } from "@/components/ui";
import { IconAlert, IconPlus, IconUpload, IconX } from "@/components/Icon";

/**
 * Escanear el ranking o el calendario con la IA (`parse-image`), a la par que
 * `ScanSheet` de la app: subir, revisar la lista detectada (se puede corregir,
 * borrar filas o añadir alguna) y confirmar.
 *
 * Aquí no se escribe nada: `onConfirm` recibe la lista limpia y devuelve el
 * motivo si falla (null si fue bien). Quien abre el modal decide qué hacer.
 */

type Mode = "ranking" | "calendar";
type Step = "idle" | "loading" | "preview" | "saving";

type RankRow = ScannedPlayer & { _id: number };
type CalRow = ScannedMatchday & { _id: number };

const POSITIONS = ["Drive", "Revés", "Ambos"] as const;
const PTS_MAX = 99999;

let seq = 0;
const nextId = () => ++seq;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Sin plan: en vez de subir, se explica y se manda a los planes. */
  locked?: boolean;
  /** Mientras se comprueba el plan no se deja subir nada. */
  checking?: boolean;
  /** Motivo para el paywall (`/pro?motivo=`). */
  lockedIntent?: string;
  lockedText?: string;
} & (
  | {
      mode: "ranking";
      onConfirm: (items: ScannedPlayer[]) => Promise<string | null>;
    }
  | {
      mode: "calendar";
      teamName?: string;
      onConfirm: (items: ScannedMatchday[]) => Promise<string | null>;
    }
);

export function ScanModal(props: Props) {
  const { open, onClose, mode, checking } = props;
  const locked = !checking && props.locked;
  const [step, setStep] = useState<Step>("idle");
  const [rank, setRank] = useState<RankRow[]>([]);
  const [cal, setCal] = useState<CalRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cada vez que se abre, desde cero.
  useEffect(() => {
    if (!open) return;
    setStep("idle");
    setRank([]);
    setCal([]);
    setErr(null);
  }, [open]);

  async function handleFile(file: File | null | undefined) {
    if (!file || step === "loading" || locked || checking) return;
    setErr(null);
    setStep("loading");
    try {
      if (mode === "ranking") {
        const items = await scanRanking(file);
        if (!items.length) throw new Error("No hemos encontrado jugadores. Prueba con una foto más nítida o con el PDF.");
        setRank(items.map((p) => ({ ...p, _id: nextId() })));
      } else {
        const teamName = props.mode === "calendar" ? props.teamName : undefined;
        const items = await scanCalendar(file, teamName);
        if (!items.length) throw new Error("No hemos encontrado jornadas de tu equipo. Prueba con una foto más nítida o con el PDF.");
        setCal(items.map((m) => ({ ...m, _id: nextId() })));
      }
      setStep("preview");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo leer el archivo.");
      setStep("idle");
    }
  }

  // Pegar una captura con Ctrl+V mientras el modal está abierto.
  useEffect(() => {
    if (!open || locked || step !== "idle") return;
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? [])[0];
      if (f) {
        e.preventDefault();
        void handleFile(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, locked, step]);

  const count = mode === "ranking" ? rank.length : cal.length;

  async function confirm() {
    if (step === "saving") return;
    let reason: string | null = null;
    setErr(null);
    if (props.mode === "ranking") {
      const players = rank
        .map(({ _id, ...p }) => ({
          ...p,
          name: p.name.trim().replace(/\s+/g, " "),
          pts: p.pts != null ? Math.min(Math.max(Math.round(p.pts), 0), PTS_MAX) : undefined,
        }))
        .filter((p) => p.name.length >= 2);
      if (!players.length) return setErr("No queda ningún jugador con nombre.");
      setStep("saving");
      reason = await props.onConfirm(players);
    } else {
      const days = cal
        .map(({ _id, ...m }) => ({ ...m, opponent: m.opponent.trim().replace(/\s+/g, " ") }))
        .filter((m) => m.opponent.length >= 2);
      if (!days.length) return setErr("No queda ninguna jornada con rival.");
      const bad = days.findIndex(
        (m) =>
          (m.match_date && !/^\d{4}-\d{2}-\d{2}$/.test(m.match_date)) ||
          (m.match_time && !/^\d{1,2}:\d{2}$/.test(m.match_time)),
      );
      if (bad >= 0) return setErr(`Revisa la fecha o la hora de la fila ${bad + 1}.`);
      setStep("saving");
      reason = await props.onConfirm(days);
    }
    if (reason) {
      setErr(reason);
      setStep("preview");
    } else onClose();
  }

  const title = mode === "ranking" ? "Escanear el ranking" : "Escanear el calendario";
  const inPreview = step === "preview" || step === "saving";

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={`escanear-${mode}`}
      width={inPreview ? 640 : 520}
      title={title}
      lede={
        locked
          ? undefined
          : inPreview
            ? "Revisa y corrige antes de guardar. Borra las filas que no quieras."
            : mode === "ranking"
              ? "Sube una foto o el PDF de la lista de puntos. La leemos y te enseñamos los jugadores antes de guardar nada."
              : "Sube una foto o el PDF del calendario de tu grupo. Sacamos solo los partidos de tu equipo."
      }
      footer={
        locked ? (
          <>
            <Btn onClick={onClose}>Cerrar</Btn>
            <BtnLink href={proHref(props.lockedIntent ?? "roster_import")} variant="accent">
              Ver planes
            </BtnLink>
          </>
        ) : inPreview ? (
          <>
            <Btn onClick={() => setStep("idle")} disabled={step === "saving"}>
              Subir otro
            </Btn>
            <Btn variant="accent" onClick={() => void confirm()} disabled={step === "saving" || count === 0}>
              {step === "saving"
                ? "Guardando…"
                : mode === "ranking"
                  ? `Importar ${count} ${count === 1 ? "jugador" : "jugadores"}`
                  : `Crear ${count} ${count === 1 ? "jornada" : "jornadas"}`}
            </Btn>
          </>
        ) : (
          <Btn onClick={onClose}>Cancelar</Btn>
        )
      }
    >
      {checking ? (
        <p role="status" style={{ fontSize: 13, color: "var(--text-faint)" }}>
          Comprobando tu plan…
        </p>
      ) : locked ? (
        <Note tone="accent">
          {props.lockedText ??
            "Escanear y volcar la plantilla entera con sus puntos es una función premium. Sin plan puedes añadir los jugadores a mano."}
        </Note>
      ) : (
        <>
          {err && (
            <Note tone="error" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
              {err}
            </Note>
          )}

          {(step === "idle" || step === "loading") && (
            <label
              className="card card-quiet"
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "32px 20px",
                cursor: step === "loading" ? "progress" : "pointer",
                textAlign: "center",
                borderColor: drag ? "var(--accent)" : undefined,
                background: drag ? "var(--accent-10)" : undefined,
              }}
            >
              <IconTile>
                <IconUpload size={16} />
              </IconTile>
              {step === "loading" ? (
                <span role="status" style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                  Leyendo el archivo… suele tardar unos segundos.
                </span>
              ) : (
                <>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Elige una imagen o un PDF</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", textWrap: "pretty" }}>
                    También puedes arrastrarlo aquí o pegar una captura con Ctrl+V.
                  </span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={SCAN_ACCEPT}
                hidden
                disabled={step === "loading"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void handleFile(f);
                }}
              />
            </label>
          )}

          {inPreview && mode === "ranking" && (
            <div className="card card-flush" style={{ maxHeight: 380, overflowY: "auto" }}>
              <div className="tw-player-head">
                <span>Nombre</span>
                <span>Puntos</span>
                <span>Posición</span>
                <span />
              </div>
              {rank.map((p) => (
                <div key={p._id} className="tw-player-row">
                  <input
                    className="tw-cell-input"
                    value={p.name}
                    aria-label="Nombre del jugador"
                    onChange={(e) =>
                      setRank((rs) => rs.map((r) => (r._id === p._id ? { ...r, name: e.target.value } : r)))
                    }
                  />
                  <input
                    className="tw-cell-input mono"
                    inputMode="numeric"
                    value={p.pts ?? ""}
                    aria-label="Puntos"
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setRank((rs) =>
                        rs.map((r) => (r._id === p._id ? { ...r, pts: v ? Number(v) : undefined } : r)),
                      );
                    }}
                  />
                  <select
                    className="tw-cell-input"
                    value={p.position ?? "Ambos"}
                    aria-label="Posición"
                    onChange={(e) =>
                      setRank((rs) =>
                        rs.map((r) =>
                          r._id === p._id ? { ...r, position: e.target.value as ScannedPlayer["position"] } : r,
                        ),
                      )
                    }
                  >
                    {POSITIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <RemoveBtn
                    label={`Quitar ${p.name || "fila"}`}
                    onClick={() => setRank((rs) => rs.filter((r) => r._id !== p._id))}
                  />
                </div>
              ))}
              <div className="card-foot">
                <Btn
                  size="sm"
                  variant="quiet"
                  icon={<IconPlus size={14} />}
                  onClick={() => setRank((rs) => [...rs, { _id: nextId(), name: "", pts: undefined }])}
                >
                  Añadir fila
                </Btn>
              </div>
            </div>
          )}

          {inPreview && mode === "calendar" && (
            <div className="card card-flush" style={{ maxHeight: 400, overflowY: "auto" }}>
              {cal.map((m, i) => (
                <div
                  key={m._id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 34px",
                    gap: 8,
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)", width: 26 }}>
                        J{m.jornada_number ?? i + 1}
                      </span>
                      <input
                        className="tw-cell-input"
                        value={m.opponent}
                        placeholder="Rival"
                        aria-label="Rival"
                        onChange={(e) =>
                          setCal((cs) => cs.map((c) => (c._id === m._id ? { ...c, opponent: e.target.value } : c)))
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.9fr) minmax(0, 1fr)",
                        gap: 6,
                        paddingLeft: 34,
                      }}
                    >
                      <input
                        className="tw-cell-input mono"
                        type="date"
                        value={m.match_date ?? ""}
                        aria-label="Fecha"
                        onChange={(e) =>
                          setCal((cs) =>
                            cs.map((c) => (c._id === m._id ? { ...c, match_date: e.target.value || undefined } : c)),
                          )
                        }
                      />
                      <input
                        className="tw-cell-input mono"
                        type="time"
                        value={m.match_time ?? ""}
                        aria-label="Hora"
                        onChange={(e) =>
                          setCal((cs) =>
                            cs.map((c) => (c._id === m._id ? { ...c, match_time: e.target.value || undefined } : c)),
                          )
                        }
                      />
                      <select
                        className="tw-cell-input"
                        value={m.is_home ? "casa" : "fuera"}
                        aria-label="Casa o fuera"
                        onChange={(e) =>
                          setCal((cs) =>
                            cs.map((c) => (c._id === m._id ? { ...c, is_home: e.target.value === "casa" } : c)),
                          )
                        }
                      >
                        <option value="casa">En casa</option>
                        <option value="fuera">Fuera</option>
                      </select>
                    </div>
                  </div>
                  <RemoveBtn
                    label={`Quitar la jornada contra ${m.opponent || "rival"}`}
                    onClick={() => setCal((cs) => cs.filter((c) => c._id !== m._id))}
                  />
                </div>
              ))}
              <div className="card-foot">
                <Btn
                  size="sm"
                  variant="quiet"
                  icon={<IconPlus size={14} />}
                  onClick={() => setCal((cs) => [...cs, { _id: nextId(), opponent: "", is_home: true }])}
                >
                  Añadir fila
                </Btn>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function RemoveBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="btn btn-icon"
      style={{ width: 30, minHeight: 30 }}
    >
      <IconX size={13} />
    </button>
  );
}
