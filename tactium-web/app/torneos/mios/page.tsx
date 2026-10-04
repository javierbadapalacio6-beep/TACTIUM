"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { supabaseBrowser } from "@/lib/supabase/client";
import {
  fetchMyTournaments,
  fetchRegsPayments,
  fetchTournamentMatches,
  fetchTournamentRegs,
  type MyTournament,
} from "@/lib/queries";
import {
  countdown,
  divShort,
  localIso,
  roundNameOf,
  summarize,
  type PMatch,
  type PReg,
} from "@/components/tournaments/SpectatorParts";
import {
  CodeBox,
  TournamentRow,
  bucketOf,
  type RowTournament,
} from "@/components/tournaments/TournamentRow";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  PageHeader,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { GoogleLogo } from "@/components/GoogleLogo";
import { IconTrophy } from "@/components/Icon";
import { canonicalOrigin } from "@/lib/site";

/** Lo tuyo en cada torneo: tu partido, tu pago o hasta dónde llegaste. */
type Digest = {
  meta: string;
  line: string;
  tone: "accent" | "warning" | "muted";
  badge: string | null;
  today: boolean;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const shortDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${d} ${MESES[m - 1]}` : null;
};

async function digestOf(t: MyTournament, uid: string): Promise<Digest | null> {
  const [mm, rr, pays] = await Promise.all([
    fetchTournamentMatches(t.id),
    fetchTournamentRegs(t.id),
    fetchRegsPayments(t.id).catch(() => ({}) as Record<string, { paymentStatus: string | null }>),
  ]);
  const matches = mm as unknown as PMatch[];
  const regs = rr as unknown as PReg[];
  const mine = regs.filter((r) => r.p1_user_id === uid || r.p2_user_id === uid);
  const me = mine[0];
  if (!me) return null;
  const ids = new Set(mine.map((r) => r.id));
  const partnerFull = me.p1_user_id === uid ? me.p2_name : me.p1_name;
  const partner = partnerFull ? partnerFull.split(/\s+/).slice(0, 2).join(" ") : null;
  const pending = mine.some((r) => (pays as Record<string, { paymentStatus: string | null }>)[r.id]?.paymentStatus === "pending_club");
  const bucket = bucketOf(t.status, t.starts_on);
  let next: PMatch | undefined;
  for (const m of matches) {
    if (m.status === "finished" || m.status === "bye" || !m.scheduled_at) continue;
    if (![m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && ids.has(x))) continue;
    if (!next || m.scheduled_at < (next.scheduled_at ?? "")) next = m;
  }
  let line: string;
  let tone: Digest["tone"] = "muted";
  if (bucket === "finished") {
    const sm = summarize(matches, ids);
    line = sm
      ? `${sm.reached} · ${sm.wins} ${sm.wins === 1 ? "victoria" : "victorias"}, ${sm.losses} ${sm.losses === 1 ? "derrota" : "derrotas"}`
      : "Terminado";
  } else if (next?.scheduled_at) {
    line = [roundNameOf(next, matches), next.court, countdown(next.scheduled_at, Date.now()).text]
      .filter(Boolean)
      .join(" · ");
    tone = "accent";
  } else if (pending) {
    line = "Pago pendiente en el club";
    tone = "warning";
  } else {
    line = matches.length ? "Inscrito · tu horario aún no está" : "Inscrito · el cuadro sale al cerrar la inscripción";
  }
  return {
    meta: [shortDate(t.starts_on), divShort(me.gender, me.category), partner ? `con ${partner}` : null]
      .filter(Boolean)
      .join(" · "),
    line,
    tone,
    badge: pending && bucket !== "finished" ? "PAGO" : null,
    today:
      bucket === "live" ||
      (!!next?.scheduled_at && localIso(new Date(next.scheduled_at)) === localIso(new Date())),
  };
}

export default function MisTorneosPage() {
  const [authKnown, setAuthKnown] = useState(false);
  const [logged, setLogged] = useState(false);

  const [list, setList] = useState<MyTournament[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [uid, setUid] = useState<string | null>(null);
  const [digests, setDigests] = useState<Record<string, Digest>>({});

  const load = useCallback(async (userId: string) => {
    setLoadErr(null);
    try {
      const l = await fetchMyTournaments();
      setList(l);
      // Cada fila dice lo tuyo; si un torneo falla, se queda con lo básico.
      const out: Record<string, Digest> = {};
      await Promise.all(
        l.slice(0, 12).map(async (t) => {
          try {
            const d = await digestOf(t, userId);
            if (d) out[t.id] = d;
          } catch {
            /* fila básica */
          }
        }),
      );
      setDigests(out);
    } catch (e) {
      setLoadErr(
        e instanceof Error ? e.message : "No se pudieron cargar tus torneos.",
      );
      setList([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        const on = !!data.user;
        setLogged(on);
        setAuthKnown(true);
        if (on && data.user) {
          setUid(data.user.id);
          load(data.user.id);
        }
      })
      .catch(() => {
        if (alive) {
          setLogged(false);
          setAuthKnown(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [load]);

  const login = () => {
    // redirectTo FIJADO al dominio canónico (salvo local): una URL …vercel.app
    // no está en la allowlist de Supabase → caería al Site URL. Destino por cookie.
    const appBase = canonicalOrigin();
    document.cookie = `tactium_next=${encodeURIComponent("/torneos/mios")}; path=/; max-age=600; samesite=lax`;
    supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appBase}/auth/callback` },
    });
  };

  if (!authKnown) return <SkeletonPage />;

  if (!logged) {
    return (
      <div className="tw-page-narrow" style={{ maxWidth: 520 }}>
        <Card flush>
          <CardHead title="Mis torneos" />
          <div className="card-body">
            <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "var(--text-muted)" }}>
              Inicia sesión para ver los torneos en los que juegas y para
              vincularte con el código que te ha pasado tu compañero.
            </p>
            <Btn variant="accent" size="lg" block onClick={login} icon={<GoogleLogo />}>
              Continuar con Google
            </Btn>
            <p
              style={{
                margin: "14px 0 0",
                fontSize: 12.5,
                color: "var(--text-faint)",
                textAlign: "center",
              }}
            >
              ¿Prefieres email?{" "}
              <Link href="/entrar?next=/torneos/mios" className="link-action">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Mis torneos"
        lede="Los torneos en los que juegas, con tu hora, tu pago y hasta dónde llegaste."
        actions={
          <>
            <BtnLink href="/torneos">Explorar torneos</BtnLink>
            <BtnLink href="/torneos/organizar" variant="accent">
              Organizar un torneo
            </BtnLink>
          </>
        }
      />

      {/* Un solo «Tengo un código»: el del torneo o el de tu pareja. */}
      <Card flush style={{ marginBottom: 16 }}>
        <CardHead title="Tengo un código" />
        <div className="card-body">
          <CodeBox loggedIn={!!uid} />
        </div>
      </Card>

      {/* Lista de mis torneos */}
      {list === null ? (
        <Card>
          <EmptyState compact title="Cargando tus torneos…" />
        </Card>
      ) : loadErr ? (
        <Card>
          <EmptyState
            icon={<IconTrophy size={22} />}
            title="No se pudieron cargar tus torneos"
            body={loadErr}
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconTrophy size={22} />}
            title="Aún no juegas ningún torneo"
            body="Si tu pareja ya te apuntó, mete su código arriba y aparecerá aquí."
            action={
              <BtnLink href="/torneos" variant="accent">
                Ver torneos abiertos
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {(() => {
            const d = new Date();
            const today = list.filter(
              (t) => bucketOf(t.status, t.starts_on) !== "finished" && digests[t.id]?.today,
            );
            const next = list
              .filter((t) => bucketOf(t.status, t.starts_on) !== "finished" && !digests[t.id]?.today)
              .sort((a, b) => (a.starts_on ?? "zz").localeCompare(b.starts_on ?? "zz"));
            const played = list
              .filter((t) => bucketOf(t.status, t.starts_on) === "finished")
              .sort((a, b) => (b.starts_on ?? "").localeCompare(a.starts_on ?? ""));
            return (
              [
                [`Hoy · ${DOW[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`, today],
                ["Próximos", next],
                ["Jugados", played],
              ] as [string, MyTournament[]][]
            )
              .filter(([, l]) => l.length > 0)
              .map(([title, l]) => (
                <Card key={title} flush>
                  <CardHead title={title} count={l.length} />
                  {l.map((t) => {
                    const dg = digests[t.id];
                    return (
                      <TournamentRow
                        key={t.id}
                        t={t as unknown as RowTournament}
                        meta={dg?.meta}
                        line={dg?.line}
                        tone={dg?.tone}
                        badge={dg?.badge}
                      />
                    );
                  })}
                </Card>
              ));
          })()}
        </div>
      )}

    </div>
  );
}
