"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { supabaseBrowser } from "@/lib/supabase/client";
import {
  fetchMyTournaments,
  claimTournamentPartner,
  type MyTournament,
} from "@/lib/queries";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  Input,
  Note,
  PageHeader,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { GoogleLogo } from "@/components/GoogleLogo";
import { IconTrophy } from "@/components/Icon";

function fmtDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime())
    ? "Fecha por confirmar"
    : d.toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  open: "Inscripción abierta",
  upcoming: "Próximo",
  in_progress: "En juego",
  finished: "Finalizado",
  cancelled: "Cancelado",
  canceled: "Cancelado",
};

/** Tono del chip de estado: sólo lo vivo va en acento. */
function statusTone(status: string): "accent" | "warning" | "mute" {
  if (status === "open" || status === "in_progress") return "accent";
  if (status === "upcoming" || status === "draft") return "warning";
  return "mute";
}

export default function MisTorneosPage() {
  const [authKnown, setAuthKnown] = useState(false);
  const [logged, setLogged] = useState(false);

  const [list, setList] = useState<MyTournament[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setList(await fetchMyTournaments());
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
        if (on) load();
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

  async function claim() {
    const c = code.trim().toUpperCase();
    if (c.length < 4 || claiming) return;
    setClaiming(true);
    setClaimMsg(null);
    try {
      await claimTournamentPartner(c);
      setClaimMsg({ ok: true, text: "Vinculado. Ya está en tus torneos." });
      setCode("");
      await load();
    } catch (e) {
      setClaimMsg({
        ok: false,
        text:
          e instanceof Error
            ? e.message
            : "No se pudo vincular. Revisa el código.",
      });
    } finally {
      setClaiming(false);
    }
  }

  const login = () => {
    // redirectTo FIJADO a app.tactium.io (salvo local): una URL …vercel.app no
    // está en la allowlist de Supabase → caería al Site URL. Destino por cookie.
    const h = window.location.hostname;
    const appBase =
      h === "localhost" || h === "127.0.0.1"
        ? window.location.origin
        : "https://app.tactium.io";
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
        lede="Los torneos en los que juegas, con su cuadro y tu horario."
        actions={<BtnLink href="/torneos">Explorar torneos</BtnLink>}
      />

      {/* Vincularse con el código del compañero */}
      <Card flush style={{ marginBottom: 16 }}>
        <CardHead
          title="¿Te han apuntado?"
          sub="Si tu compañero te ha inscrito, mete su código para que el torneo aparezca también en tu cuenta."
        />
        <div className="card-body">
          <Field label="Código de la pareja" htmlFor="codigo-pareja">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Input
                id="codigo-pareja"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD-12"
                className="mono"
                style={{ flex: 1, minWidth: 160, letterSpacing: "0.12em" }}
              />
              <Btn
                variant="accent"
                disabled={claiming || code.trim().length < 4}
                onClick={claim}
              >
                {claiming ? "Vinculando…" : "Vincularme"}
              </Btn>
            </div>
          </Field>
          {claimMsg && !claimMsg.ok && (
            <Note tone="error" style={{ marginTop: 12 }}>
              {claimMsg.text}
            </Note>
          )}
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
            body="Cuando te inscribas a uno, o te vincules con un código, aparecerá aquí con su cuadro y tu horario."
            action={
              <BtnLink href="/torneos" variant="accent">
                Explorar torneos
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <Card flush>
          <CardHead title="Tus torneos" count={list.length} />
          {list.map((t) => (
            <Link key={t.id} href={`/torneos/${t.id}`} className="list-row">
              <IconTile>
                <IconTrophy size={16} />
              </IconTile>
              <span className="list-row-main">
                <span className="list-row-title truncate">{t.name}</span>
                <span className="list-row-sub">
                  {[t.club_name, t.location].filter(Boolean).join(" · ") || "Sin sede"}
                  {t.categories.length > 0 ? ` · ${t.categories.join(", ")}` : ""}
                </span>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", flex: "none" }}>
                {fmtDate(t.starts_on)}
              </span>
              <Chip tone={statusTone(t.status)}>
                {STATUS_LABEL[t.status] ?? t.status}
              </Chip>
            </Link>
          ))}
        </Card>
      )}

      {claimMsg?.ok && (
        <Toast title={claimMsg.text} onClose={() => setClaimMsg(null)} />
      )}
    </div>
  );
}
