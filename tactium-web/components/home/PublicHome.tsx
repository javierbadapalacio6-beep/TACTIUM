"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { exploreTournaments } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconFlag, IconSearch, IconTrophy } from "@/components/Icon";

/**
 * Portada pública — lo primero que ve quien llega sin cuenta.
 *
 * Enseña producto antes de pedir nada: torneos reales en marcha y la puerta a
 * la competición federada. La cuenta se pide cuando el visitante quiera HACER
 * algo (inscribirse, seguir), no para mirar.
 *
 * Todo lo que se lee aquí sale de fuentes ya públicas: `explore_tournaments`
 * (RPC `SECURITY DEFINER` concedida a `anon`) y las tablas `fcp_*`.
 */

/** Cuántos torneos caben en la portada antes de mandar al listado completo. */
const PREVIEW = 6;

const STATUS_TONE: Record<string, string> = {
  open: "var(--accent)",
  in_progress: "var(--warning)",
  finished: "var(--text-faint)",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Inscripción abierta",
  in_progress: "En juego",
  finished: "Finalizado",
};

export function PublicHome() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Cada tecla no puede ser una consulta: se espera a que pare de escribir.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const tournaments = useAsync(() => exploreTournaments(debounced), [debounced]);
  const rows = tournaments.data ?? [];
  const shown = rows.slice(0, PREVIEW);
  const searching = debounced.trim().length > 0;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* ── Entrada ──────────────────────────────────────────────── */}
      <header style={{ marginBottom: 28 }}>
        <Eyebrow style={{ marginBottom: 10 }}>EXPLORAR</Eyebrow>
        <h1 style={{ fontSize: 38, lineHeight: 1.04, maxWidth: "18ch" }}>
          Torneos y federación, sin crear cuenta
        </h1>
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 15,
            color: "var(--text-muted)",
            maxWidth: "62ch",
            textWrap: "pretty",
          }}
        >
          Cuadros, horarios y resultados de los torneos que organizan los
          clubes, y la competición federada al completo. Entra sólo cuando
          quieras inscribirte o gestionar tu equipo.
        </p>
      </header>

      <Card style={{ padding: 18, marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--hair-strong)",
            background: "var(--bg-card-2)",
          }}
        >
          <IconSearch size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca un torneo por nombre, club o lugar"
            aria-label="Buscar torneo"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
              fontFamily: "'Satoshi', sans-serif",
            }}
          />
        </div>
      </Card>

      {/* ── Torneos ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <Eyebrow tone="faint">
          {searching ? "RESULTADOS" : "TORNEOS AHORA MISMO"}
        </Eyebrow>
        {rows.length > PREVIEW && (
          <Link
            href="/torneos"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            Ver los {rows.length} torneos →
          </Link>
        )}
      </div>

      {tournaments.loading ? (
        <SkeletonCard />
      ) : tournaments.error ? (
        <Card>
          <EmptyState
            icon={<IconTrophy size={34} />}
            title="No se han podido cargar los torneos"
            body={tournaments.error}
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconTrophy size={34} />}
            title={searching ? "Ningún torneo con esa búsqueda" : "Todavía no hay torneos"}
            body={
              searching
                ? "Prueba con el nombre del club o de la localidad."
                : "En cuanto un club publique el suyo, aparecerá aquí."
            }
          />
        </Card>
      ) : (
        <div className="tw-tourney-cards">
          {shown.map((t) => (
            <Link key={t.id} href={`/torneos/${t.id}`} style={{ color: "inherit" }}>
              <Card style={{ padding: 20, height: "100%" }}>
                <span
                  className="chip"
                  style={{
                    color: STATUS_TONE[t.status] ?? "var(--text-faint)",
                    borderColor: STATUS_TONE[t.status] ?? "var(--hair-strong)",
                  }}
                >
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t.name}
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "var(--text-faint)",
                  }}
                >
                  {(t.club_name ?? "SIN CLUB").toUpperCase()}
                  {t.location ? ` · ${t.location.toUpperCase()}` : ""}
                </div>
                {t.players != null && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid var(--hair)",
                      fontSize: 13,
                      color: "var(--text-muted)",
                    }}
                  >
                    {t.players} jugadores
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* ── Federación y alta ────────────────────────────────────── */}
      <div className="tw-pub-home-split">
        <Link href="/federacion" style={{ color: "inherit" }}>
          <Card style={{ height: "100%" }}>
            <IconFlag size={26} />
            <h2 style={{ margin: "14px 0 0", fontSize: 20 }}>
              Competición federada
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 14,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              Clasificaciones, jornadas, actas y rankings de la Federación
              Cántabra de Pádel. Abierto, sin cuenta.
            </p>
            <span
              style={{
                display: "inline-block",
                marginTop: 16,
                fontSize: 13,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              Explorar la federación →
            </span>
          </Card>
        </Link>

        <Card style={{ height: "100%" }}>
          <IconTrophy size={26} />
          <h2 style={{ margin: "14px 0 0", fontSize: 20 }}>¿Organizas torneos?</h2>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Monta el cuadro, reparte horarios y publica resultados en directo.
            Hasta 16 parejas es gratis.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Link
              href="/empezar"
              className="btn btn-accent"
              style={{ padding: "11px 20px", fontSize: 13.5 }}
            >
              Crear cuenta
            </Link>
            <Link
              href="/pro"
              className="btn"
              style={{
                padding: "11px 20px",
                fontSize: 13.5,
                border: "1px solid var(--hair-strong)",
                color: "var(--text)",
              }}
            >
              Ver planes
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
