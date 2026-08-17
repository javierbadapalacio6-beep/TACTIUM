"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";

import { EntryFrame, Field, Input, Segmented } from "./EntryFrame";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState } from "@/components/states";
import {
  IconBuilding,
  IconCheck,
  IconPlus,
  IconShield,
  IconUpload,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";
import { createClub, createTeam, redeemInvitation } from "@/lib/queries";
import {
  COMPETITION_PRESETS,
  FCP_FEDERATION_CODE,
  FEDERATIONS,
  TEAM_CATEGORIES,
  TEAM_GENDERS,
  TEAM_GROUPS,
  type Federation,
} from "@/lib/federations";
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
      style={{
        height: 46,
        minWidth,
        padding: "0 14px",
        borderRadius: 12,
        border: `1px solid ${selected ? "var(--accent)" : "var(--hair-strong)"}`,
        background: selected ? "var(--accent-10)" : "transparent",
        color: selected ? "var(--accent)" : "var(--text-muted)",
        fontSize: 14,
        fontWeight: selected ? 700 : 500,
        cursor: "pointer",
        fontFamily: "'Satoshi', sans-serif",
        whiteSpace: "nowrap",
        flex: "none",
      }}
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
    tag: "RÁPIDO",
    title: "Equipo independiente",
    body: "Tú gestionas, tú alineas. Listo en 2 minutos.",
    foot: "Tras prueba: 4,99 €/mes",
    href: "/empezar/equipo",
    Icon: IconShield,
  },
  {
    key: "club",
    tag: "ESCALABLE",
    title: "Club con varios equipos",
    body: "Para clubes con múltiples equipos y capitanes.",
    foot: "Tras prueba: desde 11,99 €/mes",
    href: "/empezar/club",
    Icon: IconBuilding,
  },
  {
    key: "invitado",
    tag: "SOY JUGADOR",
    title: "Me han invitado a un equipo",
    body: "Entra con el código que te ha pasado tu capitán.",
    foot: "",
    href: "",
    Icon: IconUserPlus,
  },
  {
    key: "suelto",
    tag: "GRATIS",
    title: "Juego por mi cuenta",
    body: "Registra tus partidos y mira tus números.",
    foot: "",
    href: "/",
    Icon: IconUsers,
  },
] as const;

export function Start() {
  const router = useRouter();
  const { user } = useSession();
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
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Eyebrow>BIENVENIDO</Eyebrow>
        <h1 style={{ margin: "16px 0 0", fontSize: "clamp(30px, 4.5vw, 42px)" }}>
          ¿Cómo vas a empezar?
        </h1>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 15,
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
              className="card"
              style={{
                padding: 24,
                textAlign: "left",
                cursor: "pointer",
                color: "var(--text)",
                border: `1.5px solid ${on ? "var(--accent)" : "transparent"}`,
                transition: "all var(--dur-fast) var(--ease)",
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
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                    color: on ? "var(--accent)" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <p.Icon size={18} />
                </span>
                <span className="chip chip-mute">{p.tag}</span>
              </div>

              <div
                style={{
                  marginTop: 18,
                  fontSize: 16.5,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {p.title}
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textWrap: "pretty",
                }}
              >
                {p.body}
              </div>
              {p.foot && (
                <div
                  className="mono"
                  style={{
                    marginTop: 14,
                    fontSize: 10,
                    letterSpacing: "0.14em",
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
          <Field label="Código">
            <div style={{ display: "flex", gap: 10 }}>
              <Input
                type="text"
                placeholder="ABC-123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mono"
                style={{ letterSpacing: "0.18em" }}
              />
              <button
                type="button"
                className="btn btn-accent"
                disabled={!canGo || busy}
                onClick={redeem}
                style={{ padding: "13px 22px", fontSize: 13.5, borderRadius: 12 }}
              >
                {busy ? "…" : "Unirme"}
              </button>
            </div>
          </Field>
          {err && (
            <p style={{ marginTop: 12, color: "var(--error)", fontSize: 13 }}>
              {err}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {!needsCode && (
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => router.push(current.href || "/")}
            style={{ padding: "14px 30px", fontSize: 15 }}
          >
            Empezar
          </button>
        )}
        {/* Sólo tiene sentido si HAY sesión (a /empezar se llega logueado para
            montar equipo/club). Para un visitante anónimo no se muestra. */}
        {user && (
          <Link
            href="/entrar"
            className="btn"
            style={{
              padding: "14px 20px",
              fontSize: 13.5,
              fontWeight: 500,
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
            }}
          >
            Cerrar sesión
          </Link>
        )}
      </div>
    </EntryFrame>
  );
}

/* ═══ 04 · CREAR EQUIPO ═══════════════════════════════════════════ */

// Géneros (etiqueta legible) para el alta múltiple de equipos de club.
const GENDERS = ["Masculino", "Femenino", "Mixto"] as const;

export function CreateTeam({ fromClub }: { fromClub?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [comp, setComp] = useState("federada");
  const [federation, setFederation] = useState<Federation | null>(null);
  const [fedOpen, setFedOpen] = useState(false);
  const [league, setLeague] = useState("");
  const [cat, setCat] = useState("2ª");
  const [gender, setGender] = useState("masculino");
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("A");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preset = COMPETITION_PRESETS.find((p) => p.id === comp) ?? COMPETITION_PRESETS[0];
  const isFederada = comp === "federada";
  const isFcp = isFederada && federation?.code === FCP_FEDERATION_CODE;

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
    // El alta de equipo DENTRO de un club necesita el id del club, que aún no
    // fluye entre pasos en la web → ese caso se hace desde el panel del club.
    if (fromClub) {
      router.push("/empezar/jugadores");
      return;
    }
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
      }),
    );
    setBusy(false);
    // Recarga completa: la sesión detecta el equipo y aterriza en su plantilla.
    if (res.ok) window.location.href = "/equipo";
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
      <Eyebrow>{fromClub ? "CLUB · NUEVO EQUIPO" : "EQUIPO · NUEVO"}</Eyebrow>
      <h1 style={{ margin: "16px 0 6px", fontSize: 30 }}>
        {fromClub ? "Configura el equipo" : "Crea tu equipo"}
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-muted)" }}>
        Configura la competición · puedes cambiarlo todo después.
      </p>

      <div style={{ display: "grid", gap: 18 }}>
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
            <button
              type="button"
              onClick={() => setFedOpen(true)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                minHeight: 52,
                padding: "12px 14px",
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--hair-strong)",
                background: "var(--bg-card)",
                color: "var(--text)",
                cursor: "pointer",
                fontFamily: "'Satoshi', sans-serif",
                textAlign: "left",
              }}
            >
              {federation ? (
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
                    {federation.name}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--text-faint)" }}
                  >
                    {federation.region} · {federation.shortName}
                  </span>
                </span>
              ) : (
                <span style={{ color: "var(--text-faint)", fontSize: 14 }}>
                  Selecciona federación
                </span>
              )}
              <span style={{ color: "var(--text-faint)", fontSize: 18 }}>›</span>
            </button>
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
        <p style={{ marginTop: 16, color: "var(--error)", fontSize: 13 }}>{err}</p>
      )}
      <button
        type="button"
        className="btn btn-accent"
        disabled={busy || !valid}
        onClick={submit}
        style={{ marginTop: 20, width: "100%", padding: 15, fontSize: 15 }}
      >
        {busy ? "Creando…" : "Crear equipo"}
      </button>

      {fedOpen && (
        <Modal open onClose={() => setFedOpen(false)} labelledBy="tw-fed-title">
          <h3 id="tw-fed-title" style={{ margin: "0 0 14px", fontSize: 18 }}>
            Selecciona federación
          </h3>
          <div style={{ display: "grid", gap: 6, maxHeight: 440, overflowY: "auto" }}>
            {FEDERATIONS.map((f) => {
              const sel = federation?.code === f.code;
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => {
                    setFederation(f);
                    setFedOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 12px",
                    borderRadius: 12,
                    border: `1px solid ${sel ? "var(--accent)" : "var(--hair)"}`,
                    background: sel ? "var(--accent-10)" : "var(--bg-card)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      minWidth: 56,
                      textAlign: "center",
                      fontSize: 11,
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {f.shortName}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {f.region}
                    </span>
                  </span>
                  {sel && (
                    <span style={{ marginLeft: "auto", color: "var(--accent)" }}>
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

  return fromClub ? <Card>{body}</Card> : <EntryFrame wide>{body}</EntryFrame>;
}

/* ═══ 05 · CREAR CLUB ═════════════════════════════════════════════ */

export function CreateClub() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear el club", () =>
      createClub(name.trim()),
    );
    setBusy(false);
    // Recarga completa para que la sesión detecte el club nuevo y aterrice en
    // su panel (donde ya se pueden crear equipos y gestionar todo).
    if (res.ok) window.location.href = "/club";
    else setErr(res.reason);
  }

  return (
    <EntryFrame>
      <Eyebrow>CLUB · NUEVO</Eyebrow>
      <h1 style={{ margin: "16px 0 6px", fontSize: 30 }}>Crea tu club</h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--text-muted)" }}>
        Después darás de alta sus equipos.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Nombre del club">
          <Input
            type="text"
            placeholder="Club Halcones"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Ciudad">
          <Input type="text" placeholder="Santander" />
        </Field>

        <Field label="Escudo · PNG o JPG">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 12,
              border: "1px dashed var(--hair-strong)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                background: "var(--bg-card-2)",
                color: "var(--text-faint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <IconUpload size={20} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>
                Añadir foto
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontSize: 12,
                  color: "var(--text-faint)",
                }}
              >
                Arrastra el escudo o elige un archivo
              </span>
            </span>
            <input type="file" accept="image/*" hidden />
          </label>
        </Field>
      </div>

      {err && (
        <p style={{ marginTop: 16, color: "var(--error)", fontSize: 13 }}>{err}</p>
      )}
      <button
        type="button"
        className="btn btn-accent"
        disabled={busy || name.trim().length < 2}
        onClick={submit}
        style={{ marginTop: 20, width: "100%", padding: 15, fontSize: 15 }}
      >
        {busy ? "Creando…" : "Crear club"}
      </button>
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

export function CreateClubTeams() {
  const router = useRouter();
  const [teams, setTeams] = useState<DraftTeam[]>([
    { id: 1, name: "Halcones A", gender: "Masculino", category: "1ª" },
    { id: 2, name: "Halcones B", gender: "Masculino", category: "2ª" },
    { id: 3, name: "Halcones Femenino", gender: "Femenino", category: "1ª" },
  ]);
  const [nextId, setNextId] = useState(4);

  const patch = (id: number, p: Partial<DraftTeam>) =>
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const valid = teams.filter((t) => t.name.trim().length > 1).length;

  return (
    <EntryFrame wide>
      <Eyebrow>CLUB · EQUIPOS · EN LOTE</Eyebrow>
      <h1 style={{ margin: "16px 0 6px", fontSize: 30 }}>Da de alta tus equipos</h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--text-muted)" }}>
        Añade los que tengas ahora · puedes crear más en cualquier momento.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {teams.map((t, i) => (
          <Card key={t.id} style={{ padding: 18 }}>
            <div className="tw-team-row">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: "var(--text-faint)",
                  paddingTop: 14,
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
                <Input
                  type="text"
                  placeholder="1ª"
                  value={t.category}
                  onChange={(e) => patch(t.id, { category: e.target.value })}
                />
              </Field>
              <button
                type="button"
                onClick={() => setTeams((ts) => ts.filter((x) => x.id !== t.id))}
                disabled={teams.length === 1}
                aria-label={`Quitar ${t.name || "equipo"}`}
                className="btn btn-ghost"
                style={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  borderRadius: 12,
                  marginTop: 22,
                }}
              >
                ×
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setTeams((ts) => [
              ...ts,
              { id: nextId, name: "", gender: "Masculino", category: "" },
            ]);
            setNextId((n) => n + 1);
          }}
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          <IconPlus size={15} />
          Añadir otro equipo
        </button>
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {valid} {valid === 1 ? "EQUIPO" : "EQUIPOS"}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-accent"
          disabled={valid === 0}
          onClick={() => router.push("/club")}
          style={{ padding: "14px 26px", fontSize: 14.5 }}
        >
          Crear equipos
        </button>
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

const SEED: DraftPlayer[] = [
  { id: 1, name: "Diego Ruiz", pts: "4600", pos: "Drive" },
  { id: 2, name: "Marco Bilbao", pts: "4180", pos: "Revés" },
  { id: 3, name: "Iván Sáez", pts: "3950", pos: "Ambos" },
  { id: 4, name: "Álvaro Peña", pts: "3720", pos: "Drive" },
  { id: 5, name: "Nacho Vega", pts: "3480", pos: "Revés" },
  { id: 6, name: "Jorge Lastra", pts: "3200", pos: "Drive" },
  { id: 7, name: "Luis Cano", pts: "2980", pos: "Ambos" },
  { id: 8, name: "Pablo Herrán", pts: "2740", pos: "Revés" },
];

export function AddPlayers() {
  const router = useRouter();
  const [players, setPlayers] = useState<DraftPlayer[]>(SEED);
  const [nextId, setNextId] = useState(9);

  const patch = (id: number, p: Partial<DraftPlayer>) =>
    setPlayers((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <EntryFrame wide>
      <Eyebrow>PLANTILLA · HALCONES A</Eyebrow>
      <h1 style={{ margin: "16px 0 6px", fontSize: 30 }}>Añade tus jugadores</h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "var(--text-muted)" }}>
        Añade jugadores a mano o escanea el ranking FEP.
      </p>

      <div className="tw-players-grid">
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {players.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={34} />}
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
                  <select
                    value={p.pos}
                    aria-label="Posición"
                    onChange={(e) =>
                      patch(p.id, {
                        pos: e.target.value as (typeof POSITIONS)[number],
                      })
                    }
                    className="tw-cell-input"
                  >
                    {POSITIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setPlayers((ps) => ps.filter((x) => x.id !== p.id))
                    }
                    aria-label={`Quitar ${p.name || "jugador"}`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-faint)",
                      cursor: "pointer",
                      fontSize: 17,
                      padding: 6,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </>
          )}

          <div style={{ padding: 14, borderTop: "1px solid var(--hair)" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPlayers((ps) => [
                  ...ps,
                  { id: nextId, name: "", pts: "", pos: "Ambos" },
                ]);
                setNextId((n) => n + 1);
              }}
              style={{ padding: "11px 18px", fontSize: 13 }}
            >
              <IconPlus size={15} />
              Añadir jugador
            </button>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <Eyebrow>ESCANEAR RANKING</Eyebrow>
            <label
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "28px 18px",
                borderRadius: 12,
                border: "1px dashed var(--hair-strong)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <span style={{ color: "var(--accent)" }}>
                <IconUpload size={26} />
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", textWrap: "pretty" }}>
                Arrastra una imagen o un PDF del ranking FEP, o pega desde el
                portapapeles
              </span>
              <input type="file" accept="image/*,.pdf" hidden />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 12, width: "100%", padding: 12, fontSize: 13 }}
            >
              Importar desde la Federación Cántabra
            </button>
          </Card>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid var(--hair-strong)",
            }}
          >
            <span style={{ color: "var(--accent)", display: "flex" }}>
              <IconCheck size={16} />
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.14em",
                color: "var(--text-muted)",
              }}
            >
              {players.length} JUGADORES
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-accent"
        onClick={() => router.push("/")}
        style={{ marginTop: 28, width: "100%", padding: 15, fontSize: 15 }}
      >
        Continuar
      </button>
    </EntryFrame>
  );
}
