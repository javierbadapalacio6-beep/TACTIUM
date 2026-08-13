"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  closeMatchday,
  fetchMatchdayBundle,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import { IconAlert, IconCalendar, IconCheck, IconLock, IconUpload } from "@/components/Icon";

/**
 * Jornada — datos reales.
 *
 * El acta se compone de `match_results`, que guarda UNA FILA POR SET (no una
 * por pista): por eso los sets se agrupan aquí por `court_number`.
 */

interface CourtRow {
  court: number;
  pair: [DbPlayer | null, DbPlayer | null];
  sets: [number, number][];
  forfeit: boolean;
  forfeitUs: boolean | null;
}

const EMPTY_SETS: [number, number][] = [
  [0, 0],
  [0, 0],
  [0, 0],
];

function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const shortName = (p: DbPlayer | null) => (p ? p.name.split(" ")[0] : null);

/** Veredicto de una pista a partir de sus sets o del W.O. */
function verdict(r: CourtRow): "win" | "lose" | "none" {
  if (r.forfeit) return r.forfeitUs ? "win" : "lose";
  const u = r.sets.filter(([a, b]) => a > b).length;
  const t = r.sets.filter(([a, b]) => b > a).length;
  if (u === 0 && t === 0) return "none";
  return u > t ? "win" : "lose";
}

export function MatchdayView({ id }: { id: string }) {
  const { activeTeam, role } = useSession();
  const teamId = activeTeam?.id ?? null;
  const isCaptain = role === "capitan" || role === "club";

  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId],
    !!teamId
  );

  const [rows, setRows] = useState<CourtRow[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [woFor, setWoFor] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Al llegar los datos se arma la tabla del acta: una fila por pista, con sus
  // sets agrupados y la pareja de la alineación activa.
  useEffect(() => {
    if (!data) return;
    const byId = new Map(data.players.map((p) => [p.id, p]));

    const courts = new Map<number, CourtRow>();
    for (const l of data.lineup) {
      courts.set(l.court, {
        court: l.court,
        pair: [byId.get(l.playerA ?? "") ?? null, byId.get(l.playerB ?? "") ?? null],
        sets: EMPTY_SETS.map((s) => [...s] as [number, number]),
        forfeit: false,
        forfeitUs: null,
      });
    }

    for (const r of data.results) {
      const row =
        courts.get(r.court) ??
        ({
          court: r.court,
          pair: [null, null],
          sets: EMPTY_SETS.map((s) => [...s] as [number, number]),
          forfeit: false,
          forfeitUs: null,
        } as CourtRow);
      const idx = Math.max(0, r.set - 1);
      if (idx < 3) row.sets[idx] = [r.us, r.them];
      row.forfeit = row.forfeit || r.forfeit;
      if (r.forfeit) row.forfeitUs = r.forfeitUs;
      courts.set(r.court, row);
    }

    setRows([...courts.values()].sort((a, b) => a.court - b.court));
  }, [data]);

  const totals = useMemo(() => {
    let us = 0;
    let them = 0;
    let gf = 0;
    let ga = 0;
    for (const r of rows) {
      r.sets.forEach(([a, b]) => {
        gf += a;
        ga += b;
      });
      const v = verdict(r);
      if (v === "win") us++;
      else if (v === "lose") them++;
    }
    return { us, them, gf, ga };
  }, [rows]);

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
          icon={<IconCalendar size={34} />}
          title="No se pudo cargar la jornada"
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
          title="Sin jornada activa"
          body="Abre una jornada del calendario para empezar."
          action={
            <Link href="/temporadas" className="btn btn-accent" style={{ padding: "13px 22px" }}>
              Ver temporada
            </Link>
          }
        />
      </Card>
    );
  }

  const m = data.matchday;
  const closed = m.status === "finished";
  const filled = rows.filter((r) => verdict(r) !== "none").length;
  const allIn = rows.length > 0 && filled === rows.length;

  const outcome =
    totals.us > totals.them ? "win" : totals.us < totals.them ? "lose" : "draw";
  const tone =
    outcome === "win"
      ? { c: "var(--accent)", bg: "var(--accent-10)", b: "var(--accent-40)", l: "Ganada" }
      : outcome === "lose"
        ? { c: "var(--error)", bg: "var(--error-soft)", b: "var(--error)", l: "Perdida" }
        : { c: "var(--warning)", bg: "var(--warning-soft)", b: "var(--warning)", l: "Empate" };

  function setScore(court: number, si: number, side: 0 | 1, v: string) {
    const n = Math.max(0, Math.min(9, Number(v.replace(/\D/g, "")) || 0));
    setRows((rs) =>
      rs.map((r) =>
        r.court === court
          ? {
              ...r,
              forfeit: false,
              forfeitUs: null,
              sets: r.sets.map((s, i) =>
                i === si
                  ? ((side === 0 ? [n, s[1]] : [s[0], n]) as [number, number])
                  : s
              ),
            }
          : r
      )
    );
  }

  function applyWalkover(court: number, side: "us" | "them" | null) {
    setRows((rs) =>
      rs.map((r) =>
        r.court === court
          ? {
              ...r,
              forfeit: side !== null,
              forfeitUs: side === "us" ? true : side === "them" ? false : null,
              sets: side
                ? ([
                    side === "us" ? [6, 0] : [0, 6],
                    side === "us" ? [6, 0] : [0, 6],
                    [0, 0],
                  ] as [number, number][])
                : r.sets,
            }
          : r
      )
    );
    setWoFor(null);
  }

  async function closeActa() {
    const res = await guardedWrite("cerrar el acta", () => closeMatchday(id));
    setConfirmClose(false);
    setToast(res.ok ? "Acta cerrada" : res.reason);
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div className="amb" style={{ padding: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <Eyebrow>JORNADA · J·{m.round}</Eyebrow>
              <h1 style={{ margin: "12px 0 0", fontSize: 32, lineHeight: 1.04 }}>
                {activeTeam?.name} vs {m.opponent}
              </h1>
              <div
                className="mono"
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                }}
              >
                {formatDate(m.date)}
                {m.time ? ` · ${m.time.slice(0, 5)}` : ""}
                {m.location ? ` · ${m.location}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className={"chip " + (m.isHome ? "" : "chip-mute")}>
                {m.isHome ? "Local" : "Visitante"}
              </span>
              {closed && (
                <span className="chip" style={{ color: tone.c, borderColor: tone.b }}>
                  {tone.l}
                </span>
              )}
            </div>
          </div>

          {closed && (
            <div
              style={{
                marginTop: 22,
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px 24px",
                borderRadius: 16,
                background: tone.bg,
                border: `1px solid ${tone.b}`,
                color: tone.c,
                flexWrap: "wrap",
              }}
            >
              <IconLock size={18} />
              <span
                className="mono"
                style={{ flex: 1, minWidth: 180, fontSize: 11, letterSpacing: "0.18em" }}
              >
                ACTA CERRADA · {tone.l.toUpperCase()}
              </span>
              <span className="mono" style={{ fontSize: 30, fontWeight: 700 }}>
                {m.scoreFor ?? totals.us}–{m.scoreAgainst ?? totals.them}
              </span>
            </div>
          )}
        </div>
      </Card>

      <div className="tw-jornada-grid">
        {/* ── Detalles ───────────────────────────────────────────── */}
        <Card>
          <Eyebrow>DETALLES DE LA JORNADA</Eyebrow>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "RIVAL", value: m.opponent },
              { label: "FECHA", value: m.date ?? "—" },
              { label: "HORA", value: m.time?.slice(0, 5) ?? "—" },
              { label: "LUGAR", value: m.location ?? "—" },
              { label: "DÓNDE SE JUEGA", value: m.isHome ? "En nuestras pistas" : "Fuera de casa" },
            ].map((f) => (
              <div key={f.label}>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: "var(--text-faint)",
                    marginBottom: 7,
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--hair-strong)",
                    background: "var(--bg-card-2)",
                    fontSize: 14,
                  }}
                >
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: "var(--hair)", margin: "22px 0" }} />

          <Eyebrow style={{ marginBottom: 14 }}>FOTO DEL PARTIDO</Eyebrow>
          {m.photoUrl ? (
            <div
              style={{
                height: 150,
                borderRadius: 12,
                border: "1px solid var(--hair)",
                backgroundImage: `url(${m.photoUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 16,
                borderRadius: 12,
                border: "1px dashed var(--hair-strong)",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              <IconUpload size={19} />
              Sin foto
            </div>
          )}
        </Card>

        {/* ── Marcador ───────────────────────────────────────────── */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "22px 24px",
              borderBottom: "1px solid var(--hair)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Eyebrow>{closed ? "MARCADOR · SOLO LECTURA" : "MARCADOR"}</Eyebrow>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.16em",
                color: allIn ? "var(--accent)" : "var(--warning)",
              }}
            >
              {rows.length === 0
                ? "SIN ALINEACIÓN"
                : allIn
                  ? "COMPLETO"
                  : `${filled}/${rows.length} PISTAS`}
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={<IconAlert size={30} />}
              title="Sin alineación"
              body="Aún no has decidido quién juega en cada pista."
              action={
                <Link
                  href={`/jornada/${m.id}/alineacion`}
                  className="btn btn-accent"
                  style={{ padding: "12px 20px" }}
                >
                  Crear alineación
                </Link>
              }
            />
          ) : (
            <>
              <div className="tw-score-wrap">
              <div className="tw-score-head">
                <span>Pista</span>
                <span>Nosotros</span>
                <span>Set 1</span>
                <span>Set 2</span>
                <span>Set 3</span>
                <span>Veredicto</span>
              </div>

              {rows.map((r) => {
                const v = verdict(r);
                const [a, b] = r.pair;
                return (
                  <div key={r.court} className="tw-score-row">
                    <span
                      className="mono"
                      style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)" }}
                    >
                      P{r.court}
                    </span>

                    <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a && b ? `${shortName(a)} · ${shortName(b)}` : "Sin pareja"}
                    </span>

                    {[0, 1, 2].map((si) => (
                      <span key={si} style={{ display: "flex", gap: 4 }}>
                        {([0, 1] as const).map((side) => (
                          <input
                            key={side}
                            type="text"
                            inputMode="numeric"
                            readOnly={closed}
                            aria-label={`Pista ${r.court} set ${si + 1} ${side === 0 ? "nuestro" : "rival"}`}
                            value={r.sets[si][side] || ""}
                            placeholder="–"
                            onChange={(e) => setScore(r.court, si, side, e.target.value)}
                            className="mono tw-set-input"
                          />
                        ))}
                      </span>
                    ))}

                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      {r.forfeit ? (
                        <span className="chip chip-warning">
                          W.O. {r.forfeitUs ? "a favor" : "en contra"}
                        </span>
                      ) : v === "none" ? (
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            letterSpacing: "0.16em",
                            color: "var(--text-faint)",
                          }}
                        >
                          SIN RESULTADO
                        </span>
                      ) : (
                        <span
                          className="chip"
                          style={{
                            color: v === "win" ? "var(--accent)" : "var(--error)",
                            borderColor: v === "win" ? "var(--accent-40)" : "var(--error)",
                          }}
                        >
                          {v === "win" ? "Victoria" : "Derrota"}
                        </span>
                      )}
                      {!closed && isCaptain && (
                        <button
                          type="button"
                          onClick={() => setWoFor(r.court)}
                          aria-label={`Marcar W.O. en la pista ${r.court}`}
                          className="mono"
                          style={{
                            border: "1px solid var(--hair-strong)",
                            background: "transparent",
                            color: "var(--text-faint)",
                            borderRadius: 8,
                            padding: "5px 8px",
                            fontSize: 9,
                            letterSpacing: "0.12em",
                            cursor: "pointer",
                          }}
                        >
                          W.O.
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}

              </div>

              <div className="tw-score-totals">
                <div>
                  <div className="mono tw-stat-label">JUEGOS A FAVOR</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                    {totals.gf}
                  </div>
                </div>
                <div>
                  <div className="mono tw-stat-label">JUEGOS DEL RIVAL</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                    {totals.ga}
                  </div>
                </div>
                <div>
                  <div className="mono tw-stat-label">PISTAS</div>
                  <div
                    className="mono"
                    style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: tone.c }}
                  >
                    {totals.us}–{totals.them}
                  </div>
                </div>
              </div>

              <div style={{ padding: "18px 24px", borderTop: "1px solid var(--hair)" }}>
                {closed ? (
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      letterSpacing: "0.16em",
                      color: "var(--text-faint)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <IconLock size={14} />
                    NO SE PUEDEN MODIFICAR RESULTADOS.
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
                  >
                    {isCaptain && (
                      <button
                        type="button"
                        className="btn btn-accent"
                        onClick={() => setConfirmClose(true)}
                        style={{ padding: "13px 22px", fontSize: 13.5 }}
                      >
                        Cerrar acta · manual
                      </button>
                    )}
                    {!allIn && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          letterSpacing: "0.14em",
                          color: "var(--warning)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <IconAlert size={14} />
                        SIN TODOS LOS RESULTADOS
                      </span>
                    )}
                    {!WRITES_ENABLED && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9.5,
                          letterSpacing: "0.14em",
                          color: "var(--text-faint)",
                        }}
                      >
                        SOLO LECTURA
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>

        {/* ── Alineación ─────────────────────────────────────────── */}
        <Card>
          <Eyebrow>ALINEACIÓN</Eyebrow>
          {rows.length === 0 ? (
            <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Sin alineación todavía.
            </p>
          ) : (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => {
                const [a, b] = r.pair;
                if (!a || !b) return null;
                return (
                  <div
                    key={r.court}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 13px",
                      borderRadius: 10,
                      background: "var(--bg-card-2)",
                    }}
                  >
                    <span
                      className="mono"
                      style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-faint)" }}
                    >
                      P{r.court}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
                      {shortName(a)} · {shortName(b)}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                      {a.pts + b.pts}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Link
              href={`/jornada/${m.id}/alineacion`}
              className="btn btn-ghost"
              style={{ padding: "12px 18px", fontSize: 13.5 }}
            >
              {closed ? "Ver alineación" : "Editar alineación"}
            </Link>
            <Link
              href={`/jornada/${m.id}/resultados`}
              className="btn btn-ghost"
              style={{ padding: "12px 18px", fontSize: 13.5 }}
            >
              Meter el resultado de tu partido
            </Link>
          </div>
        </Card>
      </div>

      {/* ── W.O. ─────────────────────────────────────────────────── */}
      <Modal
        open={woFor !== null}
        onClose={() => setWoFor(null)}
        labelledBy="wo-titulo"
        width={420}
      >
        <h2 id="wo-titulo" style={{ fontSize: 22 }}>
          W.O. en la pista {woFor}
        </h2>
        <p
          style={{
            margin: "10px 0 22px",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          El equipo que sí se presenta suma el punto. Elige quién no se ha
          presentado.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => woFor && applyWalkover(woFor, "us")}
            style={{ padding: "13px 18px", fontSize: 13.5, justifyContent: "flex-start" }}
          >
            W.O. a favor · no se presenta el rival
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => woFor && applyWalkover(woFor, "them")}
            style={{ padding: "13px 18px", fontSize: 13.5, justifyContent: "flex-start" }}
          >
            W.O. en contra · no nos presentamos
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => woFor && applyWalkover(woFor, null)}
            style={{ padding: "13px 18px", fontSize: 13.5, justifyContent: "flex-start" }}
          >
            Quitar el W.O.
          </button>
        </div>
      </Modal>

      {/* ── Cerrar acta ──────────────────────────────────────────── */}
      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        labelledBy="cerrar-titulo"
      >
        <h2 id="cerrar-titulo" style={{ fontSize: 22 }}>
          ¿Cerrar el acta?
        </h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          {allIn
            ? `Quedará ${totals.us}–${totals.them}. Después no se pueden modificar los resultados.`
            : "Faltan resultados en alguna pista. Si cierras ahora, esas pistas quedan sin puntuar."}
        </p>
        {!WRITES_ENABLED && (
          <p
            style={{
              margin: "16px 0 0",
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--warning-soft)",
              border: "1px solid var(--warning)",
              color: "var(--warning)",
              fontSize: 12.5,
            }}
          >
            {READ_ONLY_MESSAGE}
          </p>
        )}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setConfirmClose(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => void closeActa()}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            <IconCheck size={15} />
            Cerrar acta
          </button>
        </div>
      </Modal>

      {toast && (
        <Toast
          tone={toast.startsWith("Acta cerrada") ? "success" : "warning"}
          title={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
