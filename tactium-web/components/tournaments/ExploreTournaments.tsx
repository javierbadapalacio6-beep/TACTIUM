"use client";

import Link from "next/link";
import { useState } from "react";

import { exploreTournaments, type DbTournament } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  Input,
  InputWrap,
  ListRow,
  PageHeader,
  Segmented,
} from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconSearch, IconTicket, IconTrophy } from "@/components/Icon";

/**
 * Explorar torneos — datos REALES.
 *
 * Se leen con la RPC `explore_tournaments`, que es `SECURITY DEFINER` y está
 * concedida a `anon`: por eso esta pantalla funciona sin sesión, igual que en
 * la app. La tabla `tournaments` en sí no tiene política de SELECT, así que
 * leerla directamente no devolvería nada aunque hubiera sesión.
 */

type ChipTone = "accent" | "mute" | "warning" | "error" | "info" | "solid";

/** Estados que guarda la base de datos, con su etiqueta y su tono. */
const STATUS: Record<string, { label: string; tone: ChipTone }> = {
  open: { label: "Inscripción abierta", tone: "accent" },
  in_progress: { label: "En juego", tone: "warning" },
  finished: { label: "Finalizado", tone: "mute" },
  draft: { label: "Borrador", tone: "mute" },
  cancelled: { label: "Cancelado", tone: "error" },
};

function statusOf(s: string): { label: string; tone: ChipTone } {
  return STATUS[s] ?? { label: s, tone: "mute" };
}

const FORMAT_LABEL: Record<string, string> = {
  americano: "Americano",
  ko: "Cuadro",
  groups_ko: "Grupos + Cuadro",
  ko_consolation: "Cuadro con consolación",
};

function formatFee(t: DbTournament): string | null {
  if (t.entry_fee == null) return null;
  const n = Number(t.entry_fee);
  if (!Number.isFinite(n) || n === 0) return null;
  return `${n.toFixed(2).replace(".", ",")} €`;
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

export function ExploreTournaments() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("todos");
  const [code, setCode] = useState("");

  const { data, loading, error } = useAsync(
    () => exploreTournaments(),
    [],
    true
  );
  const all = data ?? [];

  const q = query.trim().toLowerCase();
  const rows = all.filter((t) => {
    if (filter !== "todos" && t.status !== filter) return false;
    if (!q) return true;
    return `${t.name} ${t.club_name ?? ""} ${t.location ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  // Los filtros salen de lo que realmente hay, no de una lista fija.
  const statuses = Array.from(new Set(all.map((t) => t.status)));

  return (
    <div className="tw-page">
      <PageHeader
        title="Torneos"
        lede="Busca por zona, club o fecha, o entra directo con el código que te ha pasado el club."
        meta={[
          loading
            ? "Cargando…"
            : `${all.length} ${all.length === 1 ? "torneo" : "torneos"}`,
        ]}
      />

      <div className="tw-tourney-grid">
        <div>
          <div className="tw-toolbar">
            <InputWrap icon={<IconSearch size={15} />}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por nombre, club o lugar"
                aria-label="Buscar torneo"
              />
            </InputWrap>
            {statuses.length > 1 && (
              <Segmented
                label="Estado"
                value={filter}
                onChange={setFilter}
                options={["todos", ...statuses].map((f) => ({
                  value: f,
                  label: f === "todos" ? "Todos" : statusOf(f).label,
                }))}
              />
            )}
          </div>

          {loading ? (
            <div className="tw-tourney-cards">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <Card>
              <EmptyState
                icon={<IconTrophy size={22} />}
                title="No se pudieron cargar los torneos"
                body={error}
              />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconTrophy size={22} />}
                title="No hay torneos que encajen"
                body="Prueba con otra búsqueda o cambia el filtro."
              />
            </Card>
          ) : (
            <div className="tw-tourney-cards">
              {rows.map((t) => {
                const st = statusOf(t.status);
                const fee = formatFee(t);
                const meta1 = [t.club_name ?? "Sin club", t.location]
                  .filter(Boolean)
                  .join(" · ");
                const meta2 = [
                  formatDate(t.starts_on),
                  t.format ? FORMAT_LABEL[t.format] ?? t.format : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link key={t.id} href={`/torneos/${t.id}`} style={{ color: "inherit" }}>
                    <Card
                      flush
                      hover
                      style={{ height: "100%", display: "flex", flexDirection: "column" }}
                    >
                      <div
                        className={"tw-tourney-cover" + (t.cover_url ? "" : " is-empty")}
                        style={
                          t.cover_url
                            ? {
                                backgroundImage: `url(${t.cover_url})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                      >
                        {!t.cover_url && <IconTrophy size={22} />}
                        <Chip
                          tone={st.tone}
                          style={{ position: "absolute", top: 12, right: 12 }}
                        >
                          {st.label}
                        </Chip>
                      </div>

                      <div className="card-body" style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
                          {t.name}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--text-muted)" }}>
                          {meta1}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
                          {meta2}
                        </div>

                        {((t.categories ?? []).length > 0 || (t.genders ?? []).length > 0) && (
                          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(t.categories ?? []).map((c) => (
                              <Chip key={c} tone="mute" plain>
                                {c}
                              </Chip>
                            ))}
                            {(t.genders ?? []).map((g) => (
                              <Chip key={g} tone="mute" plain>
                                {g}
                              </Chip>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="card-foot">
                        {t.players != null && (
                          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                            <span className="mono">{t.players}</span>{" "}
                            {t.pair_based ? "jugadores" : "plazas"}
                          </span>
                        )}
                        <span style={{ flex: 1 }} />
                        {fee && (
                          <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                            {fee}
                          </span>
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Códigos ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card flush>
            <CardHead
              title="Tengo un código"
              sub="Entra directo al torneo con el código que te ha pasado el club."
            />
            <div className="card-body">
              <Field label="Código del torneo" htmlFor="explore-code">
                <div style={{ display: "flex", gap: 8 }}>
                  <Input
                    id="explore-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ej. K7P2QX"
                    aria-label="Código del torneo"
                    className="mono"
                    style={{ letterSpacing: "0.12em" }}
                  />
                  <Btn
                    variant="accent"
                    disabled={code.trim().length < 4}
                    onClick={() => {
                      const hit = all.find(
                        (t) => t.signup_code?.toUpperCase() === code.trim()
                      );
                      if (hit) window.location.href = `/torneos/${hit.id}`;
                      else setQuery(code.trim());
                    }}
                  >
                    Buscar
                  </Btn>
                </div>
              </Field>
            </div>
          </Card>

          <Card flush>
            <ListRow
              href="/club/torneos"
              icon={
                <IconTile>
                  <IconTicket size={16} />
                </IconTile>
              }
              title="Organizo torneos"
              sub="Crea y gestiona los torneos de tu club"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
