"use client";

import { useEffect, useMemo, useState } from "react";

import { courtTotals, gameTotals, type CourtResult } from "@/lib/team-data";
import {
  fetchMatchdayBundle,
  saveCourtSets,
  type DbPlayer,
  type MatchdayBundle,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite, WRITES_ENABLED } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  Chip,
  Note,
  PageHeader,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCalendar, IconLock } from "@/components/Icon";

/**
 * Resultados — datos reales.
 *
 * Es la pantalla que usan los JUGADORES para meter el resultado de su propio
 * partido, no solo el capitán. Por eso la pista del usuario se resalta arriba
 * con el rótulo "Tu partido" y el resto queda por debajo.
 *
 * De sólo lectura por ahora: el acta se pinta desde `match_results` (una fila
 * por set) y los controles de entrada quedan como estaban, pendientes de la
 * fase de guardado.
 */

const EMPTY_SETS: [number, number][] = [
  [0, 0],
  [0, 0],
  [0, 0],
];

/** Pista lista para pintar: pareja de la alineación activa + W.O. real. */
interface Court {
  court: number;
  pair: [DbPlayer | null, DbPlayer | null];
  mine: boolean;
  forfeit: boolean;
  forfeitUs: boolean | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function ResultsView({ id }: { id: string }) {
  const { activeTeam, user } = useSession();
  const teamId = activeTeam?.id ?? null;

  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId],
    !!teamId
  );

  // Sets por pista, editables en local (aún sin guardar). Se rellenan al llegar
  // los resultados reales: `match_results` trae una fila por set, aquí se
  // agrupan por pista.
  const [sets, setSets] = useState<Record<number, [number, number][]>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [savingCourt, setSavingCourt] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const byCourt: Record<number, [number, number][]> = {};
    for (const l of data.lineup) {
      byCourt[l.court] = EMPTY_SETS.map((s) => [...s] as [number, number]);
    }
    for (const r of data.results) {
      if (!byCourt[r.court]) {
        byCourt[r.court] = EMPTY_SETS.map((s) => [...s] as [number, number]);
      }
      const idx = Math.max(0, r.set - 1);
      if (idx < 3) byCourt[r.court][idx] = [r.us, r.them];
    }
    setSets(byCourt);
  }, [data]);

  // Pistas: pareja de la alineación activa, si es mía (mi jugador vinculado) y
  // el W.O. si lo hubiera.
  const courts = useMemo<Court[]>(() => {
    if (!data) return [];
    const byId = new Map(data.players.map((p) => [p.id, p]));

    const map = new Map<number, Court>();
    for (const l of data.lineup) {
      const a = l.playerA ? byId.get(l.playerA) ?? null : null;
      const b = l.playerB ? byId.get(l.playerB) ?? null : null;
      map.set(l.court, {
        court: l.court,
        pair: [a, b],
        mine: [a, b].some((p) => p != null && p.userId === user?.id),
        forfeit: false,
        forfeitUs: null,
      });
    }
    for (const r of data.results) {
      const c =
        map.get(r.court) ??
        ({
          court: r.court,
          pair: [null, null],
          mine: false,
          forfeit: false,
          forfeitUs: null,
        } as Court);
      if (r.forfeit) {
        c.forfeit = true;
        c.forfeitUs = r.forfeitUs;
      }
      map.set(r.court, c);
    }
    return [...map.values()].sort((a, b) => a.court - b.court);
  }, [data, user?.id]);

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
            title="No se pudieron cargar los resultados"
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
          />
        </Card>
      </div>
    );
  }

  const m = data.matchday;
  const readOnly = m.status === "finished";

  const asResults: CourtResult[] = courts.map((c) => ({
    court: c.court,
    ours: null,
    rivalPair: ["", ""],
    sets: sets[c.court] ?? EMPTY_SETS,
    walkover: c.forfeit ? (c.forfeitUs ? "us" : "them") : undefined,
  }));
  const totals = courtTotals(asResults);
  const games = gameTotals(asResults);

  function edit(court: number, si: number, side: 0 | 1, v: string) {
    const n = Math.max(0, Math.min(9, Number(v.replace(/\D/g, "")) || 0));
    setSets((s) => ({
      ...s,
      [court]: (s[court] ?? EMPTY_SETS).map((pair, i) =>
        i === si
          ? ((side === 0 ? [n, pair[1]] : [pair[0], n]) as [number, number])
          : pair
      ),
    }));
  }

  // Guardar el resultado de una pista. Pasa por `guardedWrite`: con el
  // interruptor de escritura apagado no toca la BD y avisa en el toast.
  async function saveCourt(court: number) {
    setSavingCourt(court);
    const res = await guardedWrite("guardar el resultado", () =>
      saveCourtSets(id, court, sets[court] ?? EMPTY_SETS),
    );
    setSavingCourt(null);
    setToast(res.ok ? "Resultado guardado" : res.reason);
  }

  const mine = courts.find((c) => c.mine);
  const rest = courts.filter((c) => !c.mine);

  function CourtCard({ c }: { c: Court }) {
    const [a, b] = c.pair;
    const s = sets[c.court] ?? EMPTY_SETS;
    const u = s.filter(([x, y]) => x > y).length;
    const t = s.filter(([x, y]) => y > x).length;
    const has = u + t > 0;

    return (
      <Card style={{ borderColor: c.mine ? "var(--accent-40)" : undefined }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
              Pista {c.court}
            </span>
            {c.mine && <Chip plain>Tu partido</Chip>}
          </span>
          {has && (
            <Chip tone={u > t ? "accent" : "error"}>
              {u > t ? "Victoria" : "Derrota"}
            </Chip>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {a && b ? `${a.name} · ${b.name}` : "Sin alineación"}
          </div>
          <div style={{ marginTop: 3, fontSize: 13.5, color: "var(--text-muted)" }}>
            vs {m.opponent}
          </div>
        </div>

        <div className="tw-sets-row">
          {[0, 1, 2].map((si) => (
            <div key={si}>
              <div
                className="grid-head"
                style={{ marginBottom: 6, textAlign: "center" }}
              >
                Set {si + 1}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                {([0, 1] as const).map((side) => (
                  <input
                    key={side}
                    type="text"
                    inputMode="numeric"
                    readOnly={readOnly}
                    value={s[si][side] || ""}
                    placeholder="–"
                    aria-label={`Pista ${c.court} set ${si + 1} ${side === 0 ? "nuestro" : "rival"}`}
                    onChange={(e) => edit(c.court, si, side, e.target.value)}
                    className="mono tw-set-input"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {c.mine && !readOnly && (
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Btn
              variant="accent"
              disabled={savingCourt === c.court}
              onClick={() => saveCourt(c.court)}
            >
              {savingCourt === c.court ? "Guardando…" : "Listo"}
            </Btn>
            <Btn
              variant="quiet"
              onClick={() =>
                setSets((x) => ({
                  ...x,
                  [c.court]: [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                  ],
                }))
              }
            >
              Cancelar
            </Btn>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: `/jornada/${m.id}`, label: "Jornada" }}
        title={`${activeTeam?.name} vs ${m.opponent}`}
        meta={[
          `Jornada ${m.round}`,
          formatDate(m.date),
          m.time ? <span className="mono">{m.time.slice(0, 5)}</span> : null,
          m.isHome ? "En casa" : "Fuera",
        ]}
        actions={
          <BtnLink href={`/jornada/${m.id}`} variant="quiet">
            Volver a la jornada
          </BtnLink>
        }
      />

      {readOnly && (
        <Note icon={<IconLock size={15} />} style={{ marginBottom: 16 }}>
          Acta cerrada: no se pueden modificar resultados.
        </Note>
      )}

      {!readOnly && !WRITES_ENABLED && (
        <Note tone="warning" icon={<IconLock size={15} />} style={{ marginBottom: 16 }}>
          Modo solo lectura: la web aún no escribe en la base de datos. Puedes
          teclear el resultado, pero «Listo» no lo guardará todavía.
        </Note>
      )}

      {courts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Sin alineación"
            body="Aún no hay parejas por pista para esta jornada."
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mine && <CourtCard c={mine} />}
          {rest.map((c) => (
            <CourtCard key={c.court} c={c} />
          ))}
        </div>
      )}

      <StatRow style={{ marginTop: 16 }}>
        <Stat label="Juegos a favor" value={games[0]} />
        <Stat label="Juegos del rival" value={games[1]} />
        <Stat
          label="Pistas"
          value={`${totals[0]}–${totals[1]}`}
          tone={
            totals[0] > totals[1]
              ? "accent"
              : totals[0] < totals[1]
                ? "error"
                : "warning"
          }
          sub="Ganadas · perdidas"
        />
      </StatRow>

      {toast && (
        <Toast
          title={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
