"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {
  closeMatchday,
  countAvail,
  deleteMatchday,
  fetchAvailabilityDetail,
  fetchMatchdayBundle,
  fetchMatchdayFcpContext,
  fetchSeasons,
  type DbMatchday,
  type DbPlayer,
  type FcpStanding,
  type MatchdayBundle,
} from "@/lib/queries";
import { removeMatchPhoto, updateMatchdaySchedule, uploadMatchPhoto } from "@/lib/matchday-ops";
import { useSession } from "@/lib/session";
import { useMatchdayTeam } from "@/lib/use-matchday-team";
import { renderShareCard, shareOrDownload, type ShareCardInput } from "@/lib/share-card";
import { SITE_URL } from "@/lib/site";
import { useAsync } from "@/lib/use-async";
import { useDismiss } from "@/lib/use-dismiss";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Eyebrow,
  Field,
  IconTile,
  Input,
  ListRow,
  Modal,
  Note,
  Segmented,
  tabPanelProps,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, Skeleton, SkeletonPage, Toast } from "@/components/states";
import {
  IconAlert,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconFlag,
  IconHome,
  IconLock,
  IconPlane,
  IconShare,
  IconTrash,
  IconUpload,
  IconUsers,
} from "@/components/Icon";

/**
 * Jornada — datos reales.
 *
 * Cabecera tipo marcador (nosotros · cuenta atrás o resultado · rival) y el
 * contenido repartido en pestañas por fase: Previa · Alineación · Resultado
 * · Fotos. La pestaña inicial depende del estado de la jornada.
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

type Tab = "previa" | "alineacion" | "resultado" | "fotos";
const TABS: Tab[] = ["previa", "alineacion", "resultado", "fotos"];

/** Pestaña de la URL (`?tab=`), o null si no hay o no vale. */
function tabFromUrl(): Tab | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("tab");
  return t && (TABS as string[]).includes(t) ? (t as Tab) : null;
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

/** «sáb 12 oct» para el antetítulo. */
function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "")
    .replace(",", "");
}

/** «12/01» a partir de una fecha ISO. */
function formatDayMonth(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** Cuenta atrás hasta el partido (como la app): «Hoy» / «Mañana» con la hora
 *  debajo, o «2 d / 4 h» para el partido. */
function countdown(
  date: string | null,
  time: string | null,
  now: number,
): { big: string; small: string } {
  if (!date) return { big: "—", small: "Fecha por confirmar" };
  const hhmm = time ? time.slice(0, 5) : null;
  const target = new Date(`${date}T${hhmm ?? "00:00"}:00`);
  if (Number.isNaN(target.getTime())) return { big: "—", small: "Fecha por confirmar" };
  const today = new Date(now);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(target) - startOf(today)) / 86_400_000);
  const ms = target.getTime() - now;
  if (dayDiff === 0) return { big: "Hoy", small: hhmm ?? "Hora por confirmar" };
  if (dayDiff === 1 && ms < 86_400_000) return { big: "Mañana", small: hhmm ?? "Hora por confirmar" };
  const totalH = Math.max(0, Math.floor(ms / 3_600_000));
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return { big: d === 0 ? `${h} h` : `${d} d / ${h} h`, small: "Para el partido" };
}

/** ¿Ha llegado la hora del partido? (sin hora, cuenta desde las 00:00). */
function isMatchStarted(date: string | null, time: string | null, now: number): boolean {
  if (!date) return false;
  const t = new Date(`${date}T${time ?? "00:00:00"}`);
  return !Number.isNaN(t.getTime()) && now >= t.getTime();
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÀ-ÿ0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const shortName = (p: DbPlayer | null) => (p ? p.name.split(" ")[0] : null);

/** Veredicto de una pista a partir de sus sets o del W.O. */
function verdict(r: CourtRow): "win" | "lose" | "none" {
  if (r.forfeit) return r.forfeitUs ? "win" : "lose";
  const u = r.sets.filter(([a, b]) => a > b).length;
  const t = r.sets.filter(([a, b]) => b > a).length;
  if (u === 0 && t === 0) return "none";
  return u > t ? "win" : "lose";
}

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/* ── Lado del marcador: escudo, nombre, racha y puesto ─────────── */
function TeamSide({
  name,
  standing,
  label,
}: {
  name: string;
  standing: FcpStanding | null;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        textAlign: "center",
      }}
    >
      <Avatar initials={initialsOf(name)} size={52} />
      <div
        className="truncate"
        title={name}
        style={{ maxWidth: "100%", fontSize: 15, fontWeight: 700, color: "var(--text)" }}
      >
        {name}
      </div>
      {standing && standing.form.length > 0 && (
        <div
          role="img"
          aria-label={`${label}: racha ${standing.form.map((f) => (f === "V" ? "victoria" : "derrota")).join(", ")}`}
          style={{ display: "flex", gap: 4 }}
        >
          {standing.form.map((f, i) => (
            <span
              key={i}
              title={f === "V" ? "Victoria" : "Derrota"}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: f === "V" ? "var(--accent)" : "var(--error)",
              }}
            />
          ))}
        </div>
      )}
      {standing && (
        <div className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {standing.posicion}º · {standing.puntos} pts
        </div>
      )}
    </div>
  );
}

/* ── Compartir resultado: vista previa + compartir / copiar ─────── */
const SUCCESS_TOASTS = new Set([
  "Acta cerrada",
  "Foto guardada",
  "Foto quitada",
  "Fecha actualizada",
  "Imagen descargada",
  "Texto copiado",
]);

const OUTCOME_LABEL = { win: "Victoria", lose: "Derrota", draw: "Empate" } as const;

function ShareResultCard({
  input,
  text,
  filename,
  onToast,
}: {
  input: ShareCardInput;
  text: string;
  filename: string;
  onToast: (msg: string) => void;
}) {
  const key = JSON.stringify(input);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // La imagen se genera al abrir la pestaña: así, al pulsar «Compartir», el
  // fichero ya existe y `navigator.share` se llama dentro del gesto del
  // usuario (Safari rechaza compartir si antes hay esperas largas).
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    setBlob(null);
    setFailed(false);
    renderShareCard(JSON.parse(key) as ShareCardInput)
      .then((b) => {
        if (!alive) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreview(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const b = blob ?? (await renderShareCard(input));
      const r = await shareOrDownload(b, filename, text);
      if (r === "downloaded") onToast("Imagen descargada");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "No se pudo generar la imagen");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      onToast("Texto copiado");
    } catch {
      onToast("No se pudo copiar el texto");
    }
  }

  return (
    <Card flush>
      <CardHead
        title="Compartir resultado"
        sub="Imagen con el marcador por pistas, lista para redes y WhatsApp"
      />
      <div className="card-body">
        <div
          style={{
            aspectRatio: "4 / 5",
            maxWidth: 360,
            margin: "0 auto",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--line)",
            overflow: "hidden",
            background: "var(--bg-card-2)",
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`Vista previa: ${input.ourName} ${input.scoreUs}–${input.scoreThem} ${input.opponent}`}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : failed ? (
            <div
              style={{
                height: "100%",
                display: "grid",
                placeItems: "center",
                padding: 16,
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              No se pudo preparar la vista previa. Puedes compartir igualmente.
            </div>
          ) : (
            <Skeleton h={420} />
          )}
        </div>
      </div>
      <div className="card-foot" style={{ flexWrap: "wrap" }}>
        <Btn variant="accent" onClick={() => void share()} disabled={busy} icon={<IconShare size={15} />}>
          {busy ? "Preparando…" : "Compartir resultado"}
        </Btn>
        <Btn variant="ghost" onClick={() => void copy()} icon={<IconCopy size={15} />}>
          Copiar texto
        </Btn>
      </div>
    </Card>
  );
}

export function MatchdayView({ id }: { id: string }) {
  const { role } = useSession();
  // El equipo es el de la jornada, no el activo: el club entra desde su
  // panel en jornadas de cualquiera de sus equipos. Si no se puede leer, el
  // activo, como antes. La capitanía también es la de ESE equipo.
  const owner = useMatchdayTeam(id);
  const teamId = owner.teamId;
  const teamCaptain = role === "capitan" && owner.isTeamCaptain;
  const isCaptain = teamCaptain || role === "club";
  const router = useRouter();
  const pathname = usePathname();

  const { data, loading, error } = useAsync<MatchdayBundle | null>(
    () => fetchMatchdayBundle(id, teamId!),
    [id, teamId],
    !!teamId
  );

  // Contexto federativo (puesto, racha, último cruce). Si falla o no hay
  // vínculo, la cabecera se pinta sin esos datos: nunca bloquea la jornada.
  const opponent = data?.matchday.opponent ?? null;
  const fcp = useAsync(
    () =>
      fetchMatchdayFcpContext(teamId!, opponent!, data?.matchday.date ?? null).catch(
        () => null
      ),
    [teamId, opponent, data?.matchday.date],
    !!teamId && !!opponent
  );

  // Temporada: su nombre va al pie del marcador y, si está cerrada, no se
  // puede eliminar la jornada.
  const seasons = useAsync(() => fetchSeasons(teamId!).catch(() => []), [teamId], !!teamId);

  // Convocatoria: respuestas con estado (va / duda / no).
  const avail = useAsync(
    () => fetchAvailabilityDetail(id).catch(() => ({})),
    [id],
    !!teamId
  );

  const [rows, setRows] = useState<CourtRow[]>([]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [woFor, setWoFor] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<Tab | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useDismiss(menuOpen, () => setMenuOpen(false));
  const [now, setNow] = useState(() => Date.now());
  // Cambios guardados desde esta pantalla (foto, fecha y hora): se aplican
  // encima de lo cargado para no tener que recargar toda la jornada.
  const [patch, setPatch] = useState<Partial<DbMatchday>>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [confirmPhotoRemove, setConfirmPhotoRemove] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editSchedule, setEditSchedule] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedSaving, setSchedSaving] = useState(false);

  // La pestaña va en la URL (`?tab=`): se puede enlazar, recargar y volver
  // atrás sin perderla. Sin parámetro, la que toque según el momento.
  useEffect(() => {
    setTab(tabFromUrl());
    setPatch({});
  }, [id]);
  function selectTab(t: Tab) {
    setTab(t);
    const q = new URLSearchParams(window.location.search);
    q.set("tab", t);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

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

  if (owner.loading) return <SkeletonPage />;
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

  const m: DbMatchday = { ...data.matchday, ...patch };
  const closed = m.status === "finished";
  const filled = rows.filter((r) => verdict(r) !== "none").length;
  const allIn = rows.length > 0 && filled === rows.length;
  const pairsSet = rows.filter((r) => r.pair[0] && r.pair[1]).length;
  const started = m.status === "in_progress" || isMatchStarted(m.date, m.time, now);
  // Marcador grande solo con algo que contar: acta cerrada o empezado con
  // alguna pista resuelta. Empezado sin pistas → «En juego».
  const hasResult = closed || (started && filled > 0);
  const season = (seasons.data ?? []).find((s) => s.id === m.seasonId) ?? null;
  const seasonClosed = season ? !season.active : false;
  const canDelete = isCaptain && !closed && !seasonClosed;

  const defaultTab: Tab = closed || started ? "resultado" : rows.length > 0 ? "alineacion" : "previa";
  const curTab = tab ?? defaultTab;

  const scoreUs = closed ? (m.scoreFor ?? totals.us) : totals.us;
  const scoreThem = closed ? (m.scoreAgainst ?? totals.them) : totals.them;

  const outcome =
    totals.us > totals.them ? "win" : totals.us < totals.them ? "lose" : "draw";
  const closedOutcome =
    m.outcome === "win" ? "win" : m.outcome === "loss" ? "lose" : m.outcome === "draw" ? "draw" : outcome;
  const tone =
    (closed ? closedOutcome : outcome) === "win"
      ? { chip: "accent" as const, stat: "accent" as const, l: "Ganada" }
      : (closed ? closedOutcome : outcome) === "lose"
        ? { chip: "error" as const, stat: "error" as const, l: "Perdida" }
        : { chip: "warning" as const, stat: "warning" as const, l: "Empate" };

  const ctx = fcp.data ?? null;
  const ourName = owner.teamName ?? "Mi equipo";

  // Convocatoria sobre la plantilla activa.
  const activeIds = data.players.filter((p) => p.active !== false).map((p) => p.id);
  const conv = countAvail(activeIds, avail.data ?? {});

  const eyebrow = [
    `Jornada ${String(m.round).padStart(2, "0")}`,
    formatShortDate(m.date),
    m.time ? m.time.slice(0, 5) : null,
    m.isHome ? "Local" : "Visitante",
  ]
    .filter(Boolean)
    .join(" · ");

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

  /* ── Foto del partido (capitán/club, acta cerrada, como en la app) ── */
  const canEditPhoto = isCaptain && closed;

  async function onPickPhoto(file: File | undefined) {
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file || photoBusy || !teamId) return;
    const tid = teamId;
    setPhotoBusy(true);
    const res = await guardedWrite("guardar la foto del partido", () =>
      uploadMatchPhoto(tid, m.id, file)
    );
    setPhotoBusy(false);
    if (!res.ok) {
      setToast(res.reason);
      return;
    }
    setPatch((p) => ({ ...p, photoUrl: res.data }));
    setToast("Foto guardada");
  }

  async function onRemovePhoto() {
    if (photoBusy || !teamId) return;
    const tid = teamId;
    setPhotoBusy(true);
    const res = await guardedWrite("quitar la foto del partido", () => removeMatchPhoto(tid, m.id));
    setPhotoBusy(false);
    setConfirmPhotoRemove(false);
    if (!res.ok) {
      setToast(res.reason);
      return;
    }
    setPatch((p) => ({ ...p, photoUrl: null }));
    setToast("Foto quitada");
  }

  /* ── Fecha y hora (capitán/club, jornada sin cerrar) ─────────────── */
  const canEditSchedule = isCaptain && !closed && !seasonClosed;

  function openSchedule() {
    setSchedDate(m.date ?? "");
    setSchedTime(m.time ? m.time.slice(0, 5) : "");
    setEditSchedule(true);
  }

  async function saveSchedule() {
    if (schedSaving) return;
    setSchedSaving(true);
    const date = schedDate || null;
    const time = schedTime || null;
    const res = await guardedWrite("cambiar la fecha de la jornada", () =>
      updateMatchdaySchedule(m.id, { date, time })
    );
    setSchedSaving(false);
    setEditSchedule(false);
    if (!res.ok) {
      setToast(res.reason);
      return;
    }
    setPatch((p) => ({ ...p, date, time: time ? `${time}:00` : null }));
    setToast("Fecha actualizada");
  }

  /* ── Compartir resultado ───────────────────────────────────────── */
  const shareOutcome = closed ? closedOutcome : outcome;
  const shareSubtitle = [`Jornada ${m.round}`, m.date ? formatDate(m.date) : null]
    .filter(Boolean)
    .join(" · ");
  const courtScore = (r: CourtRow): string => {
    if (r.forfeit) return "W.O.";
    const played = r.sets.filter(([a, b]) => a + b > 0);
    return played.length ? played.map(([a, b]) => `${a}-${b}`).join(" ") : "—";
  };
  const courtPair = (r: CourtRow) =>
    r.pair[0] && r.pair[1] ? `${shortName(r.pair[0])} · ${shortName(r.pair[1])}` : "Sin pareja";
  const shareInput: ShareCardInput = {
    ourName,
    opponent: m.opponent,
    scoreUs,
    scoreThem,
    outcome: shareOutcome,
    subtitle: shareSubtitle,
    season: season?.name ?? null,
    photoUrl: m.photoUrl,
    courts: rows.map((r) => {
      const v = verdict(r);
      return {
        court: r.court,
        pair: courtPair(r),
        score: courtScore(r),
        won: v === "none" ? null : v === "win",
      };
    }),
  };
  const shareText = [
    `TACTIUM · ${shareSubtitle}`,
    `${ourName} ${scoreUs} – ${scoreThem} ${m.opponent} (${OUTCOME_LABEL[shareOutcome]})`,
    ...rows.map((r) => `P${r.court} ${courtPair(r)}: ${courtScore(r)}`),
    season ? season.name : null,
    "",
    `Sigue a tu equipo en TACTIUM: ${SITE_URL}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  /* ── Bloques de cada pestaña ──────────────────────────────────── */

  const lastMeetingCard = (
    <Card flush>
      <CardHead title="Último cruce">
        {ctx && (
          <Link
            href={`/federacion/${ctx.fed}/grupo/${encodeURIComponent(ctx.idGrupo)}`}
            className="link-action"
          >
            Ver grupo
          </Link>
        )}
      </CardHead>
      <div className="card-body">
        {fcp.loading ? (
          <Skeleton h={44} />
        ) : !ctx ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            Vincula el equipo con la Federación para ver el historial contra este rival.
          </p>
        ) : !ctx.lastMeeting ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            {ctx.them
              ? "No os habéis enfrentado todavía en este grupo."
              : "No encontramos a este rival en vuestro grupo de la Federación."}
          </p>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span
              className="mono"
              style={{
                fontSize: 22,
                fontWeight: 700,
                color:
                  ctx.lastMeeting.won == null
                    ? "var(--text)"
                    : ctx.lastMeeting.won
                      ? "var(--accent)"
                      : "var(--error)",
              }}
            >
              {ctx.lastMeeting.us != null && ctx.lastMeeting.them != null
                ? `${ctx.lastMeeting.us}–${ctx.lastMeeting.them}`
                : "—"}
            </span>
            {ctx.lastMeeting.won != null && (
              <Chip tone={ctx.lastMeeting.won ? "accent" : "error"}>
                {ctx.lastMeeting.won ? "Victoria" : "Derrota"}
              </Chip>
            )}
            <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {[
                ctx.lastMeeting.jornada != null ? `J${ctx.lastMeeting.jornada}` : null,
                formatDayMonth(ctx.lastMeeting.fecha),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        )}
      </div>
    </Card>
  );

  const convParts = [
    `${conv.yes} ${conv.yes === 1 ? "va" : "van"}`,
    `${conv.maybe} duda`,
    conv.no > 0 ? `${conv.no} no` : null,
    `${conv.pending} sin contestar`,
  ].filter(Boolean);

  const convocatoriaCard = (
    <Card flush>
      <CardHead title="Convocatoria" count={activeIds.length || undefined} />
      {avail.loading ? (
        <div className="card-body">
          <Skeleton h={36} />
        </div>
      ) : (
        <ListRow
          href={`/jornada/${m.id}/disponibilidad`}
          icon={
            <IconTile mute small>
              <IconUsers size={15} />
            </IconTile>
          }
          title={convParts.join(" · ")}
          sub="Disponibilidad de la plantilla"
        />
      )}
    </Card>
  );

  const sedeCard = (
    <Card flush>
      <CardHead title="Sede">
        {canEditSchedule && (
          <button type="button" className="link-action" onClick={openSchedule}>
            Cambiar fecha
          </button>
        )}
      </CardHead>
      <div className="card-body">
        <dl className="kv" style={{ margin: 0 }}>
          <dt>Fecha</dt>
          <dd>{m.date ? formatDate(m.date) : "—"}</dd>
          <dt>Hora</dt>
          <dd className="mono">{m.time?.slice(0, 5) ?? "—"}</dd>
          <dt>Lugar</dt>
          <dd>{m.location ?? "—"}</dd>
          <dt>Dónde se juega</dt>
          <dd style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {m.isHome ? <IconHome size={14} /> : <IconPlane size={14} />}
            {m.isHome ? "En nuestras pistas" : "Fuera de casa"}
          </dd>
          {m.tandas ? (
            <>
              <dt>Tandas</dt>
              <dd className="mono">{m.tandas}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </Card>
  );

  const lineupCard = (
    <Card flush>
      <CardHead title="Alineación" count={rows.length ? `${pairsSet}/${Math.max(rows.length, 5)}` : undefined}>
        <Link href={`/jornada/${m.id}/alineacion`} className="link-action">
          {closed ? "Ver" : "Editar"}
        </Link>
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
      </div>
    </Card>
  );

  const scoreCard = (
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
  );

  const photoCard = (
    <Card flush>
      <CardHead title="Foto del partido" />
      <div className="card-body">
        {m.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.photoUrl}
            alt={`Foto de la jornada ${m.round} contra ${m.opponent}`}
            style={{
              display: "block",
              width: "100%",
              maxHeight: 520,
              objectFit: "cover",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
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
            {canEditPhoto
              ? "Sube la foto del partido: la verá todo el equipo y saldrá de fondo al compartir."
              : "Sin foto todavía"}
          </div>
        )}
      </div>
      {canEditPhoto && (
        <div className="card-foot" style={{ flexWrap: "wrap" }}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onPickPhoto(e.target.files?.[0])}
          />
          <Btn
            variant="ghost"
            icon={<IconCamera size={15} />}
            disabled={photoBusy}
            onClick={() => photoInputRef.current?.click()}
          >
            {photoBusy ? "Guardando…" : m.photoUrl ? "Cambiar foto" : "Subir foto"}
          </Btn>
          {m.photoUrl && (
            <Btn
              variant="danger-ghost"
              icon={<IconTrash size={15} />}
              disabled={photoBusy}
              onClick={() => setConfirmPhotoRemove(true)}
            >
              Quitar foto
            </Btn>
          )}
        </div>
      )}
    </Card>
  );

  const twoCols: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: 16,
    alignItems: "start",
  };

  return (
    <div className="tw-page">
      {/* ── Barra superior: volver + acciones ─────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <Link href={`/temporadas/${m.seasonId}`} className="tw-back" style={{ marginBottom: 0 }}>
          <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
          Temporada
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* La acción principal depende del rol y del momento:
              · capitán antes de empezar → editar la alineación;
              · capitán con la jornada en juego → resultados y acta;
              · jugador con la jornada en juego → su resultado;
              · el resto (jugador antes, club, acta cerrada) → ver la alineación. */}
          {teamCaptain && !closed && started ? (
            <>
              <Btn
                variant="accent"
                icon={<IconFlag size={15} />}
                onClick={() => selectTab("resultado")}
              >
                Meter resultados
              </Btn>
              <Btn icon={<IconCheck size={15} />} onClick={() => setConfirmClose(true)}>
                Cerrar acta
              </Btn>
              <BtnLink href={`/jornada/${m.id}/alineacion`} variant="quiet" icon={<IconUsers size={15} />}>
                Alineación
              </BtnLink>
            </>
          ) : teamCaptain && !closed ? (
            <BtnLink href={`/jornada/${m.id}/alineacion`} variant="accent" icon={<IconUsers size={15} />}>
              Editar alineación
            </BtnLink>
          ) : !teamCaptain && role !== "club" && !closed && started ? (
            <>
              <BtnLink href={`/jornada/${m.id}/resultados`} variant="accent" icon={<IconFlag size={15} />}>
                Meter mi resultado
              </BtnLink>
              <BtnLink href={`/jornada/${m.id}/alineacion`} variant="ghost" icon={<IconUsers size={15} />}>
                Ver alineación
              </BtnLink>
            </>
          ) : (
            <BtnLink href={`/jornada/${m.id}/alineacion`} variant="ghost" icon={<IconUsers size={15} />}>
              Ver alineación
            </BtnLink>
          )}
          {canDelete && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <Btn
                variant="quiet"
                aria-label="Más acciones"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, letterSpacing: 1 }}>
                  ⋯
                </span>
              </Btn>
              {menuOpen && (
                <div
                  className="tw-popover"
                  role="menu"
                  style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 220, padding: 6 }}
                >
                  {canEditSchedule && (
                    <button
                      type="button"
                      role="menuitem"
                      className="tw-popitem"
                      onClick={() => {
                        setMenuOpen(false);
                        openSchedule();
                      }}
                    >
                      <IconClock size={15} />
                      Cambiar fecha y hora
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="tw-popitem"
                    style={{ color: "var(--error)" }}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    <IconTrash size={15} />
                    Eliminar jornada
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Cabecera marcador ─────────────────────────────────────── */}
      <Card style={{ marginBottom: 16, padding: "18px 18px 20px" }}>
        <h1 style={visuallyHidden}>
          Jornada {m.round} contra {m.opponent}
        </h1>
        <Eyebrow style={{ textAlign: "center", marginBottom: 16 }}>{eyebrow}</Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
            alignItems: "center",
            gap: 12,
          }}
        >
          <TeamSide
            name={ourName}
            standing={ctx?.us ?? null}
            label={ourName}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              minWidth: 96,
            }}
          >
            {hasResult ? (
              <span
                className="mono"
                aria-label={`Marcador ${scoreUs} a ${scoreThem}`}
                style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: "var(--text)" }}
              >
                {scoreUs}–{scoreThem}
              </span>
            ) : started ? (
              <>
                <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: "var(--warning)" }}>
                  En juego
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin resultados aún</span>
              </>
            ) : (
              <>
                <span
                  className="mono"
                  style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: "var(--text)", textAlign: "center", whiteSpace: "nowrap" }}
                >
                  {countdown(m.date, m.time, now).big}
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {countdown(m.date, m.time, now).small}
                </span>
              </>
            )}
            <Chip tone={closed ? tone.chip : started ? "warning" : "mute"}>
              {closed ? tone.l : started ? "En juego" : "Pendiente"}
            </Chip>
          </div>

          <TeamSide name={m.opponent} standing={ctx?.them ?? null} label={m.opponent} />
        </div>
        {season && (
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
            {season.name}
          </div>
        )}
      </Card>

      {/* ── Pestañas por fase ─────────────────────────────────────── */}
      <div style={{ marginBottom: 16, overflowX: "auto" }}>
        <Segmented<Tab>
          as="tabs"
          idPrefix="jornada"
          label="Fase de la jornada"
          value={curTab}
          onChange={selectTab}
          options={[
            { value: "previa", label: "Previa" },
            { value: "alineacion", label: "Alineación" },
            { value: "resultado", label: "Resultado" },
            { value: "fotos", label: "Fotos" },
          ]}
        />
      </div>

      <div {...tabPanelProps("jornada", curTab)} style={{ outline: "none" }}>
      {curTab === "previa" && (
        <div style={twoCols}>
          {lastMeetingCard}
          {convocatoriaCard}
          {sedeCard}
        </div>
      )}

      {curTab === "alineacion" && (
        <div style={twoCols}>
          {lineupCard}
          {convocatoriaCard}
        </div>
      )}

      {curTab === "resultado" && (
        <>
          <StatRow compact style={{ marginBottom: 16 }}>
            <Stat
              label="Pistas"
              value={`${scoreUs}–${scoreThem}`}
              tone={closed ? tone.stat : undefined}
              sub={
                closed
                  ? `Acta cerrada · ${tone.l.toLowerCase()}`
                  : allIn
                    ? "Todas las pistas con resultado"
                    : `${filled} de ${rows.length} con resultado`
              }
            />
            <Stat label="Juegos a favor" value={totals.gf} />
            <Stat label="Juegos del rival" value={totals.ga} />
          </StatRow>
          {scoreCard}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <BtnLink href={`/jornada/${m.id}/resultados`} variant="ghost" icon={<IconFlag size={15} />}>
              Meter el resultado de mi partido
            </BtnLink>
          </div>
        </>
      )}

      {curTab === "fotos" &&
        (closed ? (
          <div style={twoCols}>
            {photoCard}
            <ShareResultCard
              input={shareInput}
              text={shareText}
              filename={`tactium-jornada-${m.round}.png`}
              onToast={setToast}
            />
          </div>
        ) : (
          <Note icon={<IconCamera size={16} />}>
            La foto del partido se ve aquí cuando el acta está cerrada.
          </Note>
        ))}
      </div>

      {/* ── Eliminar jornada ─────────────────────────────────────── */}
      <Modal
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        labelledBy="eliminar-jornada-titulo"
        width={440}
        title="¿Eliminar la jornada?"
        lede="Eliminar la jornada borra alineación, disponibilidad y resultados."
        footer={
          <>
            <Btn onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancelar
            </Btn>
            <Btn variant="danger" onClick={() => void removeMatchday()} disabled={deleting}>
              {deleting ? "Eliminando…" : "Sí, eliminar"}
            </Btn>
          </>
        }
      >
        {!WRITES_ENABLED ? <Note tone="warning">{READ_ONLY_MESSAGE}</Note> : null}
      </Modal>

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

      {/* ── Fecha y hora ─────────────────────────────────────────── */}
      <Modal
        open={editSchedule}
        onClose={() => !schedSaving && setEditSchedule(false)}
        labelledBy="fecha-jornada-titulo"
        width={440}
        title="Fecha y hora de la jornada"
        lede="Déjalas en blanco si aún están por confirmar."
        footer={
          <>
            <Btn onClick={() => setEditSchedule(false)} disabled={schedSaving}>
              Cancelar
            </Btn>
            <Btn variant="accent" onClick={() => void saveSchedule()} disabled={schedSaving}>
              {schedSaving ? "Guardando…" : "Guardar"}
            </Btn>
          </>
        }
      >
        <div className="tw-form-grid">
          <Field label="Fecha" htmlFor="jornada-fecha">
            <Input
              id="jornada-fecha"
              type="date"
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
            />
          </Field>
          <Field label="Hora" htmlFor="jornada-hora">
            <Input
              id="jornada-hora"
              type="time"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
            />
          </Field>
        </div>
        {!WRITES_ENABLED ? (
          <Note tone="warning" style={{ marginTop: 12 }}>
            {READ_ONLY_MESSAGE}
          </Note>
        ) : null}
      </Modal>

      {/* ── Quitar foto ──────────────────────────────────────────── */}
      <Modal
        open={confirmPhotoRemove}
        onClose={() => !photoBusy && setConfirmPhotoRemove(false)}
        labelledBy="quitar-foto-titulo"
        width={420}
        title="¿Quitar la foto del partido?"
        lede="Dejará de verse en la jornada y en lo que compartáis a partir de ahora."
        footer={
          <>
            <Btn onClick={() => setConfirmPhotoRemove(false)} disabled={photoBusy}>
              Cancelar
            </Btn>
            <Btn variant="danger" onClick={() => void onRemovePhoto()} disabled={photoBusy}>
              {photoBusy ? "Quitando…" : "Quitar foto"}
            </Btn>
          </>
        }
      >
        {!WRITES_ENABLED ? <Note tone="warning">{READ_ONLY_MESSAGE}</Note> : null}
      </Modal>

      {toast && (
        <Toast
          tone={SUCCESS_TOASTS.has(toast) ? "success" : "warning"}
          title={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
