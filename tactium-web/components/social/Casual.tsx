"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { fetchCasualMatches, fetchPlayers, type DbCasual } from "@/lib/queries";
import {
  createCasualMatch,
  fetchCasualDetail,
  fetchCasualH2H,
  fetchClaimCode,
  fetchFrequentPartners,
  uploadCasualPhoto,
  type FrequentPartner,
} from "@/lib/match-data";
import { SITE_URL } from "@/lib/site";
import { SetsEditor, SetsTable, emptySets, setsLine, summarize, type SetScore } from "@/components/matchday/GamesPicker";
import { KudosButton, MatchRow, MatchScoreboard } from "@/components/matchday/MatchScoreboard";
import { fetchPublicPeople, profileHref, type PublicPerson } from "@/lib/people";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  Input,
  ListRow,
  Modal,
  Note,
  PageHeader,
  Segmented,
  Table,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconCopy,
  IconPlus,
  IconUpload,
  IconUsers,
} from "@/components/Icon";

/** Los tipos que guarda la base: amistoso · entreno · torneo. */
const TYPE_LABEL: Record<string, string> = {
  amistoso: "Amistoso",
  entreno: "Entrenamiento",
  torneo: "Torneo",
};

const formatSets = (sets: [number, number][]) =>
  sets.map(([a, b]) => `${a}-${b}`).join(" ");

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * `winner_side` guarda el lado ganador (0 o 1). El lado 0 es «nosotros» en los
 * amistosos creados desde la app, así que se usa como referencia.
 */
const wonByUs = (c: DbCasual) => c.winnerSide === 0;

/* ═══ PARTICIPANTES ═══════════════════════════════════════════════ */
/** Todas las cuentas que salen en una lista de amistosos. */
const accountIds = (ms: DbCasual[]) =>
  ms.flatMap((m) => [...m.userIdsA, ...m.userIdsB]).filter((id): id is string => !!id);

/** Perfiles públicos de los participantes con cuenta. Si falla, los nombres
 *  se pintan igual, sin enlace. */
function usePeople(ms: DbCasual[]) {
  const ids = [...new Set(accountIds(ms))].sort();
  const { data } = useAsync(
    () => fetchPublicPeople(ids).catch(() => new Map<string, PublicPerson>()),
    [ids.join(",")],
    ids.length > 0
  );
  return data ?? new Map<string, PublicPerson>();
}

interface Participant {
  name: string;
  userId: string | null;
}

const sideParticipants = (c: DbCasual, side: 0 | 1): Participant[] =>
  (side === 0 ? c.sideA : c.sideB).map((name, i) => ({
    name,
    userId: (side === 0 ? c.userIdsA : c.userIdsB)[i] ?? null,
  }));

/** Nombres de un lado, «A · B», con enlace a la ficha pública de quien tiene
 *  nombre de usuario. */
function SideNames({
  people,
  list,
}: {
  people: Map<string, PublicPerson>;
  list: Participant[];
}) {
  if (list.length === 0) return <>—</>;
  return (
    <>
      {list.map((p, i) => {
        const prof = p.userId ? people.get(p.userId) : undefined;
        return (
          <span key={i}>
            {i > 0 && " · "}
            {prof?.username ? (
              <Link href={profileHref(prof.id)} className="link-action" style={{ fontSize: "inherit" }}>
                {p.name}
              </Link>
            ) : (
              p.name
            )}
          </span>
        );
      })}
    </>
  );
}

/** Bloque de un lado en el detalle: avatar, nombre, @usuario y «Tú». */
function SideBlock({
  title,
  list,
  people,
  me,
  winner,
}: {
  title: string;
  list: Participant[];
  people: Map<string, PublicPerson>;
  me: string | undefined;
  winner: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px 4px",
          fontSize: 12.5,
          color: "var(--text-muted)",
        }}
      >
        {title}
        {winner && (
          <Chip tone="accent" plain>
            Ganadores
          </Chip>
        )}
      </div>
      {list.length === 0 ? (
        <div style={{ padding: "8px 18px 14px", fontSize: 13, color: "var(--text-faint)" }}>
          Sin jugadores apuntados
        </div>
      ) : (
        list.map((p, i) => {
          const prof = p.userId ? people.get(p.userId) : undefined;
          const isMe = !!me && p.userId === me;
          const sub = prof?.username
            ? `@${prof.username}`
            : p.userId
              ? "Con cuenta en TACTIUM"
              : "Sin cuenta";
          const right = isMe ? (
            <Chip tone="mute" plain>
              Tú
            </Chip>
          ) : undefined;
          const icon = (
            <Avatar
              initials={initialsOf(prof?.fullName || p.name)}
              src={prof?.avatarUrl ?? null}
              size={36}
            />
          );
          return prof?.username ? (
            <ListRow
              key={i}
              href={profileHref(prof.id)}
              icon={icon}
              title={p.name}
              sub={sub}
              right={right}
            />
          ) : (
            <ListRow key={i} icon={icon} title={p.name} sub={sub} right={right} />
          );
        })
      )}
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "··";

/* ═══ LISTA DE AMISTOSOS ══════════════════════════════════════════ */
export function CasualList() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchCasualMatches(50),
    [user?.id],
    !!user
  );
  const matches = data ?? [];
  const people = usePeople(matches);

  if (loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      <PageHeader
        title="Amistosos"
        lede="Los partidos que apuntas fuera de la liga: amistosos, entrenos y torneos."
        meta={[`${matches.length} ${matches.length === 1 ? "partido" : "partidos"}`]}
        actions={
          <BtnLink href="/amistosos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Registrar amistoso
          </BtnLink>
        }
      />

      {error ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="No se pudieron cargar los amistosos"
            body={error}
          />
        </Card>
      ) : matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Sin partidos todavía"
            body="Registra tu primer amistoso y empieza a acumular números."
            action={
              <BtnLink href="/amistosos/nuevo" variant="accent" size="sm">
                Registrar un amistoso
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <Card flush>
          <CardHead title="Partidos" count={matches.length} />
          <Table minWidth={620}>
            <thead>
              <tr>
                <th>Partido</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th className="num">Resultado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {matches.map((c) => {
                const decided = c.winnerSide !== null;
                const won = wonByUs(c);
                return (
                  <tr key={c.id}>
                    <td>
                      {/* Los nombres enlazan a su ficha pública; el partido,
                          con «Ver» al final de la fila. */}
                      <span
                        className="cell-main truncate"
                        style={{ display: "block", maxWidth: 280 }}
                      >
                        <SideNames people={people} list={sideParticipants(c, 0)} />
                      </span>
                      <span className="cell-sub truncate" style={{ display: "block", maxWidth: 280 }}>
                        vs <SideNames people={people} list={sideParticipants(c, 1)} />
                      </span>
                    </td>
                    <td className="cell-muted">{TYPE_LABEL[c.type] ?? c.type}</td>
                    <td className="cell-muted">{formatDate(c.playedOn)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>
                      {formatSets(c.sets) || "—"}
                    </td>
                    <td>
                      <div className="tw-table-actions">
                        {c.photoUrl && <Chip tone="mute">Foto</Chip>}
                        {decided ? (
                          <Chip tone={won ? "accent" : "error"}>
                            {won ? "Victoria" : "Derrota"}
                          </Chip>
                        ) : (
                          <Chip tone="mute">Sin resultado</Chip>
                        )}
                        <Link
                          href={`/amistosos/${c.id}`}
                          className="link-action"
                          aria-label={`Ver el partido del ${formatDate(c.playedOn) || "amistoso"}`}
                        >
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ═══ DETALLE DE AMISTOSO ═════════════════════════════════════════
   Rediseño bloque «Partido» (2026-10): marcador con la cabecera de la liga,
   sets en tabla, kudos, cara a cara en una barra (como la app,
   `fetchCasualH2H`) y el código solo si alguien no tiene cuenta. */
export function CasualDetail({ id }: { id: string }) {
  const { user } = useSession();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: c, loading, error } = useAsync(() => fetchCasualDetail(id), [id, user?.id], !!user);
  const { data: h2h } = useAsync(
    () => fetchCasualH2H(user!.id, id).catch(() => null),
    [id, user?.id],
    !!user,
  );
  const asDb: DbCasual[] = c
    ? [
        {
          id: c.id,
          type: c.type as DbCasual["type"],
          playedOn: c.playedOn,
          sets: c.sets,
          winnerSide: c.winnerSide,
          claimCode: c.claimCode,
          photoUrl: c.photoUrl,
          sideA: c.participants.filter((p) => p.side === 0).map((p) => p.name),
          sideB: c.participants.filter((p) => p.side === 1).map((p) => p.name),
          userIdsA: c.participants.filter((p) => p.side === 0).map((p) => p.user_id),
          userIdsB: c.participants.filter((p) => p.side === 1).map((p) => p.user_id),
        },
      ]
    : [];
  const people = usePeople(asDb);

  if (loading) return <SkeletonPage />;
  if (error || !c) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Partido no encontrado"
            body={error ?? "Puede que no sea público o que se haya borrado."}
          />
        </Card>
      </div>
    );
  }

  // Todo desde MI lado (no siempre es el 0).
  const mySide: 0 | 1 = (c.participants.find((p) => p.user_id === user?.id)?.side ?? 0) === 1 ? 1 : 0;
  const otherSide: 0 | 1 = mySide === 0 ? 1 : 0;
  const names = (side: number) =>
    c.participants
      .filter((p) => p.side === side)
      .map((p) => p.name)
      .filter(Boolean)
      .join(" / ") || (side === mySide ? "Nosotros" : "Rival");
  const sets: SetScore[] = c.sets.map(([a, b]) => (mySide === 0 ? { us: a, them: b } : { us: b, them: a }));
  const u = sets.filter((s) => (s.us ?? 0) > (s.them ?? 0)).length;
  const t = sets.filter((s) => (s.them ?? 0) > (s.us ?? 0)).length;
  const decided = c.winnerSide !== null;
  const won = decided && c.winnerSide === mySide;
  const unclaimed = c.participants.filter((p) => !p.user_id && p.name.trim());
  const isMine = !!user && c.createdBy === user.id;
  const pair = h2h?.pair ?? null;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        back={{ href: "/amistosos", label: "Amistosos" }}
        title={TYPE_LABEL[c.type] ?? c.type}
        meta={[formatDate(c.playedOn) || null].filter(Boolean) as string[]}
      />

      <MatchScoreboard
        left={names(mySide)}
        right={names(otherSide)}
        crests={false}
        us={u}
        them={t}
        status={decided ? (won ? "Victoria" : "Derrota") : "Sin decidir"}
        tone={decided ? (won ? "accent" : "error") : "text"}
        photoUrl={c.photoUrl}
      />

      {sets.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <SetsTable sets={sets} usLabel={names(mySide)} themLabel={names(otherSide)} />
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <KudosButton
          kind="casual"
          targetId={c.id}
          targetUserId={c.createdBy && c.createdBy !== user?.id ? c.createdBy : null}
          userId={user?.id ?? null}
          onError={setToast}
        />
      </div>

      {(pair || (h2h && h2h.individuals.length > 0)) && (
        <Card flush style={{ marginTop: 16 }}>
          <CardHead
            title="Cara a cara"
            count={pair ? `${pair.total} ${pair.total === 1 ? "partido" : "partidos"}` : undefined}
          />
          {pair && (
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", gap: 10 }}>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
                  {pair.wins}
                </span>
                <span
                  role="img"
                  aria-label={`${pair.wins} ganados y ${pair.losses} perdidos`}
                  style={{ height: 8, borderRadius: 4, background: "color-mix(in srgb, var(--error) 45%, transparent)", overflow: "hidden" }}
                >
                  <span style={{ display: "block", height: "100%", width: `${Math.round((pair.wins / pair.total) * 100)}%`, background: "var(--accent)" }} />
                </span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--error)" }}>
                  {pair.losses}
                </span>
              </div>
            </div>
          )}
          {h2h?.individuals.map((iv) => (
            <ListRow
              key={iv.user_id ?? iv.name}
              icon={<Avatar initials={initialsOf(iv.name)} size={32} />}
              title={`Contra ${iv.name}`}
              sub={`${iv.wins} ${iv.wins === 1 ? "ganado" : "ganados"} · ${iv.losses} ${iv.losses === 1 ? "perdido" : "perdidos"}`}
            />
          ))}
        </Card>
      )}

      <Card flush style={{ marginTop: 16 }}>
        <CardHead title="Jugadores" count={c.participants.length || undefined} />
        <div className="tw-club-grid" style={{ gap: 0 }}>
          <SideBlock title="Tu pareja" list={sideParticipants(asDb[0], mySide)} people={people} me={user?.id} winner={won} />
          <SideBlock title="Rivales" list={sideParticipants(asDb[0], otherSide)} people={people} me={user?.id} winner={decided && !won} />
        </div>
      </Card>

      {isMine && unclaimed.length > 0 && c.claimCode && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 14px",
            borderRadius: "var(--r-md)",
            border: "1px dashed var(--line-strong)",
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", flex: "1 1 220px" }}>
            {unclaimed.length === 1
              ? `${unclaimed[0].name} aún no tiene TACTIUM: con este código, el partido contará en sus estadísticas.`
              : `${unclaimed.length} jugadores aún no tienen TACTIUM: con este código, el partido contará en sus estadísticas.`}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.16em" }}>
              {c.claimCode}
            </span>
            <Btn
              size="sm"
              icon={<IconCopy size={15} />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(c.claimCode!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  /* se puede copiar a mano */
                }
              }}
            >
              {copied ? "Copiado" : "Copiar"}
            </Btn>
          </span>
        </div>
      )}

      {toast && <Toast tone="warning" title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══ REGISTRAR AMISTOSO ══════════════════════════════════════════
   Rediseño bloque «Partido» (2026-10; espejo de AmistosoScreen): la pista
   con cuatro huecos, la ventana de habituales y plantilla, la botonera de
   juegos y el modo Equipos (capitán/club). Guarda de verdad con la RPC
   `create_casual_match` (antes la web no guardaba). */
type Mode = "colegas" | "entreno" | "equipos";
type SlotKey = "a1" | "a2" | "b1" | "b2";
interface Partido {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  sets: SetScore[];
}
const emptyPartido = (): Partido => ({ a1: "", a2: "", b1: "", b2: "", sets: emptySets() });
const ourStr = (p: Partido) => [p.a1, p.a2].filter(Boolean).join(" / ");
const rivalStr = (p: Partido) => [p.b1, p.b2].filter(Boolean).join(" / ");
const numericSets = (sets: SetScore[]): [number, number][] =>
  sets.filter((s) => s.us !== null && s.them !== null).map((s) => [s.us as number, s.them as number]);

function CourtSlotsWeb({
  p,
  meFirst,
  top,
  bottom,
  linked,
  onPick,
}: {
  p: Partido;
  meFirst: boolean;
  top: string;
  bottom: string;
  linked: (name: string) => boolean;
  onPick: (k: SlotKey) => void;
}) {
  const reduce = useReducedMotion();
  const slot = (k: SlotKey, ph: string) => {
    const name = p[k].trim();
    const me = meFirst && k === "a1";
    return (
      <motion.button
        key={`${k}-${name}`}
        type="button"
        onClick={() => onPick(k)}
        initial={name && !reduce ? { rotateY: 90 } : false}
        animate={{ rotateY: 0 }}
        transition={{ duration: 0.3 }}
        aria-label={name ? `${me ? "Tú" : name}, cambiar` : `${ph}: elegir jugador`}
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 4,
          padding: "12px 8px",
          borderRadius: 12,
          background: "var(--bg-card)",
          border: `1px ${name ? "solid" : "dashed"} ${name ? "var(--line-strong)" : "var(--accent-40)"}`,
          color: "var(--text)",
          cursor: "pointer",
          font: "inherit",
          minWidth: 0,
        }}
      >
        <Avatar initials={name ? initialsOf(name) : "+"} size={34} style={me ? { boxShadow: "0 0 0 1.5px var(--accent)" } : undefined} />
        <span className="truncate" style={{ maxWidth: "100%", fontSize: 13.5, fontWeight: 700 }}>
          {me ? "Tú" : name || ph}
        </span>
        <span style={{ fontSize: 12, color: name && linked(name) && !me ? "var(--accent)" : "var(--text-faint)" }}>
          {me ? name : !name ? "Toca para elegir" : linked(name) ? "En TACTIUM" : "Sin cuenta"}
        </span>
      </motion.button>
    );
  };
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        display: "grid",
        gap: 8,
        background: "linear-gradient(180deg, var(--accent-10), var(--bg-card-2))",
        border: "1px solid var(--line-strong)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{top}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        {slot("a1", meFirst ? "Tú" : "Jugador 1")}
        {slot("a2", meFirst ? "Tu pareja" : "Jugador 2")}
      </div>
      <div aria-hidden="true" style={{ borderTop: "2px dashed var(--text-faint)", opacity: 0.6 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
        {slot("b1", "Rival 1")}
        {slot("b2", "Rival 2")}
      </div>
      <span style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "right" }}>{bottom}</span>
    </div>
  );
}

function Confetti({ run }: { run: boolean }) {
  const reduce = useReducedMotion();
  if (!run || reduce) return null;
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 60 }}>
      {Array.from({ length: 22 }, (_, i) => (
        <motion.span
          key={i}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 520, opacity: 0, rotate: (i % 2 ? 1 : -1) * 300, x: ((i * 37) % 80) - 40 }}
          transition={{ duration: 1.5, delay: (i % 7) * 0.04, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: 0,
            left: `${(i + 0.5) * (100 / 22)}%`,
            width: 8,
            height: 5,
            borderRadius: 2,
            background: i % 3 === 0 ? "var(--text)" : "var(--accent)",
          }}
        />
      ))}
    </div>
  );
}

export function NewCasual() {
  const { user, activeTeam, role } = useSession();
  const team = activeTeam;
  const isPlayer = role === "jugador" || role === "suelto";
  const [mode, setMode] = useState<Mode>(!team ? "colegas" : isPlayer ? "colegas" : "equipos");
  const isEntreno = mode === "entreno";
  const isEquipos = mode === "equipos";
  const isSingle = !isEquipos;

  const { data: roster } = useAsync(() => fetchPlayers(team!.id).catch(() => []), [team?.id], !!team);
  const { data: recent } = useAsync(
    () => fetchFrequentPartners(user!.id).catch(() => [] as FrequentPartner[]),
    [user?.id],
    !!user,
  );
  const players = useMemo(() => roster ?? [], [roster]);
  const partners = useMemo(() => recent ?? [], [recent]);
  const myName = user ? user.username?.trim() || user.name : null;

  const [rivalTeam, setRivalTeam] = useState("");
  const [partidos, setPartidos] = useState<Partido[]>([emptyPartido()]);
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [picking, setPicking] = useState<{ i: number; key: SlotKey } | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ ids: string[]; code: string | null } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Tu nombre va en el primer hueco (y se vincula a tu cuenta siempre).
  useEffect(() => {
    if (!myName || isEquipos) return;
    setPartidos((prev) => (prev[0] && !prev[0].a1 ? prev.map((p, i) => (i === 0 ? { ...p, a1: myName } : p)) : prev));
  }, [myName, isEquipos]);

  const idByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const fp of partners) if (fp.user_id) m.set(fp.name.trim().toLowerCase(), fp.user_id);
    for (const pl of players) {
      if (!pl.userId) continue;
      m.set(pl.name.trim().toLowerCase(), pl.userId);
      if (pl.alias) m.set(pl.alias.trim().toLowerCase(), pl.userId);
    }
    return m;
  }, [partners, players]);
  const linkByName = (name: string): string | null => {
    const k = name.trim().toLowerCase();
    if (!k) return null;
    if (user && myName && k === myName.trim().toLowerCase()) return user.id;
    return idByName.get(k) ?? null;
  };

  const update = (i: number, patch: Partial<Partido>) =>
    setPartidos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const valid = partidos.filter((p) => numericSets(p.sets).length > 0);
  const missing = (() => {
    if (isSingle) {
      const p = partidos[0];
      if (!p.a2.trim()) return isEntreno ? "Falta un jugador de la pareja A" : "Falta tu pareja";
      if (!p.b1.trim() || !p.b2.trim()) return !p.b1.trim() && !p.b2.trim() ? "Faltan los rivales" : "Falta un rival";
    }
    if (valid.length === 0) return "Falta el resultado";
    return null;
  })();

  const marcador = (() => {
    if (partidos.length === 1) {
      const s = summarize(partidos[0].sets);
      return { us: s.usSets, them: s.themSets };
    }
    let us = 0;
    let them = 0;
    for (const p of partidos) {
      const s = summarize(p.sets);
      if (s.usSets === s.themSets) continue;
      if (s.won) us++;
      else them++;
    }
    return { us, them };
  })();

  async function save() {
    if (missing) return;
    setSaving(true);
    const res = await guardedWrite("guardar el amistoso", async () => {
      const ids: string[] = [];
      for (const p of valid) {
        ids.push(
          await createCasualMatch({
            type: isEntreno ? "entreno" : "amistoso",
            sets: numericSets(p.sets),
            participants: [
              { side: 0, slot: 0, name: p.a1.trim() || team?.name || "Nosotros", user_id: !isEquipos && user ? user.id : linkByName(p.a1) },
              { side: 0, slot: 1, name: p.a2.trim(), user_id: linkByName(p.a2) },
              { side: 1, slot: 0, name: p.b1.trim() || rivalTeam || "Rival", user_id: isEntreno ? linkByName(p.b1) : null },
              { side: 1, slot: 1, name: p.b2.trim(), user_id: isEntreno ? linkByName(p.b2) : null },
            ],
          }),
        );
      }
      const code = ids.length === 1 ? await fetchClaimCode(ids[0]).catch(() => null) : null;
      return { ids, code };
    });
    setSaving(false);
    if (res.ok) setSaved(res.data);
    else setMsg(res.reason);
  }

  const unlinked = (() => {
    const out: string[] = [];
    for (const p of partidos)
      for (const n of [p.a1, p.a2, p.b1, p.b2]) {
        const name = n.trim();
        if (!name || (myName && name.toLowerCase() === myName.toLowerCase()) || linkByName(name)) continue;
        if (!out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
      }
    return out;
  })();

  const solo = valid.length === 1 ? valid[0] : null;
  const soloSum = solo ? summarize(solo.sets) : null;
  const won = soloSum ? soloSum.won : marcador.us > marcador.them;
  const decided = soloSum ? soloSum.usSets !== soloSum.themSets : marcador.us !== marcador.them;
  const title = solo ? ourStr(solo) || "Nosotros" : team?.name ?? "Nosotros";
  const away = solo ? rivalStr(solo) || "Rival" : rivalTeam || "Rival";
  const shareText = [
    `🎾 TACTIUM · ${isEntreno ? "Entreno" : "Amistoso"}`,
    `${title} ${solo ? setsLine(solo.sets) : `${marcador.us}–${marcador.them}`} vs ${away}`,
    "",
    saved?.code
      ? `Este partido ya vive en TACTIUM. Con el código ${saved.code} lo sumas a tus stats.`
      : "Organiza tus amistosos con TACTIUM: victorias, rachas y cara a cara.",
    SITE_URL,
  ].join("\n");

  async function share(text: string) {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setMsg("Copiado: pégalo donde quieras");
      }
    } catch {
      /* cancelado */
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !saved || !user) return;
    setPhoto(URL.createObjectURL(file));
    const res = await guardedWrite("subir la foto", () => uploadCasualPhoto(user.id, saved.ids[0], file));
    if (!res.ok) setMsg(res.reason);
  }

  /* ── Tarjeta del guardado ─────────────────────────────────────── */
  if (saved) {
    return (
      <div className="tw-page-narrow">
        <PageHeader back={{ href: "/amistosos", label: "Amistosos" }} title="Amistoso guardado" />
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.26 }}>
          <div
            className="card"
            style={{
              height: 220,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 4,
              backgroundImage: `linear-gradient(180deg, rgba(3,15,15,.1), rgba(3,15,15,.92)), ${
                photo ? `url(${photo})` : "linear-gradient(135deg, #1d5a4c, #0b2a27 60%, #2a4a3a)"
              }`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              color: "#e8f5ef",
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>
              {isEntreno ? "Entreno" : "Amistoso"} · {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>
              {title}{" "}
              <span className="mono" style={{ color: "#00df82" }}>
                {solo ? setsLine(solo.sets) : `${marcador.us}–${marcador.them}`}
              </span>
            </span>
            <span style={{ fontSize: 13.5, opacity: 0.8 }}>
              vs {away}
              {decided ? ` · ${won ? "Victoria" : "Derrota"}` : ""}
            </span>
          </div>
        </motion.div>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          <Btn variant="accent" block onClick={() => void share(shareText)}>
            Compartir resultado
          </Btn>
          <label className="btn btn-ghost btn-block" style={{ cursor: "pointer" }}>
            <IconUpload size={15} />
            {photo ? "Cambiar foto" : "Añadir foto del partido"}
            <input type="file" accept="image/*" hidden onChange={(e) => void onPhoto(e.target.files?.[0])} />
          </label>
          {unlinked.length > 0 && (
            <button
              type="button"
              onClick={() =>
                void share(
                  [
                    `🎾 ${unlinked.slice(0, 3).join(", ")}: he registrado nuestro partido en TACTIUM.`,
                    `Entra y tus partidos contarán en tus estadísticas: ${SITE_URL}`,
                    ...(saved.code ? [`Canjea este código en Perfil › Mi récord: ${saved.code}`] : []),
                  ].join("\n"),
                )
              }
              style={{
                textAlign: "left",
                padding: 14,
                borderRadius: "var(--r-md)",
                background: "var(--accent-10)",
                border: "1px solid var(--accent-40)",
                color: "var(--text)",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                {unlinked.length === 1 ? `Invita a ${unlinked[0]}` : `Invita a ${unlinked.length} jugadores`}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
                {unlinked.length === 1 ? "No tiene TACTIUM." : "No tienen TACTIUM."}
                {saved.code ? ` Con el código ${saved.code}, el partido contará en sus estadísticas.` : ""}
              </span>
            </button>
          )}
          <BtnLink href={`/amistosos/${saved.ids[0]}`} variant="quiet" block>
            Ver el partido
          </BtnLink>
        </div>
        <Confetti run={decided && won} />
        {msg && <Toast tone="warning" title={msg} onClose={() => setMsg(null)} />}
      </div>
    );
  }

  /* ── Formulario ─────────────────────────────────────────────────── */
  const target = picking ? partidos[picking.i] : null;
  const pickIsMe = !!picking && isSingle && picking.i === 0 && picking.key === "a1";
  const taken = new Set(
    target && picking
      ? (["a1", "a2", "b1", "b2"] as SlotKey[])
          .filter((k) => k !== picking.key)
          .map((k) => target[k].trim().toLowerCase())
          .filter(Boolean)
      : [],
  );
  const ql = q.trim().toLowerCase();
  const habituales = isEntreno
    ? []
    : partners.filter((fp) => !taken.has(fp.name.toLowerCase()) && (!ql || fp.name.toLowerCase().includes(ql)) && fp.name !== myName);
  const plantilla = players.filter(
    (pl) => (isEquipos || pl.userId !== user?.id) && !taken.has(pl.name.toLowerCase()) && (!ql || pl.name.toLowerCase().includes(ql)),
  );
  const choose = (name: string) => {
    if (!picking) return;
    update(picking.i, { [picking.key]: name.trim() } as Partial<Partido>);
    setPicking(null);
    setQ("");
  };
  const court = (p: Partido, i: number) => (
    <CourtSlotsWeb
      p={p}
      meFirst={isSingle && i === 0}
      top={isEntreno ? "Pareja A" : mode === "colegas" ? "Tu pareja" : "Nuestra pareja"}
      bottom={isEntreno ? "Pareja B" : "Rivales"}
      linked={(n) => !!linkByName(n)}
      onPick={(key) => {
        setQ(isSingle && i === 0 && key === "a1" ? p.a1 : "");
        setPicking({ i, key });
      }}
    />
  );
  const editor = (p: Partido, i: number) => (
    <SetsEditor
      sets={p.sets}
      usLabel={isEntreno ? "Pareja A" : "Nosotros"}
      themLabel={isEntreno ? "Pareja B" : "Rivales"}
      onChange={(si, side, v) =>
        setPartidos((prev) =>
          prev.map((pp, idx) => (idx !== i ? pp : { ...pp, sets: pp.sets.map((s, j) => (j === si ? { ...s, [side]: v } : s)) })),
        )
      }
    />
  );

  return (
    <div className="tw-page-narrow">
      <PageHeader
        back={{ href: "/amistosos", label: "Amistosos" }}
        title={isEquipos ? "¿Contra qué equipo?" : isEntreno ? "¿Quién ha jugado?" : "¿Con quién has jugado?"}
        lede={team ? "Cuenta como amistoso · no afecta a ninguna liga." : "Se guarda con su marcador y suma en tus estadísticas."}
      />

      {team && (
        <Segmented<Mode>
          label="Tipo de partido"
          value={mode}
          onChange={(m) => {
            setMode(m);
            if (m !== "equipos") {
              setPartidos((prev) => [prev[0] ?? emptyPartido()]);
              setOpenIdx(0);
            }
          }}
          options={[
            { value: "colegas", label: "Colegas" },
            { value: "entreno", label: "Entreno" },
            ...(isPlayer ? [] : [{ value: "equipos" as Mode, label: "Equipos" }]),
          ]}
          style={{ marginBottom: 16 }}
        />
      )}

      {isSingle ? (
        <div style={{ display: "grid", gap: 12 }}>
          {court(partidos[0], 0)}
          {editor(partidos[0], 0)}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <Field label="Equipo rival" htmlFor="casual-rival-team">
            <Input id="casual-rival-team" value={rivalTeam} onChange={(e) => setRivalTeam(e.target.value)} placeholder="Club Bezana" />
          </Field>
          <MatchScoreboard
            left={team?.name ?? "Nosotros"}
            right={rivalTeam || "Rival"}
            us={marcador.us}
            them={marcador.them}
            status="Partidos"
            tone={marcador.us > marcador.them ? "accent" : "text"}
          />
          {partidos.map((p, i) => {
            const s = summarize(p.sets);
            const open = openIdx === i;
            return (
              <div key={i} style={{ display: "grid", gap: 8 }}>
                <MatchRow
                  badge={String(i + 1)}
                  title={ourStr(p) || "Elige la pareja"}
                  sub={setsLine(p.sets) || "Sin resultado"}
                  right={s.decided ? (s.won ? "Ganado" : "Perdido") : open ? "Cerrar" : "Apuntar ›"}
                  tone={s.decided ? (s.won ? "win" : "loss") : "todo"}
                  onClick={() => setOpenIdx(open ? null : i)}
                />
                {open && (
                  <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: "var(--r-md)", border: "1px solid var(--line)", background: "var(--bg-raised)" }}>
                    {court(p, i)}
                    {editor(p, i)}
                    {partidos.length > 1 && (
                      <Btn
                        size="sm"
                        variant="danger-ghost"
                        onClick={() => {
                          setPartidos((prev) => prev.filter((_, idx) => idx !== i));
                          setOpenIdx(null);
                        }}
                      >
                        Quitar partido
                      </Btn>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {partidos.length < 5 && (
            <Btn
              variant="ghost"
              icon={<IconPlus size={15} />}
              onClick={() => {
                setPartidos((prev) => [...prev, emptyPartido()]);
                setOpenIdx(partidos.length);
              }}
            >
              Añadir partido · hasta 5
            </Btn>
          )}
        </div>
      )}

      {!WRITES_ENABLED && (
        <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginTop: 16 }}>
          {READ_ONLY_MESSAGE}
        </Note>
      )}

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <BtnLink href="/amistosos">Cancelar</BtnLink>
        <Btn variant="accent" disabled={!!missing || saving} onClick={() => void save()}>
          {saving ? "Guardando…" : missing ?? (isEquipos && valid.length > 1 ? `Guardar ${valid.length} partidos` : "Guardar amistoso")}
        </Btn>
      </div>

      <Modal
        open={!!picking}
        onClose={() => setPicking(null)}
        labelledBy="elegir-jugador"
        title={pickIsMe ? "Tu nombre en el partido" : "Elige a alguien"}
        lede={pickIsMe ? "Cuenta en tus estadísticas aunque uses un apodo." : "Al elegir de la lista, el nombre es exacto y cuenta en sus estadísticas."}
        footer={<Btn onClick={() => setPicking(null)}>Cancelar</Btn>}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) choose(q);
          }}
          placeholder={pickIsMe ? "Tu nombre o apodo" : "Escribe un nombre…"}
          aria-label="Nombre"
          autoFocus
        />
        <div style={{ marginTop: 10, display: "grid" }}>
          {q.trim() && (
            <ListRow
              onClick={() => choose(q)}
              icon={<Avatar initials={initialsOf(q)} size={32} />}
              title={`Usar «${q.trim()}»`}
              sub={linkByName(q) ? "En TACTIUM · cuenta en sus estadísticas" : "Sin cuenta: podrás invitarle al guardar"}
            />
          )}
          {!pickIsMe && habituales.length > 0 && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", margin: "10px 0 4px" }}>Habituales</div>
          )}
          {!pickIsMe &&
            habituales.slice(0, 8).map((fp) => (
              <ListRow
                key={`fp-${fp.name}`}
                onClick={() => choose(fp.name)}
                icon={<Avatar initials={initialsOf(fp.name)} size={32} />}
                title={fp.name}
                sub={`${fp.times} ${fp.times === 1 ? "partido contigo" : "partidos contigo"} · ${fp.user_id ? "en TACTIUM" : "sin cuenta"}`}
              />
            ))}
          {!pickIsMe && plantilla.length > 0 && (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", margin: "10px 0 4px" }}>Tu equipo</div>
          )}
          {!pickIsMe &&
            plantilla.slice(0, 20).map((pl) => (
              <ListRow
                key={pl.id}
                onClick={() => choose(pl.alias?.trim() || pl.name)}
                icon={<Avatar initials={initialsOf(pl.name)} src={pl.photoUrl} size={32} />}
                title={pl.alias?.trim() || pl.name}
                sub={`${team?.name ?? ""} · ${pl.pts} pts${pl.userId ? " · en TACTIUM" : ""}`}
              />
            ))}
          {!pickIsMe && target && picking && target[picking.key].trim() && (
            <Btn size="sm" variant="danger-ghost" style={{ marginTop: 10, justifySelf: "start" }} onClick={() => choose("")}>
              Vaciar este hueco
            </Btn>
          )}
        </div>
      </Modal>

      {msg && <Toast tone="warning" title={msg} onClose={() => setMsg(null)} />}
    </div>
  );
}
