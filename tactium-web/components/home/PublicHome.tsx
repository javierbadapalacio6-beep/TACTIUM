"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { exploreTournaments } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { BtnLink, Card, Chip, IconTile, SectionHead } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconFlag, IconSearch, IconTrophy } from "@/components/Icon";
import { PadelCourt3D } from "@/components/PadelCourt3D";

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

const STATUS_TONE: Record<string, "accent" | "warning" | "mute"> = {
  open: "accent",
  in_progress: "warning",
  finished: "mute",
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
    <div className="tw-page">
      {/* ── Entrada ──────────────────────────────────────────────────
          La pista 3D entra y se queda de fondo; el texto y el
          buscador se componen encima escalonados. No es una cortinilla que
          haya que esperar: el contenido llega en el mismo gesto. */}
      <section className="tw-pub-hero">
        <div className="tw-pub-hero-3d" aria-hidden="true">
          <PadelCourt3D centerX={0.72} />
        </div>

        <header className="tw-pub-hero-copy">
          {/* Único titular en tamaño de portada de toda la web. */}
          <h1 style={{ fontSize: "clamp(28px, 4vw, 38px)", maxWidth: "18ch" }}>
            Torneos y federación, sin crear cuenta
          </h1>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 14,
              color: "var(--text-muted)",
              maxWidth: "56ch",
            }}
          >
            Cuadros, horarios y resultados de los torneos que organizan los
            clubes, y la competición federada al completo. Entra sólo cuando
            quieras inscribirte o gestionar tu equipo.
          </p>

          <div className="tw-pub-hero-search">
            <IconSearch size={16} />
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
              }}
            />
          </div>
        </header>
      </section>

      {/* ── Torneos ──────────────────────────────────────────────── */}
      <SectionHead
        title={searching ? "Resultados" : "Torneos ahora mismo"}
        count={rows.length > 0 ? rows.length : undefined}
      >
        {rows.length > PREVIEW && (
          <Link href="/torneos" className="link-action">
            Ver los {rows.length} torneos
          </Link>
        )}
      </SectionHead>

      {tournaments.loading ? (
        <SkeletonCard />
      ) : tournaments.error ? (
        <Card>
          <EmptyState
            icon={<IconTrophy size={24} />}
            title="No se han podido cargar los torneos"
            body={tournaments.error}
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconTrophy size={24} />}
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
              <Card hover style={{ height: "100%" }}>
                <Chip tone={STATUS_TONE[t.status] ?? "mute"}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </Chip>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  {t.club_name ?? "Sin club"}
                  {t.location ? ` · ${t.location}` : ""}
                </div>
                {t.players != null && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid var(--line)",
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span className="mono">{t.players}</span> jugadores
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
          <Card hover style={{ height: "100%" }}>
            <IconTile>
              <IconFlag size={16} />
            </IconTile>
            <h2 style={{ margin: "14px 0 0", fontSize: 18 }}>
              Competición federada
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Clasificaciones, jornadas, actas y rankings de la Federación
              Cántabra de Pádel. Abierto, sin cuenta.
            </p>
            <span className="link-action" style={{ marginTop: 16 }}>
              Explorar la federación
            </span>
          </Card>
        </Link>

        <Card style={{ height: "100%" }}>
          <IconTile mute>
            <IconTrophy size={16} />
          </IconTile>
          <h2 style={{ margin: "14px 0 0", fontSize: 18 }}>¿Organizas torneos?</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
            Monta el cuadro, reparte horarios y publica resultados en directo.
            Hasta 16 parejas es gratis.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <BtnLink href="/empezar" variant="accent">
              Crear cuenta
            </BtnLink>
            <BtnLink href="/pro">Ver planes</BtnLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
