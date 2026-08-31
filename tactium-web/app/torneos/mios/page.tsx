"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { supabaseBrowser } from "@/lib/supabase/client";
import {
  fetchMyTournaments,
  claimTournamentPartner,
  type MyTournament,
} from "@/lib/queries";
import { Card, Eyebrow } from "@/components/ui";
import { SkeletonCard } from "@/components/states";
import { GoogleLogo } from "@/components/GoogleLogo";

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
      setClaimMsg({ ok: true, text: "¡Vinculado! Ya está en tus torneos." });
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

  if (!authKnown) {
    return (
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <SkeletonCard />
      </div>
    );
  }

  if (!logged) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Card>
          <Eyebrow>MIS TORNEOS</Eyebrow>
          <p
            style={{
              margin: "14px 0 20px",
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-muted)",
            }}
          >
            Inicia sesión para ver los torneos en los que juegas y para
            vincularte con el código que te ha pasado tu compañero.
          </p>
          <button
            className="btn btn-accent"
            onClick={login}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 15,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <GoogleLogo />
            Continuar con Google
          </button>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 12,
              color: "var(--text-faint)",
              textAlign: "center",
            }}
          >
            ¿Prefieres email?{" "}
            <a href="/entrar?next=/torneos/mios" style={{ color: "var(--accent)" }}>
              Inicia sesión aquí
            </a>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      {/* Vincularse con el código del compañero */}
      <Card style={{ marginBottom: 20 }}>
        <Eyebrow>¿TE HAN APUNTADO? VINCÚLATE CON TU CÓDIGO</Eyebrow>
        <p
          style={{
            margin: "12px 0 14px",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          Si tu compañero te ha inscrito, te habrá llegado un código. Mételo aquí
          para que el torneo aparezca también en tu cuenta.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO"
            className="mono"
            style={{
              flex: 1,
              minWidth: 160,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--hair-strong)",
              background: "var(--bg-card-2)",
              color: "var(--text)",
              fontSize: 14,
              letterSpacing: "0.18em",
              outline: "none",
            }}
          />
          <button
            className="btn btn-accent"
            disabled={claiming || code.trim().length < 4}
            onClick={claim}
            style={{ padding: "12px 22px", fontSize: 14, borderRadius: 12 }}
          >
            {claiming ? "Vinculando…" : "Vincularme"}
          </button>
        </div>
        {claimMsg && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 13,
              color: claimMsg.ok ? "var(--accent)" : "var(--error)",
            }}
          >
            {claimMsg.text}
          </p>
        )}
      </Card>

      {/* Lista de mis torneos */}
      {list === null ? (
        <SkeletonCard />
      ) : loadErr ? (
        <Card>
          <p style={{ fontSize: 13.5, color: "var(--error)" }}>{loadErr}</p>
        </Card>
      ) : list.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 36 }}>
          <h2 style={{ fontSize: 20, margin: 0 }}>Aún no juegas ningún torneo</h2>
          <p
            style={{
              margin: "12px 0 20px",
              fontSize: 13.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Cuando te inscribas a un torneo (o te vincules con un código),
            aparecerá aquí con su cuadro y tu horario.
          </p>
          <Link
            href="/torneos"
            className="btn btn-accent"
            style={{ display: "inline-flex", padding: "12px 22px", fontSize: 14 }}
          >
            Explorar torneos
          </Link>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((t) => (
            <Link key={t.id} href={`/torneos/${t.id}`} style={{ textDecoration: "none" }}>
              <Card style={{ padding: 18 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        color: "var(--accent)",
                      }}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </div>
                    <div
                      style={{ marginTop: 6, fontSize: 17, fontWeight: 700, color: "var(--text)" }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="mono"
                      style={{
                        marginTop: 6,
                        fontSize: 11.5,
                        color: "var(--text-muted)",
                      }}
                    >
                      {[t.club_name, t.location].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 12, color: "var(--text)" }}>
                      {fmtDate(t.starts_on)}
                    </div>
                    {t.categories.length > 0 && (
                      <div
                        className="mono"
                        style={{ marginTop: 6, fontSize: 10.5, color: "var(--text-faint)" }}
                      >
                        {t.categories.join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
