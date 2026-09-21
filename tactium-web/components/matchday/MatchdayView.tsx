"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  closeMatchday,
  deleteMatchday,
  fetchMatchdayBundle,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  IconTile,
  Modal,
  Note,
  PageHeader,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconLock,
  IconUpload,
  IconUsers,
} from "@/components/Icon";

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function removeMatchday() {
    if (deleting) return;
    setDeleting(true);
    const res = await guardedWrite("eliminar la jornada", () => deleteMatchday(id));
    setDeleting(false);
    if (!res.ok) {
      setConfirmDelete(false);
      setToast(res.reason);
      return;
    }
    window.location.href = "/temporadas";
  }

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
            icon={<IconCalendar size={24} />}
            title="No se pudo cargar la jornada"
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
            title="Sin jornada activa"
            body="Abre una jornada del calendario para empezar."
            action={
              <BtnLink href="/temporadas" variant="accent">
                Ver temporada
              </BtnLink>
            }
          />
        </Card>
      </div>
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
      ? { chip: "accent" as const, stat: "accent" as const, l: "Ganada" }
      : outcome === "lose"
        ? { chip: "error" as const, stat: "error" as const, l: "Perdida" }
        : { chip: "warning" as const, stat: "warning" as const, l: "Empate" };

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
    <div className="tw-page">
      <PageHeader
        back={{ href: `/temporadas/${m.seasonId}`, label: "Temporada" }}
        title={
          <>
            Jornada {m.round}
            <span style={{ color: "var(--text-faint)", fontWeight: 500 }}> · </span>
            vs {m.opponent}
          </>
        }
        meta={[
          formatDate(m.date),
          m.time ? m.time.slice(0, 5) : null,
          m.isHome ? "En casa" : "Fuera",
          m.location ?? null,
        ]}
        actions={
          <>
            <Chip tone={closed ? tone.chip : m.status === "in_progress" ? "warning" : "mute"}>
              {closed ? tone.l : m.status === "in_progress" ? "En juego" : "Pendiente"}
            </Chip>
            <BtnLink
              href={`/jornada/${m.id}/alineacion`}
              variant={closed ? "ghost" : "accent"}
              icon={<IconUsers size={15} />}
            >
              {closed ? "Ver alineación" : "Editar alineación"}
            </BtnLink>
          </>
        }
      />

      <StatRow style={{ marginBottom: 16 }}>
        <Stat
          label="Pistas"
          value={`${closed ? (m.scoreFor ?? totals.us) : totals.us}–${closed ? (m.scoreAgainst ?? totals.them) : totals.them}`}
          tone={closed ? tone.stat : undefined}
          sub={closed ? `Acta cerrada · ${tone.l.toLowerCase()}` : allIn ? "Todas las pistas con resultado" : `${filled} de ${rows.length} con resultado`}
        />
        <Stat label="Juegos a favor" value={totals.gf} />
        <Stat label="Juegos del rival" value={totals.ga} />
        <Stat
          label="Alineación"
          value={rows.filter((r) => r.pair[0] && r.pair[1]).length}
          unit={`/ ${Math.max(rows.length, 5)}`}
          sub={rows.length === 0 ? "Sin parejas" : "parejas en pista"}
        />
      </StatRow>

      <div className="tw-jornada-grid">
        {/* ── Detalles ───────────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Detalles" />
          <div className="card-body">
            <dl className="kv" style={{ margin: 0 }}>
              <dt>Rival</dt>
              <dd>{m.opponent}</dd>
              <dt>Fecha</dt>
              <dd>{m.date ? formatDate(m.date) : "—"}</dd>
              <dt>Hora</dt>
              <dd className="mono">{m.time?.slice(0, 5) ?? "—"}</dd>
              <dt>Lugar</dt>
              <dd>{m.location ?? "—"}</dd>
              <dt>Dónde se juega</dt>
              <dd>{m.isHome ? "En nuestras pistas" : "Fuera de casa"}</dd>
            </dl>

            <div className="divider" />

            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
              Foto del partido
            </div>
            {m.photoUrl ? (
              <div
                style={{
                  height: 150,
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line)",
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
                  gap: 10,
                  padding: 14,
                  borderRadius: "var(--r-md)",
                  border: "1px dashed var(--line-strong)",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                <IconUpload size={17} />
                Sin foto todavía
              </div>
            )}
          </div>

          {isCaptain && (
            <div className="card-foot" style={{ flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: "var(--text-muted)" }}>
                Eliminar la jornada borra alineación, disponibilidad y resultados.
              </span>
              {!confirmDelete ? (
                <Btn size="sm" variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                  Eliminar jornada
                </Btn>
              ) : (
                <>
                  <Btn size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                    Cancelar
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => void removeMatchday()} disabled={deleting}>
                    {deleting ? "Eliminando…" : "Sí, eliminar"}
                  </Btn>
                </>
              )}
            </div>
          )}
        </Card>

        {/* ── Marcador ───────────────────────────────────────────── */}
        <Card flush>
          <CardHead title={closed ? "Acta" : "Marcador"} count={rows.length ? `${filled}/${rows.length}` : undefined}>
            {closed ? (
              <Chip tone="mute" plain>
                <IconLock size={12} /> Solo lectura
              </Chip>
            ) : rows.length > 0 ? (
              <Chip tone={allIn ? "accent" : "warning"} plain>
                {allIn ? "Completo" : "Faltan resultados"}
              </Chip>
            ) : null}
          </CardHead>

          {rows.length === 0 ? (
            <EmptyState
              compact
              icon={<IconAlert size={22} />}
              title="Sin alineación"
              body="Aún no has decidido quién juega en cada pista."
              action={
                <BtnLink href={`/jornada/${m.id}/alineacion`} variant="accent" size="sm">
                  Crear alineación
                </BtnLink>
              }
            />
          ) : (
            <>
              <div className="tw-score-wrap">
                <div className="tw-score-head">
                  <span>Pista</span>
                  <span>Pareja</span>
                  <span>Set 1</span>
                  <span>Set 2</span>
                  <span>Set 3</span>
                  <span style={{ textAlign: "right" }}>Resultado</span>
                </div>

                {rows.map((r) => {
                  const v = verdict(r);
                  const [a, b] = r.pair;
                  return (
                    <div key={r.court} className="tw-score-row">
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-faint)" }}>
                        P{r.court}
                      </span>

                      <span className="truncate" style={{ minWidth: 0, fontSize: 13.5, fontWeight: 700 }}>
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

                      <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        {r.forfeit ? (
                          <Chip tone="warning">W.O. {r.forfeitUs ? "a favor" : "en contra"}</Chip>
                        ) : v === "none" ? (
                          <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>Sin resultado</span>
                        ) : (
                          <Chip tone={v === "win" ? "accent" : "error"}>
                            {v === "win" ? "Victoria" : "Derrota"}
                          </Chip>
                        )}
                        {!closed && isCaptain && (
                          <button
                            type="button"
                            onClick={() => setWoFor(r.court)}
                            aria-label={`Marcar W.O. en la pista ${r.court}`}
                            className="btn btn-quiet btn-sm"
                            style={{ minHeight: 28, padding: "0 8px", fontSize: 12 }}
                          >
                            W.O.
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="card-foot" style={{ flexWrap: "wrap" }}>
                {closed ? (
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                    <IconLock size={14} />
                    Los resultados ya no se pueden modificar.
                  </span>
                ) : (
                  <>
                    {isCaptain && (
                      <Btn variant="accent" onClick={() => setConfirmClose(true)} icon={<IconCheck size={15} />}>
                        Cerrar acta
                      </Btn>
                    )}
                    {!allIn && (
                      <span style={{ fontSize: 12.5, color: "var(--warning)", display: "flex", alignItems: "center", gap: 6 }}>
                        <IconAlert size={14} />
                        Faltan resultados en {rows.length - filled} {rows.length - filled === 1 ? "pista" : "pistas"}
                      </span>
                    )}
                    {!WRITES_ENABLED && (
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Solo lectura</span>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </Card>

        {/* ── Alineación ─────────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Alineación">
            <Link href={`/jornada/${m.id}/alineacion`} className="link-action">
              {closed ? "Ver" : "Editar"}
            </Link>
          </CardHead>
          {rows.length === 0 ? (
            <p style={{ margin: 0, padding: 18, fontSize: 13, color: "var(--text-muted)" }}>
              Sin alineación todavía.
            </p>
          ) : (
            rows.map((r) => {
              const [a, b] = r.pair;
              if (!a || !b) return null;
              return (
                <div key={r.court} className="list-row" style={{ minHeight: 48, padding: "8px 18px" }}>
                  <span className="mono" style={{ width: 24, fontSize: 12, color: "var(--text-faint)" }}>
                    P{r.court}
                  </span>
                  <span className="list-row-main">
                    <span className="list-row-title" style={{ fontSize: 13.5 }}>
                      {shortName(a)} · {shortName(b)}
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {a.pts + b.pts}
                  </span>
                </div>
              );
            })
          )}
          <div className="card-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <BtnLink href={`/jornada/${m.id}/disponibilidad`} variant="quiet" block>
              Disponibilidad de la plantilla
            </BtnLink>
            <BtnLink href={`/jornada/${m.id}/resultados`} variant="ghost" block>
              Meter el resultado de mi partido
            </BtnLink>
          </div>
        </Card>
      </div>

      {/* ── W.O. ─────────────────────────────────────────────────── */}
      <Modal
        open={woFor !== null}
        onClose={() => setWoFor(null)}
        labelledBy="wo-titulo"
        width={440}
        title={`W.O. en la pista ${woFor}`}
        lede="El equipo que sí se presenta suma el punto. Elige quién no se ha presentado."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Btn onClick={() => woFor && applyWalkover(woFor, "us")} style={{ justifyContent: "flex-start" }}>
            W.O. a favor: no se presenta el rival
          </Btn>
          <Btn onClick={() => woFor && applyWalkover(woFor, "them")} style={{ justifyContent: "flex-start" }}>
            W.O. en contra: no nos presentamos
          </Btn>
          <Btn variant="quiet" onClick={() => woFor && applyWalkover(woFor, null)} style={{ justifyContent: "flex-start" }}>
            Quitar el W.O.
          </Btn>
        </div>
      </Modal>

      {/* ── Cerrar acta ──────────────────────────────────────────── */}
      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        labelledBy="cerrar-titulo"
        title="¿Cerrar el acta?"
        lede={
          allIn
            ? `Quedará ${totals.us}–${totals.them}. Después no se pueden modificar los resultados.`
            : "Faltan resultados en alguna pista. Si cierras ahora, esas pistas quedan sin puntuar."
        }
        footer={
          <>
            <Btn onClick={() => setConfirmClose(false)}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => void closeActa()} icon={<IconCheck size={15} />}>
              Cerrar acta
            </Btn>
          </>
        }
      >
        {!WRITES_ENABLED ? (
          <Note tone="warning">{READ_ONLY_MESSAGE}</Note>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <IconTile mute>
              <IconLock size={15} />
            </IconTile>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              El acta cerrada queda como resultado oficial de la jornada.
            </span>
          </div>
        )}
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
