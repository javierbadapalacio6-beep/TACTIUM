"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSession } from "@/lib/session";
import { createClub } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import {
  TOURNAMENT_EXTRA_PAIR_EUR,
  TOURNAMENT_FREE_PAIRS,
  TOURNAMENT_TIERS,
} from "@/lib/tournament-billing";
import { CLUB_PLANS } from "@/lib/plans";
import { signupHref } from "@/lib/nav";
import { INSCRIPTION_MONEY_TEXT } from "@/lib/public-copy";
import {
  Btn,
  BtnLink,
  Card,
  Field,
  IconTile,
  Input,
  Note,
  PageHeader,
  SectionHead,
} from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import {
  IconCalendar,
  IconReceipt,
  IconShield,
  IconTrophy,
  IconUsers,
} from "@/components/Icon";
import { TOURNAMENT_FORMATS } from "@/components/marketing/Tournaments";

/**
 * Organizar un torneo sin ser un club.
 *
 * Un torneo cuelga siempre de un club (es quien cobra las inscripciones y
 * pone las pistas), pero un capitán o un jugador suelto también organiza
 * torneos. La salida es la misma que en la app: crear un club en modo «solo
 * torneos» (`tournaments_only`), sin equipos ni cuota, que hace de espacio de
 * organizador. Quien ya tiene club va directo a sus torneos.
 */
export function OrganizeTournament() {
  const router = useRouter();
  const { user, ready, clubs, role, setRole, availableRoles } = useSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ready && clubs.length > 0) router.replace("/club/torneos");
  }, [ready, clubs.length, router]);

  useEffect(() => {
    if (user && !name) setName(`Torneos de ${user.name.split(" ")[0]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // El visitante no se queda en un esqueleto: ve qué es y cómo empezar.
  if (ready && !user) return <OrganizeLanding />;
  if (!ready || !user) return <SkeletonPage />;
  if (clubs.length > 0) return <SkeletonPage />;

  async function submit() {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear tu espacio de organizador", () =>
      createClub(name.trim(), null, { tournamentsOnly: true }),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    // Quien ya era capitán sigue viendo su equipo al entrar; el club de
    // torneos queda disponible en el selector de rol.
    if (role !== "club" && availableRoles.includes(role)) setRole(role);
    window.location.href = "/club/torneos";
  }

  return (
    <div className="tw-page-narrow" style={{ maxWidth: 560 }}>
      <PageHeader
        title="Organizar un torneo"
        lede="No hace falta ser un club: creamos tu espacio de organizador y desde ahí montas el cuadro, repartes el horario y publicas resultados."
        back={{ href: "/torneos", label: "Torneos" }}
      />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field
            label="Nombre del organizador"
            hint="Es lo que verán los jugadores al inscribirse. Puedes cambiarlo después."
          >
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Torneos de Javier"
              autoFocus
            />
          </Field>
          <Note tone="accent" icon={<IconTrophy size={15} />}>
            Hasta {TOURNAMENT_FREE_PAIRS} parejas por torneo es gratis; a partir de
            ahí se paga por torneo, sin suscripción. Si algún día quieres llevar
            también equipos, activas la gestión desde el panel.
          </Note>
          {err && <Note tone="error">{err}</Note>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <BtnLink href="/torneos">Cancelar</BtnLink>
            <Btn variant="accent" disabled={busy || name.trim().length < 2} onClick={submit}>
              {busy ? "Creando…" : "Crear espacio y montar torneo"}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

const STEPS = [
  {
    icon: IconTrophy,
    title: "Creas el torneo",
    body: "Nombre, fechas, sede, categorías y formato. Con tu club o sin él: si no tienes, creamos tu espacio de organizador.",
  },
  {
    icon: IconUsers,
    title: "Los jugadores se apuntan",
    body: "Con un enlace o un código, desde la web o la app. Puedes poner reglas de nivel, puntos y género por categoría.",
  },
  {
    icon: IconShield,
    title: "Cuadros y horario solos",
    body: "Al cerrar la inscripción se generan los grupos y cuadros, y el horario se reparte por pistas. Lo retocas a mano si quieres.",
  },
  {
    icon: IconCalendar,
    title: "Resultados en directo",
    body: "Metes los marcadores y el cuadro avanza. Jugadores y público lo siguen sin cuenta.",
  },
];

const gridOf = (min: number) => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
  gap: 16,
});

/**
 * /torneos/organizar para quien llega sin cuenta: página de venta. TACTIUM es
 * la herramienta; el torneo es de quien lo organiza.
 */
function OrganizeLanding() {
  const altaHref = signupHref("/torneos/organizar");
  const caps = CLUB_PLANS.filter((p) => p.tournamentPairCap != null);
  const last = TOURNAMENT_TIERS[TOURNAMENT_TIERS.length - 1];
  return (
    <div className="tw-page">
      <PageHeader
        title="Organiza tu torneo de pádel"
        lede="Inscripción online, cuadros, horario por pistas y resultados en directo. Tú pones el torneo y las pistas; TACTIUM, la herramienta. No hace falta ser un club."
        actions={
          <BtnLink href={altaHref} variant="accent">
            Crear cuenta y empezar
          </BtnLink>
        }
        back={{ href: "/torneos", label: "Torneos" }}
      />

      <SectionHead title="Cómo se monta" style={{ marginTop: 8 }} />
      <div style={gridOf(220)}>
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <Card key={title}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <IconTile>
                <Icon size={16} />
              </IconTile>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>{body}</p>
          </Card>
        ))}
      </div>

      <SectionHead title="Formatos" sub="Eliges uno por torneo." />
      <div style={gridOf(200)}>
        {TOURNAMENT_FORMATS.map((f) => (
          <Card key={f.tag}>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
              {f.tag}
            </span>
            <h3 style={{ margin: "6px 0 4px", fontSize: 15 }}>{f.name}</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>{f.desc}</p>
          </Card>
        ))}
      </div>

      <SectionHead
        title="Cuánto cuesta"
        sub="Sin suscripción. Pagas por torneo según las parejas inscritas, al cerrar la inscripción."
      />
      <Card flush>
        {TOURNAMENT_TIERS.map((t) => (
          <div key={t.pairs} className="list-row" style={{ cursor: "default" }}>
            <span className="list-row-main">
              <span className="list-row-title">Hasta {t.pairs} parejas</span>
            </span>
            <span
              className="mono"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: t.priceEur === 0 ? "var(--accent)" : "var(--text)",
              }}
            >
              {t.priceEur === 0 ? "Gratis" : `${t.priceEur} €`}
            </span>
          </div>
        ))}
        <div className="list-row" style={{ cursor: "default" }}>
          <span className="list-row-main">
            <span className="list-row-title">Más de {last.pairs} parejas</span>
          </span>
          <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
            +{TOURNAMENT_EXTRA_PAIR_EUR} € por pareja
          </span>
        </div>
      </Card>
      <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
        Si tu club tiene plan, sus torneos van incluidos hasta{" "}
        {caps.map((p) => `${p.tournamentPairCap} parejas en ${p.displayName}`).join(", ")}.{" "}
        <Link href="/pro" className="link-action">
          Ver planes
        </Link>
      </p>

      <Note tone="accent" icon={<IconReceipt size={15} />} style={{ marginTop: 16 }}>
        {INSCRIPTION_MONEY_TEXT}
      </Note>

      <Card style={{ marginTop: 24 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Tu primer torneo, gratis</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Hasta {TOURNAMENT_FREE_PAIRS} parejas no pagas nada. Crea la cuenta y lo montas en
              unos minutos.
            </p>
          </div>
          <BtnLink href={altaHref} variant="accent">
            Crear cuenta y empezar
          </BtnLink>
        </div>
      </Card>
    </div>
  );
}
