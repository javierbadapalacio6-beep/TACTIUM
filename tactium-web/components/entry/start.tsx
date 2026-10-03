"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { EntryFrame, Field, Input, Segmented } from "./EntryFrame";
import {
  Btn,
  Card,
  CardHead,
  Eyebrow,
  Modal,
  Note,
  // El `Segmented` de EntryFrame solo admite opciones de texto plano
  // (`readonly T[]`), y aqui la etiqueta no es el valor: «Equipos del
  // club» guarda "owned". Por eso se tira del de ui.
  Segmented as UiSegmented,
  Select as UiSelect,
} from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconBuilding,
  IconCheck,
  IconChevronRight,
  IconFlag,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrophy,
  IconUpload,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";
import {
  createClub,
  createPlayer,
  createTeam,
  fetchClub,
  fetchClubTeams,
  startSubscriptionTrial,
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
  type FcpImportMode,
  type FcpTeamOption,
} from "@/lib/fcp-import";
import { useSession } from "@/lib/session";
import { InlineInvitePreview } from "@/components/invite/InviteJoin";
import { InvitePanel } from "@/components/invite/InvitePanel";
import { guardedWrite } from "@/lib/writes";
import { TOURNAMENT_FREE_PAIRS } from "@/lib/tournament-billing";
import { EASE, Stagger, StaggerItem, StepProgress } from "./motion-bits";

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

/* ═══ 03 · ¿QUÉ VAS A HACER? (paso 0) ═══════════════════════════ */

/**
 * Una sola pregunta. Antes eran dos pantallas («¿Qué vas a hacer?» y «¿Cómo
 * vas a empezar?»); ahora cada opción lleva directa a su camino y dice lo que
 * cuesta de verdad. Orden y textos iguales que en la app.
 */
const START_OPTIONS = [
  {
    key: "equipo",
    title: "Capitanear un equipo",
    sub: "Convocatoria, alineación y acta · 14 días gratis",
    href: "/empezar/equipo",
    Icon: IconShield,
  },
  {
    key: "club",
    title: "Gestionar un club",
    sub: "Varios equipos en un panel · 14 días gratis",
    href: "/empezar/club",
    Icon: IconBuilding,
  },
  {
    key: "torneos",
    title: "Organizar torneos",
    sub: `Hasta ${TOURNAMENT_FREE_PAIRS} parejas, gratis`,
    href: "/torneos/organizar",
    Icon: IconTrophy,
  },
] as const;

const INVITE_CODE_LENGTH = 8;

/** Acepta el código o el enlace entero (tactium.io/i/XK8R9P3M). */
function cleanInviteInput(raw: string): string {
  const fromLink = raw.match(/\/i\/([A-Za-z0-9]+)/);
  const base = fromLink ? fromLink[1] : raw;
  return base.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, INVITE_CODE_LENGTH);
}

/** Fila-opción del paso 0: icono, título, precio real y chevron. */
function StartOption({
  title,
  sub,
  Icon,
  href,
  onClick,
  selected,
}: {
  title: string;
  sub: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const reduce = useReducedMotion();
  const inner = (
    <>
      <span className="tile-icon">
        <Icon size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
          {title}
        </span>
        <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
          {sub}
        </span>
      </span>
      <span
        style={{
          color: "var(--text-faint)",
          display: "flex",
          flex: "none",
          transform: selected ? "rotate(90deg)" : undefined,
          transition: "transform var(--dur-base) var(--ease)",
        }}
      >
        <IconChevronRight size={16} />
      </span>
    </>
  );
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "14px 16px",
    textAlign: "left",
    cursor: "pointer",
    color: "var(--text)",
    fontFamily: "var(--font-ui)",
    ...(selected
      ? { background: "var(--accent-10)", borderColor: "var(--accent-40)" }
      : null),
  };
  return (
    <StaggerItem
      whileHover={reduce ? undefined : { y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      {href ? (
        <Link href={href} className="card card-hover" style={style}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={selected}
          className="card card-hover"
          style={style}
        >
          {inner}
        </button>
      )}
    </StaggerItem>
  );
}

export function Start() {
  const { user, signOut } = useSession();
  const reduce = useReducedMotion();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [code, setCode] = useState("");
  const firstName = user?.name.split(" ")[0];

  return (
    <EntryFrame>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
          minHeight: 32,
        }}
      >
        <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          {firstName ? `Hola, ${firstName}` : ""}
        </span>
        {user && (
          <Btn variant="quiet" size="sm" onClick={() => void signOut()}>
            Cerrar sesión
          </Btn>
        )}
      </div>

      <Eyebrow tone="accent">Bienvenido</Eyebrow>
      <h1 style={{ marginTop: 8 }}>¿Qué vas a hacer en TACTIUM?</h1>

      <Stagger gap={0.06} delay={0.05} style={{ marginTop: 24, display: "grid", gap: 10 }}>
        {START_OPTIONS.map((o) => (
          <StartOption key={o.key} title={o.title} sub={o.sub} Icon={o.Icon} href={o.href} />
        ))}

        <StaggerItem>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "14px 0 4px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-faint)",
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            Soy jugador
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
        </StaggerItem>

        <StartOption
          title="Me han invitado a un equipo"
          sub="Tengo un enlace o un código"
          Icon={IconUserPlus}
          selected={inviteOpen}
          onClick={() => setInviteOpen((o) => !o)}
        />

        <AnimatePresence initial={false}>
          {inviteOpen && (
            <motion.div
              key="code"
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ display: "grid", gap: 12, paddingTop: 6 }}>
                <Field
                  label="Código de invitación"
                  hint="Te lo pasa tu capitán. También vale el enlace entero."
                  action={
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: "var(--text-faint)" }}
                      aria-live="polite"
                    >
                      {code.length}/{INVITE_CODE_LENGTH}
                    </span>
                  }
                >
                  <Input
                    type="text"
                    placeholder="XK8R9P3M"
                    value={code}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    autoFocus
                    onChange={(e) => setCode(cleanInviteInput(e.target.value))}
                    className="mono"
                    style={{ letterSpacing: "0.12em" }}
                  />
                </Field>
                {/* Antes de unirse se ve A QUÉ equipo y se elige la ficha. */}
                {code.length === INVITE_CODE_LENGTH && (
                  <Card>
                    <InlineInvitePreview code={code} />
                  </Card>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <StaggerItem style={{ marginTop: 10, textAlign: "center" }}>
          <Link href="/" className="link-action">
            Juego por mi cuenta · gratis →
          </Link>
        </StaggerItem>
      </Stagger>
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
  const { user, teams } = useSession();
  // Paso final del alta independiente: «Ahora, tu gente».
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
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
    if (!res.ok) {
      setFcpErr(res.reason);
      return;
    }
    const first = res.data[0];
    if (fromClub || !first) {
      window.location.href = backHref;
      return;
    }
    await afterIndependentTeam(first.teamId, first.equipo);
    setImportOpen(false);
  }

  /**
   * Tras crear un equipo independiente: si es el PRIMERO, arranca la prueba
   * de 14 días sin tarjeta (best-effort: si falla, el equipo ya está creado y
   * el paywall seguirá ofreciéndola) y enseña el paso de invitar.
   */
  async function afterIndependentTeam(teamId: string, teamName: string) {
    const ownedIndependent = teams.filter(
      (t) => !t.clubId && (t.role === "captain" || t.role === "admin"),
    );
    if (user && ownedIndependent.length === 0) {
      await guardedWrite("activar la prueba gratis", () =>
        startSubscriptionTrial("user", user.id, "captain"),
      );
    }
    try {
      localStorage.setItem("tactium-active-team", teamId);
    } catch {
      /* sin persistencia: la sesión elegirá el primero */
    }
    setCreated({ id: teamId, name: teamName });
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
    if (!res.ok) {
      setBusy(false);
      setErr(res.reason);
      return;
    }
    // Desde el club: recarga completa, la sesión detecta el equipo.
    if (fromClub) {
      window.location.href = backHref;
      return;
    }
    await afterIndependentTeam(res.data, name.trim());
    setBusy(false);
  }

  const scrollRow: CSSProperties = {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 2,
  };

  const body = (
    <>
      {!fromClub && (
        <StepProgress
          step={1}
          aside={
            <Link href="/empezar" className="link-action">
              Atrás
            </Link>
          }
        />
      )}
      <h1>{fromClub ? "Configura el equipo" : "Tu equipo"}</h1>
      {fromClub && (
        <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
          Configura la competición · puedes cambiarlo todo después.
        </p>
      )}

      {/* Búscate primero: con la federación se rellena todo solo. Importar
          aquí NO pasa por el paywall: la prueba arranca en este mismo paso. */}
      <FcpLookupCard onSearch={() => setImportOpen(true)} />

      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "18px 0",
          fontSize: 12.5,
          color: "var(--text-faint)",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />o
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

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
        {busy ? "Creando…" : fromClub ? "Crear equipo" : "Continuar"}
      </Btn>

      {importOpen && (
        <Modal
          open
          onClose={() => setImportOpen(false)}
          labelledBy="tw-fcp-title"
          title="Búscate en la Liga Cántabra"
          lede="Elige tu equipo y lo creamos con su categoría, su grupo y la plantilla con los puntos oficiales."
        >
          <Input
            type="text"
            placeholder="Nombre del equipo o del club…"
            value={fcpQuery}
            autoFocus
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

  if (created && !fromClub) {
    return <InviteYourPeople teamId={created.id} teamName={created.name} />;
  }

  return fromClub ? (
    <div className="tw-page-narrow">
      <Card>{body}</Card>
    </div>
  ) : (
    <EntryFrame>{body}</EntryFrame>
  );
}

/**
 * Tarjeta destacada del paso 1: «¿Juegas en la Liga Cántabra?». Abre la
 * búsqueda federativa que ya existía (antes escondida tras elegir
 * «Federada» + «Cántabra» en el formulario).
 */
function FcpLookupCard({ onSearch }: { onSearch: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.12 }}
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: "var(--r-lg)",
        background: "var(--accent-10)",
        border: "1px solid var(--accent-40)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <span className="tile-icon" style={{ flex: "none" }}>
        <IconFlag size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
          ¿Juegas en la Liga Cántabra?
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)", textWrap: "pretty" }}>
          Búscate y rellenamos categoría, grupo y plantilla con los puntos oficiales.
        </p>
      </div>
      <Btn variant="accent" icon={<IconSearch size={15} />} onClick={onSearch}>
        Buscarme
      </Btn>
    </motion.div>
  );
}

/* ═══ 04b · AHORA, TU GENTE (paso final del alta) ═════════════════ */

/**
 * El alta no acaba en un panel vacío: acaba invitando. Código grande, el
 * enlace para compartir (mismo mensaje que la app), alta manual de jugadores
 * o seguir. Los enlaces recargan la página para que la sesión vea el equipo.
 */
export function InviteYourPeople({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [toast, setToast] = useState<string | null>(null);
  // «Lo haré luego» deja de tener sentido cuando ya ha compartido o la
  // plantilla tiene gente: entonces es simplemente «Ir a mi equipo».
  const [shared, setShared] = useState(false);
  const [players, setPlayers] = useState(0);
  const done = shared || players > 0;
  return (
    <EntryFrame>
      <StepProgress step={2} />
      <h1>Ahora, tu gente</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Manda el enlace al grupo de {teamName}. Invitar es gratis: se unen desde
        la app o desde la web.
      </p>

      <InvitePanel
        teamId={teamId}
        teamName={teamName}
        onboarding
        onToast={setToast}
        onShared={() => setShared(true)}
        onRosterCount={setPlayers}
      />

      <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
        <a href="/empezar/jugadores" className="btn btn-ghost btn-lg btn-block">
          <IconUsers size={16} />
          Añadir jugadores a mano
        </a>
        <a
          href="/equipo"
          className={"btn btn-lg btn-block " + (done ? "btn-accent" : "btn-quiet")}
        >
          {done ? "Ir a mi equipo" : "Lo haré luego → ir a mi equipo"}
        </a>
      </div>
      {toast && (
        <Note style={{ marginTop: 16 }}>{toast}</Note>
      )}
    </EntryFrame>
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
    if (!res.ok) {
      setBusy(false);
      setErr(res.reason);
      return;
    }
    // Prueba de 14 días sin tarjeta para el club (best-effort: si falla, el
    // club ya existe y la facturación seguirá ofreciéndola).
    await guardedWrite("activar la prueba gratis", () =>
      startSubscriptionTrial("club", res.data, "club_starter"),
    );
    try {
      localStorage.setItem("tactium-active-club", res.data);
    } catch {
      /* sin persistencia */
    }
    setBusy(false);
    // Recarga completa para que la sesión detecte el club nuevo. Sigue el
    // paso 1: sus equipos (importados de la federación o a mano).
    window.location.href = "/empezar/club/equipos";
  }

  return (
    <EntryFrame>
      <StepProgress
        step={1}
        aside={
          <Link href="/empezar" className="link-action">
            Atrás
          </Link>
        }
      />
      <h1>Tu club</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Ahora el nombre; en un momento, sus equipos.
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

/** Paso 2 del alta de club. */
const CLUB_PEOPLE_HREF = "/empezar/club/gente";

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
    <ClubFcpImport clubId={clubId} clubName={club?.name ?? "tu club"} onboarding />
  ) : (
    <ClubManualTeams clubId={clubId} />
  );
}

/** Import de club: busca en la Federación Cántabra y crea TODOS los equipos
 *  elegidos con su plantilla y sus puntos (multi-selección). */
export function ClubFcpImport({
  clubId,
  clubName,
  onboarding = false,
}: {
  clubId: string;
  clubName: string;
  /** Dentro del alta: barra de pasos y, al acabar, «Ahora, tu gente». */
  onboarding?: boolean;
}) {
  const router = useRouter();
  const doneHref = onboarding ? CLUB_PEOPLE_HREF : "/club";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FcpClubGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<number, FcpTeamOption>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Propios o INVITADOS: equipos que juegan en estas pistas sin ser del club.
  // La app lo tiene desde hace tiempo; la web no lo tenía en absoluto.
  const [mode, setMode] = useState<FcpImportMode>("owned");

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
      importFcpTeams(clubId, Object.values(selected), mode),
    );
    setBusy(false);
    if (res.ok) window.location.href = doneHref;
    else setErr(res.reason);
  }

  return (
    <EntryFrame wide>
      {onboarding && <StepProgress step={1} />}
      <h1>Importa los equipos de {clubName}</h1>
      <p style={{ margin: "8px 0 14px", fontSize: 13.5, color: "var(--text-muted)" }}>
        {mode === "owned"
          ? "Busca tu club en la Federación Cántabra y crea todos sus equipos con su plantilla y sus puntos oficiales."
          : "Equipos de OTROS clubes que juegan en tus pistas. Les pondrás día, hora y pista, y nada más: ni plantilla ni alineaciones. No consumen cuota de tu plan."}
      </p>

      <div style={{ marginBottom: 18 }}>
        <UiSegmented
          label="Qué equipos vas a importar"
          value={mode}
          onChange={(v) => {
            setMode(v as FcpImportMode);
            // Lo elegido en un modo no vale para el otro: se crean distinto.
            setSelected({});
          }}
          options={[
            { value: "owned", label: "Equipos del club" },
            { value: "venue", label: "Equipos invitados" },
          ]}
        />
      </div>

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
        <Btn size="lg" onClick={() => router.push(doneHref)}>
          Omitir · lo hago luego
        </Btn>
      </div>
    </EntryFrame>
  );
}

/** Alta manual de los equipos del club (clubes no cántabros). Ahora crea de
 *  verdad (antes solo navegaba a /club sin crear nada). */
function ClubManualTeams({ clubId }: { clubId: string }) {
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
    if (res.ok) window.location.href = CLUB_PEOPLE_HREF;
    else setErr(res.reason);
  }

  return (
    <EntryFrame wide>
      <StepProgress
        step={1}
        aside={
          <Link href={CLUB_PEOPLE_HREF} className="link-action">
            Lo haré luego
          </Link>
        }
      />
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

/* ═══ 06b · AHORA, TU GENTE (paso 2 del club) ═════════════════════ */

/**
 * Cierre del alta de club: el enlace de cada equipo para pasárselo a su
 * capitán y a sus jugadores (entran gratis bajo el plan del club). Mismo
 * panel de invitar que el del panel del club.
 */
export function ClubYourPeople() {
  const { clubId } = useSession();
  const { data: teams, loading } = useAsync(
    () => (clubId ? fetchClubTeams(clubId) : Promise.resolve([])),
    [clubId],
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const list = teams ?? [];
  const current = list.find((t) => t.id === teamId) ?? list[0] ?? null;

  return (
    <EntryFrame>
      <StepProgress step={2} />
      <h1>Ahora, tu gente</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Pasa a cada equipo su enlace. Capitanes y jugadores se unen gratis: los
        cubre el plan del club.
      </p>

      {loading ? (
        <SkeletonCard />
      ) : !current ? (
        <Card>
          <EmptyState
            compact
            icon={<IconUsers size={22} />}
            title="Aún no hay equipos"
            body="Cuando des de alta los equipos del club, cada uno tendrá su enlace para invitar."
          />
        </Card>
      ) : (
        <>
          {list.length > 1 && (
            <Field label="Equipo">
              <UiSelect value={current.id} onChange={(e) => setTeamId(e.target.value)}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </UiSelect>
            </Field>
          )}
          <div style={{ marginTop: list.length > 1 ? 16 : 0 }}>
            <InvitePanel
              key={current.id}
              teamId={current.id}
              teamName={current.name}
              onToast={setToast}
            />
          </div>
        </>
      )}

      <a href="/club" className="btn btn-accent btn-lg btn-block" style={{ marginTop: 20 }}>
        Ir al panel del club
      </a>
      {toast && <Note style={{ marginTop: 16 }}>{toast}</Note>}
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
      <StepProgress step={2} />
      <h1>Añade tus jugadores</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 13.5, color: "var(--text-muted)" }}>
        {activeTeam ? `Plantilla de ${activeTeam.name}. ` : ""}
        Añade jugadores a mano o escanea el ranking de la federación.
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
                <span>Puntos de la federación</span>
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
                    aria-label="Puntos de la federación"
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
                  Arrastra una imagen o un PDF del ranking de la federación, o pega desde el
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
