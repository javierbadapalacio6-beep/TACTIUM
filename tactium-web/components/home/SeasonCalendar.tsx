"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DbMatchday } from "@/lib/queries";
import { IconChevronRight, IconHome, IconPlane } from "@/components/Icon";

/**
 * Calendario mensual de jornadas.
 *
 * La lista decía lo mismo, pero obligaba a ir contando fechas. En rejilla se
 * ve de un vistazo cuándo toca jugar, contra quién y —lo que más se pregunta
 * un jugador— si hay que desplazarse: casa o avión.
 */

const DOW = ["L", "M", "X", "J", "V", "S", "D"];

/** Lunes como primer día de la semana (`getDay()` da 0 para domingo). */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/** Rival sin el nombre del club repetido, para que quepa en la celda. */
function shortRival(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function SeasonCalendar({
  matchdays,
  seasonId,
}: {
  matchdays: DbMatchday[];
  seasonId: string;
}) {
  // Jornadas con fecha, indexadas por día.
  const byDay = useMemo(() => {
    const m = new Map<string, DbMatchday[]>();
    for (const j of matchdays) {
      if (!j.date) continue;
      const list = m.get(j.date) ?? [];
      list.push(j);
      m.set(j.date, list);
    }
    return m;
  }, [matchdays]);

  // Se abre en el mes de la primera jornada por jugar; si no queda ninguna,
  // en el de la última jugada; y si no hay fechas, en el mes actual.
  const initial = useMemo(() => {
    const pending = matchdays.find((j) => j.status !== "finished" && j.date);
    const last = [...matchdays].reverse().find((j) => j.date);
    const ref = pending?.date ?? last?.date ?? null;
    const d = ref ? new Date(ref + "T00:00:00") : new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [matchdays]);

  const [cursor, setCursor] = useState(initial);

  // Meses que tienen jornada, para no dejar navegar por el vacío.
  const bounds = useMemo(() => {
    const dates = matchdays
      .map((j) => j.date)
      .filter((d): d is string => !!d)
      .sort();
    if (!dates.length) return null;
    const first = new Date(dates[0] + "T00:00:00");
    const last = new Date(dates[dates.length - 1] + "T00:00:00");
    return {
      min: first.getFullYear() * 12 + first.getMonth(),
      max: last.getFullYear() * 12 + last.getMonth(),
    };
  }, [matchdays]);

  const cursorAbs = cursor.y * 12 + cursor.m;
  const canPrev = !bounds || cursorAbs > bounds.min;
  const canNext = !bounds || cursorAbs < bounds.max;

  function move(delta: number) {
    setCursor((c) => {
      const abs = c.y * 12 + c.m + delta;
      return { y: Math.floor(abs / 12), m: ((abs % 12) + 12) % 12 };
    });
  }

  // Celdas: se rellena desde el lunes de la primera semana hasta completar
  // semanas enteras, para que la rejilla no quede coja.
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first);
    start.setDate(1 - mondayIndex(first));
    const out: { date: Date; inMonth: boolean }[] = [];
    const d = new Date(start);
    // 6 semanas cubren cualquier mes; se recorta la última si sobra entera.
    for (let i = 0; i < 42; i++) {
      out.push({ date: new Date(d), inMonth: d.getMonth() === cursor.m });
      d.setDate(d.getDate() + 1);
    }
    while (out.length > 35 && !out.slice(35).some((c) => c.inMonth)) {
      out.length = 35;
    }
    return out;
  }, [cursor]);

  const todayKey = ymd(new Date());
  // Sólo la inicial en mayúscula: con `capitalize` de CSS salía
  // «Septiembre De 2026», con la preposición también en alta.
  const rawMonth = new Date(cursor.y, cursor.m, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

  return (
    <>
      <div className="bcard-head">
        <span className="bcard-title">Calendario</span>
        <div className="cal-nav">
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={() => move(-1)}
            disabled={!canPrev}
            aria-label="Mes anterior"
          >
            <IconChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span className="cal-month">{monthLabel}</span>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={() => move(1)}
            disabled={!canNext}
            aria-label="Mes siguiente"
          >
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="cal-head" aria-hidden="true">
        {DOW.map((d, i) => (
          <span key={i} className="cal-dow">
            {d}
          </span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map(({ date, inMonth }) => {
          const key = ymd(date);
          const events = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={
                "cal-cell" +
                (inMonth ? "" : " is-out") +
                (key === todayKey ? " is-today" : "")
              }
            >
              <span className="cal-num">{date.getDate()}</span>

              {events.map((j) => {
                const played = j.status === "finished";
                const hasScore = j.scoreFor != null && j.scoreAgainst != null;
                return (
                  <Link
                    key={j.id}
                    href={`/jornada/${j.id}`}
                    className={
                      "cal-ev" +
                      (played ? " is-played" : j.isHome ? " is-home" : "")
                    }
                    aria-label={`Jornada ${j.round} contra ${j.opponent}, ${
                      j.isHome ? "en casa" : "fuera"
                    }${hasScore ? `, ${j.scoreFor}-${j.scoreAgainst}` : ""}`}
                    title={`J${j.round} · ${j.isHome ? "En casa" : "Fuera"} · vs ${j.opponent}`}
                  >
                    <span className="cal-ev-top">
                      {j.isHome ? <IconHome size={11} /> : <IconPlane size={11} />}
                      <span>J{j.round}</span>
                      {hasScore && (
                        <span className="cal-ev-score" style={{ marginLeft: "auto" }}>
                          {j.scoreFor}-{j.scoreAgainst}
                        </span>
                      )}
                    </span>
                    <span className="cal-ev-rival">{shortRival(j.opponent)}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        className="bcard-foot"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          <i
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "var(--accent)",
              display: "inline-block",
            }}
          />
          <IconHome size={13} />
          En casa
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          <i
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "var(--bg-card-3)",
              display: "inline-block",
            }}
          />
          <IconPlane size={13} />
          Fuera
        </span>
        <span style={{ flex: 1 }} />
        <Link href={`/temporadas/${seasonId}`} className="link-action">
          Ver temporada <IconChevronRight size={14} />
        </Link>
      </div>
    </>
  );
}
