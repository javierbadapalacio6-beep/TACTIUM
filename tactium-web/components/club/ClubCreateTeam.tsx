"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { createInvitation, createTeam, fetchClub } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  COMPETITION_PRESETS,
  FCP_FEDERATION_CODE,
  TEAM_CATEGORIES,
  TEAM_GENDERS,
  TEAM_GROUPS,
} from "@/lib/federations";
import { copyText, inviteMessage, inviteUrl, whatsappShareUrl } from "@/lib/invite";
import { Btn, BtnLink, Card, Field, Input, ListRow, Note } from "@/components/ui";
import { SkeletonPage } from "@/components/states";
import { IconChevronDown, IconCopy, IconFlag, IconShare } from "@/components/Icon";
import { Crest } from "@/components/Crest";
import { StepProgress } from "@/components/entry/motion-bits";

/** Botón "tarjeta" de elección única (categoría, género, grupo). */
function Cell({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      style={{
        minWidth: 52,
        minHeight: 38,
        padding: "0 12px",
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        fontSize: 14,
        fontWeight: on ? 700 : 500,
        color: on ? "var(--accent)" : "var(--text)",
        background: on ? "var(--accent-10)" : "var(--bg-card-2)",
        border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
        flex: "none",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Alta de equipo DESDE el club (rediseño 2026-10), los mismos 2 pasos que la
 * app:
 *  1. «¿Ya juega en la Liga Cántabra?» (importación del club que ya existe) o
 *     a mano: nombre, categoría y género; lo raro, plegado en «Más ajustes».
 *     La federación se hereda del club.
 *  2. Lo que de verdad falta: un capitán. Código de un solo uso para enviarlo,
 *     o «Lo capitaneo yo» (el club ya es capitán de sus equipos).
 */
export function ClubCreateTeam() {
  const { clubId } = useSession();
  const reduce = useReducedMotion();
  const club = useAsync(() => fetchClub(clubId!), [clubId], !!clubId);

  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [gender, setGender] = useState("");
  const [more, setMore] = useState(false);
  const [comp, setComp] = useState("snp");
  const [league, setLeague] = useState("");
  const [hasGroup, setHasGroup] = useState(false);
  const [group, setGroup] = useState("A");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const federation = club.data?.federation ?? null;
  const isFcp = federation === FCP_FEDERATION_CODE;

  useEffect(() => {
    if (!created) return;
    let alive = true;
    guardedWrite("crear el código de capitán", () => createInvitation(created.id, "captain")).then(
      (res) => {
        if (!alive) return;
        if (res.ok) setCode(res.data.code);
        else setCodeErr(res.reason);
      },
    );
    return () => {
      alive = false;
    };
  }, [created]);

  if (!clubId || club.loading) return <SkeletonPage />;

  const preset = COMPETITION_PRESETS.find((p) => p.id === comp) ?? COMPETITION_PRESETS[1];
  const valid = name.trim().length >= 2 && !!cat && !!gender && (!hasGroup || !!group);

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    setErr(null);
    // Con federación en el club, el equipo la hereda; sin ella, la liga sale
    // del tipo de competición (SNP por defecto, como en la app).
    const res = await guardedWrite("crear el equipo", () =>
      createTeam({
        name: name.trim(),
        gender,
        federation: federation,
        league: federation ? league.trim() || null : (preset.leagueValue ?? (league.trim() || null)),
        category: cat,
        group: hasGroup ? group : null,
        clubId: clubId ?? undefined,
      }),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    setCreated({ id: res.data, name: name.trim() });
  }

  if (created) {
    return (
      <div className="tw-page-narrow">
        <StepProgress
          step={2}
          aside={
            <Link href={`/club/equipos/${created.id}`} className="link-action">
              Lo haré luego
            </Link>
          }
        />
        <div style={{ textAlign: "center" }}>
          <motion.div
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 14, duration: 0.5 }}
            style={{ display: "inline-flex", marginTop: 8 }}
          >
            <Crest size={72} />
          </motion.div>
          <h1 style={{ marginTop: 16 }}>{created.name}, creado</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
            Ahora, ¿quién lo capitanea?
          </p>
        </div>

        <Card style={{ marginTop: 20, textAlign: "center" }}>
          {code ? (
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.18em" }}>
              {code}
            </div>
          ) : codeErr ? (
            <Note tone="error">{codeErr}</Note>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Generando el código…</div>
          )}
          <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--text-faint)" }}>
            Código de capitán · un solo uso
          </div>
          {code && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
              <a
                className="btn btn-accent"
                href={whatsappShareUrl(inviteMessage(created.name, code, "captain"))}
                target="_blank"
                rel="noreferrer"
              >
                <IconShare size={15} />
                Enviar al capitán por WhatsApp
              </a>
              <Btn
                icon={<IconCopy size={15} />}
                onClick={async () => {
                  const ok = await copyText(inviteUrl(code));
                  setCopied(ok);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? "Copiado" : "Copiar enlace"}
              </Btn>
            </div>
          )}
        </Card>

        <Card flush style={{ marginTop: 16 }}>
          <ListRow
            href={`/club/equipos/${created.id}`}
            title="Lo capitaneo yo"
            sub="El club ya te hace capitán de sus equipos"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="tw-page-narrow">
      <StepProgress
        step={1}
        aside={
          <Link href="/club/equipos" className="link-action">
            Cancelar
          </Link>
        }
      />
      <h1>Nuevo equipo del club</h1>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
        Pertenecerá a {club.data?.name ?? "tu club"}. En el siguiente paso le pones capitán.
      </p>

      {isFcp && (
        <>
          <Card flush style={{ marginTop: 18, borderColor: "var(--accent-40)" }}>
            <ListRow
              href="/club/importar"
              icon={<IconFlag size={16} />}
              title="¿Ya juega en la Liga Cántabra?"
              sub="Búscalo y rellenamos categoría, grupo y género."
            />
          </Card>
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
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />o a mano
            <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>
        </>
      )}

      <div style={{ display: "grid", gap: 16, marginTop: isFcp ? 0 : 18 }}>
        <Field label="Nombre" htmlFor="eq-nombre">
          <Input
            id="eq-nombre"
            type="text"
            placeholder="Smash Femenino"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Categoría">
          <div role="radiogroup" aria-label="Categoría" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {TEAM_CATEGORIES.map((v) => (
              <Cell key={v} label={v} on={cat === v} onClick={() => setCat(v)} />
            ))}
          </div>
        </Field>
        <Field label="Género">
          <div role="radiogroup" aria-label="Género" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TEAM_GENDERS.map((g) => (
              <Cell key={g.id} label={g.label} on={gender === g.id} onClick={() => setGender(g.id)} />
            ))}
          </div>
        </Field>

        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="list-row"
          style={{
            width: "100%",
            border: "1px solid var(--line)",
            borderRadius: 10,
            background: "var(--bg-card-2)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span className="list-row-main">
            <span className="list-row-title">Más ajustes</span>
            <span className="list-row-sub">Liga, grupo y formato de la competición</span>
          </span>
          <IconChevronDown
            size={16}
            style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform var(--dur-base) var(--ease)" }}
          />
        </button>

        {more && (
          <div style={{ display: "grid", gap: 16 }}>
            {!federation && (
              <Field label="Competición" hint={preset.blurb}>
                <div role="radiogroup" aria-label="Competición" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COMPETITION_PRESETS.filter((p) => p.id !== "federada").map((p) => (
                    <Cell key={p.id} label={p.label} on={comp === p.id} onClick={() => setComp(p.id)} />
                  ))}
                </div>
              </Field>
            )}
            {(federation || comp === "personalizada") && (
              <Field label="Nombre de la liga · opcional" htmlFor="eq-liga">
                <Input
                  id="eq-liga"
                  type="text"
                  placeholder={federation ? "Liga por equipos absoluta" : "Liga interempresas, liga del club…"}
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                />
              </Field>
            )}
            <Field label="Grupo">
              <div style={{ display: "flex", gap: 6, marginBottom: hasGroup ? 8 : 0 }}>
                <Cell label="Sin grupos" on={!hasGroup} onClick={() => setHasGroup(false)} />
                <Cell label="Con grupo" on={hasGroup} onClick={() => setHasGroup(true)} />
              </div>
              {hasGroup && (
                <div role="radiogroup" aria-label="Grupo" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TEAM_GROUPS.map((g) => (
                    <Cell key={g} label={g} on={group === g} onClick={() => setGroup(g)} />
                  ))}
                </div>
              )}
            </Field>
          </div>
        )}
      </div>

      {err && (
        <Note tone="error" style={{ marginTop: 16 }}>
          {err}
        </Note>
      )}
      <Btn variant="accent" size="lg" block disabled={busy || !valid} onClick={submit} style={{ marginTop: 20 }}>
        {busy ? "Creando…" : "Crear equipo"}
      </Btn>
      <div style={{ marginTop: 12, textAlign: "center" }}>
        <BtnLink href="/club/equipos" variant="quiet" size="sm">
          Volver a los equipos
        </BtnLink>
      </div>
    </div>
  );
}
