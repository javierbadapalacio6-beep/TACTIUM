"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { EntryFrame, Field, Input, Segmented } from "./EntryFrame";
import { Btn, Card, CardHead, Modal, Note } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconFlag,
  IconPlus,
  IconShield,
  IconUpload,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";
import {
  createClub,
  createPlayer,
  createTeam,
  fetchClub,
  redeemInvitation,
} from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import {
  COMPETITION_PRESETS,
  FCP_FEDERATION_CODE,
  FEDERATIONS,
  TEAM_CATEGORIES,
  TEAM_GENDERS,
  TEAM_GROUPS,
  type Federation,
} from "@/lib/federations";
import {
  searchFcpClubs,
  importFcpTeams,
  type FcpClubGroup,
  type FcpTeamOption,
} from "@/lib/fcp-import";
import { useSession } from "@/lib/session";
import { guardedWrite } from "@/lib/writes";

/** Botón-celda de selección (categoría, grupo, competición, género…). */
function CellButton({
  label,
  selected,
  onClick,
  minWidth = 52,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  minWidth?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"tw-fcp-chip" + (selected ? " is-on" : "")}
      style={{ minHeight: 36, minWidth }}
    >
      {label}
    </button>
  );
}

const GENDER_DB: Record<string, string> = {
  Masculino: "masculino",
  Femenino: "femenino",
  Mixto: "mixto",
};

/* ═══ 03 · ¿CÓMO VAS A EMPEZAR? ═══════════════════════════════════ */

const PATHS = [
  {
    key: "equipo",
    tag: "Rápido",
    title: "Equipo independiente",
    body: "Tú gestionas, tú alineas. Listo en 2 minutos.",
    foot: "Tras prueba: 4,99 €/mes",
    href: "/empezar/equipo",
    Icon: IconShield,
  },
  {
    key: "club",
    tag: "Escalable",
    title: "Club con varios equipos",
    body: "Para clubes con múltiples equipos y capitanes.",
    foot: "Tras prueba: desde 11,99 €/mes",
    href: "/empezar/club",
    Icon: IconBuilding,
  },
  {
    key: "invitado",
    tag: "Soy jugador",
    title: "Me han invitado a un equipo",
    body: "Entra con el código que te ha pasado tu capitán.",
    foot: "",
    href: "",
    Icon: IconUserPlus,
  },
  {
    key: "suelto",
    tag: "Gratis",
    title: "Juego por mi cuenta",
    body: "Registra tus partidos y mira tus números.",
    foot: "",
    href: "/",
    Icon: IconUsers,
  },
] as const;

export function Start() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const [picked, setPicked] = useState<string>("equipo");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const current = PATHS.find((p) => p.key === picked)!;
  const needsCode = picked === "invitado";
  const canGo = needsCode ? code.trim().length >= 4 : true;

  async function redeem() {
    if (busy || code.trim().length < 4) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("canjear el código", () =>
      redeemInvitation(code),
    );
    setBusy(false);
    // Recarga completa: la sesión detecta el equipo al que te has unido.
    if (res.ok) window.location.href = "/";
    else setErr(res.reason);
  }

  return (
    <EntryFrame wide>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(26px, 3.6vw, 34px)" }}>
          ¿Cómo vas a empezar?
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
          }}
        >
          Crea tu equipo o tu club
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Punto de partida"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {PATHS.map((p) => {
          const on = p.key === picked;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(p.key)}
              className="card card-hover"
              style={{
                padding: 18,
                textAlign: "left",
                cursor: "pointer",
                color: "var(--text)",
                background: on ? "var(--accent-10)" : undefined,
                borderColor: on ? "var(--accent-40)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span
                  className={"tile-icon" + (on ? "" : " tile-icon-mute")}
                >
                  <p.Icon size={17} />
                </span>
                <span className="chip chip-mute">{p.tag}</span>
              </div>

              <div
                style={{
                  marginTop: 16,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {p.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {p.body}
              </div>
              {p.foot && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--text-faint)",
                  }}
                >
                  {p.foot}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {needsCode && (
        <div style={{ marginTop: 20, maxWidth: 420, marginInline: "auto" }}>
          <Field label="Código de invitación">
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                type="text"
                placeholder="ABC-123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mono"
              />
              <Btn
                variant="accent"
                size="lg"
                disabled={!canGo || busy}
                onClick={redeem}
              >
                {busy ? "…" : "Unirme"}
              </Btn>
            </div>
          </Field>
          {err && (
            <Note tone="error" style={{ marginTop: 12 }}>
              {err}
            </Note>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {!needsCode && (
          <Btn
            variant="accent"
            size="lg"
            onClick={() => router.push(current.href || "/")}
          >
            Empezar
          </Btn>
        )}
        {/* Sólo tiene sentido si HAY sesión (a /empezar se llega logueado para
            montar equipo/club). Para un visitante anónimo no se muestra. */}
        {user && (
          <Btn variant="quiet" size="lg" onClick={() => void signOut()}>
            Cerrar sesión
          </Btn>
        )}
      </div>
    </EntryFrame>
  );
}

/* ═══ 04 · CREAR EQUIPO ═══════════════════════════════════════════ */

/** Selector de federación (botón + modal con las 19 federaciones). Reutilizado
 *  en el alta de equipo y de club. */
export function FederationSelect({
  value,
  onChange,
}: {
  value: Federation | null;
  onChange: (f: Federation) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: 48,
          padding: "8px 12px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {value ? (
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
              {value.name}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              {value.region} · {value.shortName}
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--text-faint)", fontSize: 13.5 }}>
            Selecciona federación
          </span>
        )}
        <span style={{ color: "var(--text-faint)", display: "flex", flex: "none" }}>
          <IconChevronRight size={16} />
        </span>
      </button>

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          labelledBy="tw-fed-title"
          title="Selecciona federación"
        >
          <div style={{ display: "grid", gap: 6, maxHeight: 440, overflowY: "auto" }}>
            {FEDERATIONS.map((f) => {
              const sel = value?.code === f.code;
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => {
                    onChange(f);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: `1px solid ${sel ? "var(--accent-40)" : "var(--line)"}`,
                    background: sel ? "var(--accent-10)" : "var(--bg-card-2)",
                    color: "var(--text)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      minWidth: 52,
                      textAlign: "center",
                      fontSize: 12,
                      color: sel ? "var(--accent)" : "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {f.shortName}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                      {f.region}
                    </span>
                  </span>
                  {sel && (
                    <span style={{ marginLeft: "auto", color: "var(--accent)", display: "flex" }}>
                      <IconCheck size={16} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </>
  );
}

// Géneros (etiqueta legible) para el alta múltiple de equipos de club.
const GENDERS = ["Masculino", "Femenino", "Mixto"] as const;

export function CreateTeam({ clubId }: { clubId?: string }) {
  // Alta desde el panel de un club (con id) vs. alta independiente.
  const fromClub = !!clubId;
  const backHref = fromClub ? "/club/equipos" : "/equipo";
  const [name, setName] = useState("");
  const [comp, setComp] = useState("federada");
  const [federation, setFederation] = useState<Federation | null>(null);
  const [league, setLeague] = useState("");
  const [cat, setCat] = useState("2ª");
  const [gender, setGender] = useState("masculino");
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("A");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Importar de la Federación Cántabra (volcado de plantilla + puntos).
  const [importOpen, setImportOpen] = useState(false);
  const [fcpQuery, setFcpQuery] = useState("");
  const [fcpResults, setFcpResults] = useState<FcpClubGroup[]>([]);
  const [fcpLoading, setFcpLoading] = useState(false);
  const [fcpBusy, setFcpBusy] = useState(false);
  const [fcpErr, setFcpErr] = useState<string | null>(null);

  const preset = COMPETITION_PRESETS.find((p) => p.id === comp) ?? COMPETITION_PRESETS[0];
  const isFederada = comp === "federada";
  const isFcp = isFederada && federation?.code === FCP_FEDERATION_CODE;

  // Búsqueda federativa con debounce mientras el buscador está abierto.
  useEffect(() => {
    if (!importOpen) return;
    let alive = true;
    setFcpLoading(true);
    const h = setTimeout(() => {
      searchFcpClubs(fcpQuery)
        .then((r) => alive && setFcpResults(r))
        .catch(() => alive && setFcpResults([]))
        .finally(() => alive && setFcpLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [fcpQuery, importOpen]);

  async function importFcpTeam(t: FcpTeamOption) {
    if (fcpBusy) return;
    setFcpBusy(true);
    setFcpErr(null);
    const res = await guardedWrite("importar el equipo", () =>
      importFcpTeams(clubId ?? null, [t]),
    );
    setFcpBusy(false);
    if (res.ok) window.location.href = backHref;
    else setFcpErr(res.reason);
  }

  // Valor efectivo de team.league según el tipo de competición (espejo de la app).
  const effectiveLeague = isFederada
    ? league.trim()
    : (preset.leagueValue ?? league.trim());
  const effectiveFederation = isFederada ? (federation?.code ?? null) : null;

  const valid =
    name.trim().length >= 2 &&
    (!isFederada || !!federation) &&
    !!cat &&
    (!hasGroup || !!group);

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear el equipo", () =>
      createTeam({
        name: name.trim(),
        gender,
        federation: effectiveFederation,
        league: effectiveLeague || null,
        category: cat,
        group: hasGroup ? group : null,
        clubId: clubId ?? undefined,
      }),
    );
    setBusy(false);
    // Recarga completa: la sesión detecta el equipo y aterriza donde toca.
    if (res.ok) window.location.href = backHref;
    else setErr(res.reason);
  }

  const scrollRow: CSSProperties = {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 2,
  };

  const body = (
    <>
      <h1>{fromClub ? "Configura el equipo" : "Crea tu equipo"}</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Configura la competición · puedes cambiarlo todo después.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        <Field label="Nombre del equipo">
          <Input
            type="text"
            placeholder="Halcones A"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Competición" hint={preset.blurb}>
          <div style={scrollRow}>
            {COMPETITION_PRESETS.map((p) => (
              <CellButton
                key={p.id}
                label={p.label}
                selected={comp === p.id}
                onClick={() => setComp(p.id)}
                minWidth={78}
              />
            ))}
          </div>
        </Field>

        {isFederada && (
          <Field label="Federación">
            <FederationSelect value={federation} onChange={setFederation} />
          </Field>
        )}

        {isFcp && (
          <Note tone="accent" icon={<IconFlag size={16} />} style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200, color: "var(--text-muted)" }}>
                <strong style={{ display: "block", color: "var(--text)", fontWeight: 700 }}>
                  Importar de la Federación Cántabra
                </strong>
                Busca tu equipo y créalo con su plantilla y sus puntos
                automáticamente. No hace falta rellenar lo de abajo.
              </span>
              <Btn variant="tint" size="sm" onClick={() => setImportOpen(true)}>
                Buscar mi equipo
              </Btn>
            </span>
          </Note>
        )}

        {(comp === "personalizada" || (isFederada && !isFcp)) && (
          <Field label={isFederada ? "Liga · opcional" : "Nombre de la liga · opcional"}>
            <Input
              type="text"
              placeholder={
                isFederada
                  ? "Liga por equipos absoluta"
                  : "Liga interempresas, liga del club…"
              }
              value={league}
              onChange={(e) => setLeague(e.target.value)}
            />
          </Field>
        )}

        <Field label="Categoría">
          <div style={scrollRow}>
            {TEAM_CATEGORIES.map((cv) => (
              <CellButton
                key={cv}
                label={cv}
                selected={cat === cv}
                onClick={() => setCat(cv)}
              />
            ))}
          </div>
        </Field>

        <Field label="Género">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TEAM_GENDERS.map((g) => (
              <CellButton
                key={g.id}
                label={g.label}
                selected={gender === g.id}
                onClick={() => setGender(g.id)}
                minWidth={96}
              />
            ))}
          </div>
        </Field>

        <Field label="Grupo">
          <div style={{ display: "flex", gap: 6, marginBottom: hasGroup ? 8 : 0 }}>
            <CellButton
              label="Sin grupos"
              selected={!hasGroup}
              onClick={() => setHasGroup(false)}
              minWidth={110}
            />
            <CellButton
              label="Con grupo"
              selected={hasGroup}
              onClick={() => setHasGroup(true)}
              minWidth={110}
            />
          </div>
          {hasGroup && (
            <div style={{ display: "flex", gap: 6 }}>
              {TEAM_GROUPS.map((g) => (
                <CellButton
                  key={g}
                  label={g}
                  selected={group === g}
                  onClick={() => setGroup(g)}
                />
              ))}
            </div>
          )}
        </Field>
      </div>

      {err && (
        <Note tone="error" style={{ marginTop: 16 }}>
          {err}
        </Note>
      )}
      <Btn
        variant="accent"
        size="lg"
        block
        disabled={busy || !valid}
        onClick={submit}
        style={{ marginTop: 20 }}
      >
        {busy ? "Creando…" : "Crear equipo"}
      </Btn>

      {importOpen && (
        <Modal
          open
          onClose={() => setImportOpen(false)}
          labelledBy="tw-fcp-title"
          title="Importar de la Federación"
          lede="Busca tu club o equipo y créalo con su plantilla y sus puntos."
        >
          <Input
            type="text"
            placeholder="Busca tu club o equipo"
            value={fcpQuery}
            onChange={(e) => setFcpQuery(e.target.value)}
          />
          {fcpErr && (
            <Note tone="error" style={{ marginTop: 10 }}>
              {fcpErr}
            </Note>
          )}
          <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
            {fcpLoading && (
              <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Buscando…</p>
            )}
            {!fcpLoading &&
              fcpResults.length === 0 &&
              fcpQuery.trim().length > 0 && (
                <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
                  Sin resultados para «{fcpQuery.trim()}».
                </p>
              )}
            {fcpResults.map((club) => (
              <div key={club.club} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  {club.club}
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {club.teams.map((t) => (
                    <button
                      key={t.id_equipo}
                      type="button"
                      disabled={fcpBusy}
                      onClick={() => importFcpTeam(t)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--line)",
                        background: "var(--bg-card-2)",
                        color: "var(--text)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "var(--font-ui)",
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>
                        {t.equipo}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                        {[t.category, t.gender].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {fcpBusy && (
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--accent)" }}>
              Importando…
            </p>
          )}
        </Modal>
      )}
    </>
  );

  return fromClub ? (
    <div className="tw-page-narrow">
      <Card>{body}</Card>
    </div>
  ) : (
    <EntryFrame wide>{body}</EntryFrame>
  );
}

/* ═══ 05 · CREAR CLUB ═════════════════════════════════════════════ */

export function CreateClub() {
  const [name, setName] = useState("");
  const [federation, setFederation] = useState<Federation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear el club", () =>
      createClub(name.trim(), federation?.code ?? null),
    );
    setBusy(false);
    // Recarga completa para que la sesión detecte el club nuevo y aterrice en
    // su panel (donde ya se pueden crear equipos y gestionar todo).
    if (res.ok) window.location.href = "/club";
    else setErr(res.reason);
  }

  return (
    <EntryFrame>
      <h1>Crea tu club</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Después darás de alta sus equipos.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Nombre del club">
          <Input
            type="text"
            placeholder="Club Halcones"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field
          label="Federación · opcional"
          hint="Sus equipos la heredan; si es la Cántabra, podrás importarlos de la Federación."
        >
          <FederationSelect value={federation} onChange={setFederation} />
        </Field>
      </div>

      {err && (
        <Note tone="error" style={{ marginTop: 16 }}>
          {err}
        </Note>
      )}
      <Btn
        variant="accent"
        size="lg"
        block
        disabled={busy || name.trim().length < 2}
        onClick={submit}
        style={{ marginTop: 20 }}
      >
        {busy ? "Creando…" : "Crear club"}
      </Btn>
    </EntryFrame>
  );
}

/* ═══ 06 · EQUIPOS DEL CLUB EN LOTE ═══════════════════════════════ */

interface DraftTeam {
  id: number;
  name: string;
  gender: (typeof GENDERS)[number];
  category: string;
}

/** Alta de equipos del club. Si el club es de la Federación Cántabra ofrece el
 *  IMPORT (todos sus equipos de la federación de una vez); si no, alta manual. */
export function CreateClubTeams() {
  const { clubId } = useSession();
  const { data: club, loading } = useAsync(
    () => (clubId ? fetchClub(clubId) : Promise.resolve(null)),
    [clubId],
  );

  if (!clubId) {
    return (
      <EntryFrame wide>
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="Crea primero tu club"
            body="Los equipos cuelgan de un club."
          />
        </Card>
      </EntryFrame>
    );
  }
  if (loading) {
    return (
      <EntryFrame wide>
        <SkeletonCard />
      </EntryFrame>
    );
  }

  return club?.federation === FCP_FEDERATION_CODE ? (
    <ClubFcpImport clubId={clubId} clubName={club?.name ?? "tu club"} />
  ) : (
    <ClubManualTeams clubId={clubId} />
  );
}

/** Import de club: busca en la Federación Cántabra y crea TODOS los equipos
 *  elegidos con su plantilla y sus puntos (multi-selección). */
export function ClubFcpImport({ clubId, clubName }: { clubId: string; clubName: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FcpClubGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<number, FcpTeamOption>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const h = setTimeout(() => {
      searchFcpClubs(query)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(h);
    };
  }, [query]);

  const selCount = Object.keys(selected).length;
  const toggle = (t: FcpTeamOption) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[t.id_equipo]) delete n[t.id_equipo];
      else n[t.id_equipo] = t;
      return n;
    });

  async function importSelected() {
    if (busy || selCount === 0) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("importar los equipos", () =>
      importFcpTeams(clubId, Object.values(selected)),
    );
    setBusy(false);
    if (res.ok) window.location.href = "/club";
    else setErr(res.reason);
  }

  return (
    <EntryFrame wide>
      <h1>Importa los equipos de {clubName}</h1>
      <p style={{ margin: "8px 0 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Busca tu club en la Federación Cántabra y crea todos sus equipos con su
        plantilla y sus puntos oficiales.
      </p>

      <Input
        type="text"
        placeholder="Busca tu club o equipo"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {err && (
        <Note tone="error" style={{ marginTop: 12 }}>
          {err}
        </Note>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Buscando…</p>
        )}
        {!loading && results.length === 0 && query.trim().length > 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
            Sin resultados para «{query.trim()}».
          </p>
        )}
        {results.map((cg) => (
          <Card key={cg.club} flush>
            <CardHead title={cg.club} count={cg.teams.length} />
            {cg.teams.map((t, i) => {
              const on = !!selected[t.id_equipo];
              return (
                <button
                  key={t.id_equipo}
                  type="button"
                  onClick={() => toggle(t)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 18px",
                    border: "none",
                    borderTop: i === 0 ? "none" : "1px solid var(--line)",
                    background: on ? "var(--accent-10)" : "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "var(--r-xs)",
                      border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                      background: on ? "var(--accent)" : "transparent",
                      color: "var(--text-inverse)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    {on && <IconCheck size={13} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>
                    {t.equipo}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {[t.category, t.gender].filter(Boolean).join(" · ")}
                  </span>
                </button>
              );
            })}
          </Card>
        ))}
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Btn
          variant="accent"
          size="lg"
          disabled={selCount === 0 || busy}
          onClick={importSelected}
        >
          {busy
            ? "Importando…"
            : `Importar ${selCount} ${selCount === 1 ? "equipo" : "equipos"}`}
        </Btn>
        <Btn size="lg" onClick={() => router.push("/club")}>
          Omitir · lo hago luego
        </Btn>
      </div>
    </EntryFrame>
  );
}

/** Alta manual de los equipos del club (clubes no cántabros). Ahora crea de
 *  verdad (antes solo navegaba a /club sin crear nada). */
function ClubManualTeams({ clubId }: { clubId: string }) {
  const router = useRouter();
  const [teams, setTeams] = useState<DraftTeam[]>([
    { id: 1, name: "", gender: "Masculino", category: "1ª" },
  ]);
  const [nextId, setNextId] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = (id: number, p: Partial<DraftTeam>) =>
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const validTeams = teams.filter((t) => t.name.trim().length > 1);

  async function createAll() {
    if (busy || validTeams.length === 0) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear los equipos", async () => {
      for (const t of validTeams)
        await createTeam({
          name: t.name.trim(),
          gender: GENDER_DB[t.gender] ?? "masculino",
          category: t.category || null,
          clubId,
        });
    });
    setBusy(false);
    if (res.ok) window.location.href = "/club";
    else setErr(res.reason);
  }

  return (
    <EntryFrame wide>
      <h1>Da de alta tus equipos</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Añade los que tengas ahora · puedes crear más en cualquier momento.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {teams.map((t, i) => (
          <Card key={t.id}>
            <div className="tw-team-row">
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  paddingTop: 28,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <Field label="Nombre">
                <Input
                  type="text"
                  placeholder="Halcones A"
                  value={t.name}
                  onChange={(e) => patch(t.id, { name: e.target.value })}
                />
              </Field>
              <Field label="Género">
                <Segmented
                  options={GENDERS}
                  value={t.gender}
                  onChange={(g) => patch(t.id, { gender: g })}
                  label={`Género de ${t.name || "el equipo"}`}
                />
              </Field>
              <Field label="Categoría">
                <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                  {TEAM_CATEGORIES.map((cv) => (
                    <CellButton
                      key={cv}
                      label={cv}
                      selected={t.category === cv}
                      onClick={() => patch(t.id, { category: cv })}
                    />
                  ))}
                </div>
              </Field>
              <button
                type="button"
                onClick={() => setTeams((ts) => ts.filter((x) => x.id !== t.id))}
                disabled={teams.length === 1}
                aria-label={`Quitar ${t.name || "equipo"}`}
                className="btn btn-icon"
                style={{ marginTop: 24, fontSize: 17, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </Card>
        ))}
      </div>

      {err && (
        <Note tone="error" style={{ marginTop: 14 }}>
          {err}
        </Note>
      )}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Btn
          icon={<IconPlus size={15} />}
          onClick={() => {
            setTeams((ts) => [
              ...ts,
              { id: nextId, name: "", gender: "Masculino", category: "1ª" },
            ]);
            setNextId((n) => n + 1);
          }}
        >
          Añadir otro equipo
        </Btn>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          <span className="mono">{validTeams.length}</span>{" "}
          {validTeams.length === 1 ? "equipo listo" : "equipos listos"}
        </span>
        <div style={{ flex: 1 }} />
        <Btn
          variant="accent"
          size="lg"
          disabled={validTeams.length === 0 || busy}
          onClick={createAll}
        >
          {busy ? "Creando…" : "Crear equipos"}
        </Btn>
      </div>
    </EntryFrame>
  );
}

/* ═══ 07 · AÑADIR JUGADORES ═══════════════════════════════════════ */

const POSITIONS = ["Drive", "Revés", "Ambos"] as const;

interface DraftPlayer {
  id: number;
  name: string;
  pts: string;
  pos: (typeof POSITIONS)[number];
}

export function AddPlayers() {
  const { activeTeam } = useSession();
  const [players, setPlayers] = useState<DraftPlayer[]>([
    { id: 1, name: "", pts: "", pos: "Ambos" },
  ]);
  const [nextId, setNextId] = useState(2);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = (id: number, p: Partial<DraftPlayer>) =>
    setPlayers((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const validPlayers = players.filter((p) => p.name.trim().length > 1);

  // Crea de verdad los jugadores en el equipo activo (antes solo navegaba). Con
  // 0 jugadores válidos, simplemente continúa (la plantilla se llena luego).
  async function saveAll() {
    if (busy) return;
    const teamId = activeTeam?.id;
    if (!teamId || validPlayers.length === 0) {
      window.location.href = "/equipo";
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("añadir los jugadores", async () => {
      for (const p of validPlayers)
        await createPlayer(teamId, {
          name: p.name.trim(),
          pts: parseInt(p.pts, 10) || 0,
          position: p.pos,
        });
    });
    setBusy(false);
    if (res.ok) window.location.href = "/equipo";
    else setErr(res.reason);
  }

  return (
    <EntryFrame wide>
      <h1>Añade tus jugadores</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        {activeTeam ? `Plantilla de ${activeTeam.name}. ` : ""}
        Añade jugadores a mano o escanea el ranking FEP.
      </p>

      <div className="tw-players-grid">
        <Card flush>
          {players.length === 0 ? (
            <EmptyState
              compact
              icon={<IconUsers size={22} />}
              title="Plantilla vacía"
              body="Añade a tu primer jugador o importa el ranking."
            />
          ) : (
            <>
              <div className="tw-player-head">
                <span>Nombre</span>
                <span>Puntos FEP</span>
                <span>Posición</span>
                <span />
              </div>
              {players.map((p) => (
                <div key={p.id} className="tw-player-row">
                  <input
                    type="text"
                    value={p.name}
                    placeholder="Nombre y apellidos"
                    aria-label="Nombre del jugador"
                    onChange={(e) => patch(p.id, { name: e.target.value })}
                    className="tw-cell-input"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={p.pts}
                    placeholder="0"
                    aria-label="Puntos FEP"
                    onChange={(e) =>
                      patch(p.id, { pts: e.target.value.replace(/\D/g, "") })
                    }
                    className="tw-cell-input mono"
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    {POSITIONS.map((o) => {
                      const on = p.pos === o;
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => patch(p.id, { pos: o })}
                          className={"tw-fcp-chip" + (on ? " is-on" : "")}
                          style={{ flex: 1, minWidth: 0, padding: "0 8px", fontSize: 12 }}
                        >
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPlayers((ps) => ps.filter((x) => x.id !== p.id))
                    }
                    aria-label={`Quitar ${p.name || "jugador"}`}
                    className="btn btn-icon"
                    style={{ width: 30, minHeight: 30, fontSize: 16, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="card-foot">
            <Btn
              size="sm"
              icon={<IconPlus size={14} />}
              onClick={() => {
                setPlayers((ps) => [
                  ...ps,
                  { id: nextId, name: "", pts: "", pos: "Ambos" },
                ]);
                setNextId((n) => n + 1);
              }}
            >
              Añadir jugador
            </Btn>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card flush>
            <CardHead title="Escanear ranking" />
            <div className="card-body">
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  padding: "24px 18px",
                  borderRadius: "var(--r-md)",
                  border: "1px dashed var(--line-strong)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <span style={{ color: "var(--accent)" }}>
                  <IconUpload size={22} />
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Arrastra una imagen o un PDF del ranking FEP, o pega desde el
                  portapapeles
                </span>
                <input type="file" accept="image/*,.pdf" hidden />
              </label>
              <Btn block style={{ marginTop: 12 }}>
                Importar desde la Federación Cántabra
              </Btn>
            </div>
          </Card>

          <Note icon={<IconCheck size={16} />}>
            <span className="mono">{validPlayers.length}</span>{" "}
            {validPlayers.length === 1
              ? "jugador listo para añadir"
              : "jugadores listos para añadir"}
          </Note>
        </div>
      </div>

      {err && (
        <Note tone="error" style={{ marginTop: 16 }}>
          {err}
        </Note>
      )}
      <Btn
        variant="accent"
        size="lg"
        block
        disabled={busy}
        onClick={saveAll}
        style={{ marginTop: 24 }}
      >
        {busy
          ? "Guardando…"
          : validPlayers.length > 0
            ? `Añadir ${validPlayers.length} y continuar`
            : "Continuar sin jugadores"}
      </Btn>
    </EntryFrame>
  );
}
