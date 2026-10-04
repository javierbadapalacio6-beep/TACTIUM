"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/client";
import { claimTournamentPartner } from "@/lib/queries";
import { formatFee } from "@/lib/tournament-signup-pricing";
import { Btn, Field, Input, Note } from "@/components/ui";
import { IconChevronRight } from "@/components/Icon";
import { LiveDot } from "@/components/tournaments/SpectatorParts";

/**
 * Piezas compartidas de la lista de torneos (/torneos, /torneos/mios y la
 * portada): grupos por estado, la tarjeta compacta de una línea y el único
 * «Tengo un código». Espejo de ExploreTournamentsScreen de la app.
 */

export interface RowTournament {
  id: string;
  name: string;
  club_name: string | null;
  location: string | null;
  starts_on: string | null;
  status: string;
  cover_url: string | null;
  genders: string[] | null;
  players: number | null;
  pair_based?: boolean | null;
  entry_fee: number | null;
  fee_currency: string | null;
}

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Igual que `tournamentBucket` de la app: con cuadro pero fecha futura = próximo. */
export function bucketOf(status: string, startsOn: string | null): "live" | "upcoming" | "finished" {
  if (status === "finished" || status === "canceled" || status === "cancelled") return "finished";
  if (status === "in_progress" && (!startsOn || startsOn <= localToday())) return "live";
  return "upcoming";
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const shortDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${d} ${MESES[m - 1]}`;
};

const STOP = new Set(["torneo", "de", "del", "la", "el", "los", "las", "y", "open", "copa", "i", "ii", "iii"]);
const abbr = (name: string) => {
  const w = name.split(/\s+/).filter(Boolean);
  return (w.find((x) => !STOP.has(x.toLowerCase())) ?? w[0] ?? "?").slice(0, 3).toUpperCase();
};

/** Agrupa por estado: lo que está pasando primero. */
export function groupTournaments<T extends RowTournament>(list: T[]) {
  const byDate = (a: T, b: T) => (a.starts_on ?? "zz").localeCompare(b.starts_on ?? "zz");
  return {
    live: list.filter((t) => bucketOf(t.status, t.starts_on) === "live"),
    open: list.filter((t) => t.status === "open").sort(byDate),
    soon: list
      .filter((t) => t.status !== "open" && bucketOf(t.status, t.starts_on) === "upcoming")
      .sort(byDate),
    done: list
      .filter((t) => bucketOf(t.status, t.starts_on) === "finished")
      .sort((a, b) => byDate(b, a)),
  };
}

/** Tarjeta compacta: miniatura con estado, nombre, datos y una línea de estado. */
export function TournamentRow({
  t,
  meta,
  line,
  tone,
  badge,
}: {
  t: RowTournament;
  /** Sustituye la línea de datos (Mis torneos: fecha · categoría · pareja). */
  meta?: string;
  /** Sustituye la línea de estado (Mis torneos: tu partido, tu pago…). */
  line?: string;
  tone?: "accent" | "warning" | "muted";
  badge?: string | null;
}) {
  const bucket = bucketOf(t.status, t.starts_on);
  const fee =
    t.entry_fee && Number(t.entry_fee) > 0
      ? `${formatFee(Number(t.entry_fee), t.fee_currency)}/pers.`
      : "Gratis";
  // Torneos por parejas: «parejas», no «jugadores» (antes salía al revés).
  const n = Number(t.players ?? 0);
  const inscritos =
    t.pair_based === false
      ? `${n} ${n === 1 ? "jugador inscrito" : "jugadores inscritos"}`
      : `${n} ${n === 1 ? "pareja inscrita" : "parejas inscritas"}`;
  const metaText =
    meta ??
    ([t.club_name, t.location, shortDate(t.starts_on), t.status === "open" ? fee : null]
      .filter(Boolean)
      .join(" · ") ||
      "Fecha por confirmar");
  const lineText =
    line ??
    (bucket === "live"
      ? "En juego"
      : t.status === "open"
        ? inscritos
        : bucket === "finished"
          ? t.status === "canceled" || t.status === "cancelled"
            ? "Cancelado"
            : "Terminado"
          : "Próximamente");
  const lineTone = tone ?? (bucket === "live" || t.status === "open" ? "accent" : "muted");
  return (
    <Link href={`/torneos/${t.id}`} className="list-row" style={{ gap: 12 }}>
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: 46,
          height: 46,
          flex: "none",
          borderRadius: 10,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          background: t.cover_url ? `center / cover no-repeat url(${t.cover_url})` : "var(--bg-card-2)",
          border: "1px solid var(--line)",
        }}
      >
        {!t.cover_url && (
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
            {abbr(t.name)}
          </span>
        )}
        {bucket === "live" && (
          <span style={{ position: "absolute", top: 4, right: 4, display: "inline-flex" }}>
            <LiveDot size={7} />
          </span>
        )}
        {badge && (
          <span
            className="mono"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              textAlign: "center",
              fontSize: 9.5,
              fontWeight: 700,
              background: "var(--warning)",
              color: "var(--text-inverse)",
            }}
          >
            {badge}
          </span>
        )}
      </span>
      <span className="list-row-main">
        <span className="list-row-title truncate">{t.name}</span>
        <span className="list-row-sub truncate">{metaText}</span>
        {lineText && (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color:
                lineTone === "accent"
                  ? "var(--accent)"
                  : lineTone === "warning"
                    ? "var(--warning)"
                    : "var(--text-faint)",
            }}
          >
            {lineText}
          </span>
        )}
      </span>
      <span className="list-row-chev">
        <IconChevronRight size={16} />
      </span>
    </Link>
  );
}

/**
 * Un solo «Tengo un código»: primero se prueba como código de TORNEO (RPC
 * `tournament_lookup`, la misma que la app) y lleva a apuntarse; si no existe,
 * como código de PAREJA (`claim_partner_by_code`), que necesita sesión.
 */
export function CodeBox({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    const v = code.trim().toUpperCase().replace(/\s/g, "");
    if (v.length < 4 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { data } = await supabaseBrowser().rpc("tournament_lookup", { p_code: v });
      const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
      if (row?.id) {
        router.push(`/torneos/${row.id}/inscripcion`);
        return;
      }
      if (!loggedIn) {
        setErr("No es el código de ningún torneo abierto. Si es el de tu pareja, inicia sesión y vuelve a meterlo.");
        return;
      }
      const tid = await claimTournamentPartner(v);
      router.push(`/torneos/${tid}`);
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
      setErr(msg ? `No encontramos ese código: ${msg}` : "No encontramos ese código. Revísalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Field
        label="Escribe el código que te han pasado"
        htmlFor="tengo-codigo"
        hint="Vale el del torneo (te lleva a apuntarte) y el de tu pareja (te une a su inscripción)."
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            id="tengo-codigo"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void go();
            }}
            placeholder="K7P2QX"
            className="mono"
            style={{ letterSpacing: "0.12em" }}
            maxLength={10}
          />
          <Btn variant="accent" disabled={busy || code.trim().length < 4} onClick={() => void go()}>
            {busy ? "Buscando…" : "Continuar"}
          </Btn>
        </div>
      </Field>
      {err && (
        <Note tone="error" style={{ marginTop: 10 }}>
          {err}
        </Note>
      )}
    </div>
  );
}
