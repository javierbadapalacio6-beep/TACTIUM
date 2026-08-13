"use client";

import { Fragment, useState } from "react";

import {
  CATEGORIES,
  GENDERS,
  MAX_BLOCKED_HOURS,
  SIGNUP_DAYS,
  SIGNUP_HOURS,
  tournamentById,
} from "@/lib/tournament-data";
import { tournamentSignup } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow } from "@/components/ui";
import { IconCheck, IconSearch } from "@/components/Icon";

const SIGNUP_GENDER_DB: Record<string, string> = {
  Masculino: "masculino",
  Femenino: "femenino",
  Mixto: "mixto",
};

/**
 * Ficha de inscripción. Es pública: se llega con el código del torneo.
 *
 * Detalle propio del producto: al escribir el nombre aparece un chip
 * "DETECTADO EN LA FEDERACIÓN" que rellena puntos y nivel de una pasada. Se
 * puede editar después — es una sugerencia, no un dato bloqueado.
 */
const FCP_HINTS: Record<string, { pts: number; level: string }> = {
  "diego ruiz": { pts: 4600, level: "1ª" },
  "marco bilbao": { pts: 4180, level: "1ª" },
  "sara león": { pts: 3900, level: "2ª" },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        display: "block",
        fontSize: 10,
        letterSpacing: "0.18em",
        color: "var(--text-faint)",
        marginBottom: 8,
      }}
    >
      {children}
    </span>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid var(--hair-strong)",
        background: "var(--bg-card-2)",
        color: "var(--text)",
        fontSize: 14,
        outline: "none",
        fontFamily: "'Satoshi', sans-serif",
        ...style,
      }}
    />
  );
}

export function SignupForm({ id }: { id: string }) {
  const t = tournamentById(id);

  const [code, setCode] = useState(t?.code ?? "");
  const [found, setFound] = useState(!!t);
  const [category, setCategory] = useState<string>(t?.categories[0] ?? "1ª");
  const [gender, setGender] = useState<string>(t?.genders[0] ?? "Masculino");

  const [name, setName] = useState("");
  const [pts, setPts] = useState("");
  const [level, setLevel] = useState("");
  const [mateName, setMateName] = useState("");
  const [matePts, setMatePts] = useState("");
  const [mateLevel, setMateLevel] = useState("");

  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  async function submitSignup() {
    if (busy) return;
    if (!name.trim() || !mateName.trim()) {
      setSignErr("Faltan los nombres de la pareja.");
      return;
    }
    if (code.trim().length < 4) {
      setSignErr("Falta el código del torneo.");
      return;
    }
    const seed =
      (parseInt(pts || "0", 10) || 0) + (parseInt(matePts || "0", 10) || 0);
    const league =
      (parseInt(level || "0", 10) || 0) + (parseInt(mateLevel || "0", 10) || 0);
    setBusy(true);
    setSignErr(null);
    const res = await guardedWrite("inscribir la pareja", () =>
      tournamentSignup({
        code,
        category,
        gender: SIGNUP_GENDER_DB[gender] ?? gender.toLowerCase(),
        p1Name: name,
        p2Name: mateName,
        seedPoints: seed || null,
        leagueSum: league || null,
        availability: [...blocked],
      }),
    );
    setBusy(false);
    if (res.ok) setDone(true);
    else setSignErr(res.reason);
  }

  const hint = FCP_HINTS[name.trim().toLowerCase()];
  const mateHint = FCP_HINTS[mateName.trim().toLowerCase()];

  function toggleSlot(key: string) {
    setBlocked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else if (next.size < MAX_BLOCKED_HOURS) next.add(key);
      return next;
    });
  }

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <Card style={{ textAlign: "center", padding: 40 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: "var(--accent-10)",
              color: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
            }}
          >
            <IconCheck size={22} />
          </span>
          <h1 style={{ fontSize: 26 }}>¡Inscripción hecha!</h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 13.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Te avisaremos cuando salga el cuadro y tu horario.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      {/* Cabecera del torneo */}
      {t ? (
        <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          <div className="amb" style={{ padding: 26 }}>
            <Eyebrow>TORNEO</Eyebrow>
            <h1 style={{ margin: "12px 0 0", fontSize: 28 }}>{t.name}</h1>
            <div
              className="mono"
              style={{
                marginTop: 10,
                fontSize: 11.5,
                letterSpacing: "0.1em",
                color: "var(--text-muted)",
              }}
            >
              {t.club} · {t.place}
            </div>
            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
              }}
            >
              <div>
                <Label>FECHAS</Label>
                <span className="mono" style={{ fontSize: 13 }}>
                  {t.dates ?? "Por confirmar"}
                </span>
              </div>
              <div>
                <Label>CUOTA</Label>
                <span
                  className="mono"
                  style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700 }}
                >
                  {t.fee ?? "Gratis"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom: 20 }}>
          <Eyebrow>CÓDIGO DEL TORNEO</Eyebrow>
          <p
            style={{
              margin: "14px 0 16px",
              fontSize: 13.5,
              color: "var(--text-muted)",
            }}
          >
            Busca primero el torneo con su código.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="mono"
              style={{ letterSpacing: "0.18em" }}
            />
            <button
              className="btn btn-accent"
              disabled={code.trim().length < 4}
              onClick={() => setFound(true)}
              style={{ padding: "12px 20px", fontSize: 13.5, borderRadius: 12 }}
            >
              <IconSearch size={15} />
              Buscar
            </button>
          </div>
        </Card>
      )}

      {(found || t) && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <div className="tw-form-grid">
              <div>
                <Label>ELIGE TU CATEGORÍA</Label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(t?.categories.length ? t.categories : CATEGORIES).map((c) => {
                    const on = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className="btn"
                        style={{
                          padding: "9px 16px",
                          fontSize: 13,
                          fontWeight: on ? 700 : 500,
                          background: on ? "var(--accent-10)" : "transparent",
                          color: on ? "var(--accent)" : "var(--text-muted)",
                          border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>ELIGE TU GÉNERO</Label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(t?.genders.length ? t.genders : GENDERS).map((g) => {
                    const on = gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className="btn"
                        style={{
                          padding: "9px 16px",
                          fontSize: 13,
                          fontWeight: on ? 700 : 500,
                          background: on ? "var(--accent-10)" : "transparent",
                          color: on ? "var(--accent)" : "var(--text-muted)",
                          border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                        }}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <div className="tw-form-grid" style={{ marginBottom: 20 }}>
            {/* Tú */}
            <Card>
              <Eyebrow>TU FICHA</Eyebrow>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <Label>TU NOMBRE</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                  {hint && (
                    <button
                      type="button"
                      onClick={() => {
                        setPts(String(hint.pts));
                        setLevel(hint.level);
                      }}
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--accent-10)",
                        border: "1px solid var(--accent-25)",
                        color: "var(--accent)",
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: 9, letterSpacing: "0.16em" }}
                      >
                        DETECTADO EN LA FEDERACIÓN
                      </span>
                      <span className="mono" style={{ fontSize: 12, marginLeft: "auto" }}>
                        {hint.pts} · {hint.level}
                      </span>
                    </button>
                  )}
                  {hint && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 11.5,
                        color: "var(--text-faint)",
                      }}
                    >
                      Toca para rellenar puntos y nivel. Puedes editarlos.
                    </p>
                  )}
                </div>

                <div className="tw-form-grid">
                  <div>
                    <Label>TUS PUNTOS</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={pts}
                      onChange={(e) => setPts(e.target.value.replace(/\D/g, ""))}
                      className="mono"
                    />
                  </div>
                  <div>
                    <Label>TU NIVEL DE LIGA</Label>
                    <Input
                      type="text"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>TU EMAIL</Label>
                  <Input type="email" placeholder="tu@email.com" />
                </div>
                <div>
                  <Label>TU TELÉFONO</Label>
                  <Input type="tel" placeholder="600 000 000" className="mono" />
                </div>
              </div>
            </Card>

            {/* Compañero */}
            <Card>
              <Eyebrow>TU COMPAÑERO/A</Eyebrow>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <Label>NOMBRE DE TU PAREJA</Label>
                  <Input
                    type="text"
                    value={mateName}
                    onChange={(e) => setMateName(e.target.value)}
                    placeholder="Nombre de tu pareja"
                  />
                  {mateHint && (
                    <button
                      type="button"
                      onClick={() => {
                        setMatePts(String(mateHint.pts));
                        setMateLevel(mateHint.level);
                      }}
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "var(--accent-10)",
                        border: "1px solid var(--accent-25)",
                        color: "var(--accent)",
                        cursor: "pointer",
                        width: "100%",
                        textAlign: "left",
                      }}
                    >
                      <span
                        className="mono"
                        style={{ fontSize: 9, letterSpacing: "0.16em" }}
                      >
                        DETECTADO EN LA FEDERACIÓN
                      </span>
                      <span className="mono" style={{ fontSize: 12, marginLeft: "auto" }}>
                        {mateHint.pts} · {mateHint.level}
                      </span>
                    </button>
                  )}
                </div>

                <div className="tw-form-grid">
                  <div>
                    <Label>SUS PUNTOS</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={matePts}
                      onChange={(e) => setMatePts(e.target.value.replace(/\D/g, ""))}
                      className="mono"
                    />
                  </div>
                  <div>
                    <Label>SU NIVEL DE LIGA</Label>
                    <Input
                      type="text"
                      value={mateLevel}
                      onChange={(e) => setMateLevel(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>EMAIL DE TU COMPAÑERO/A · OPCIONAL</Label>
                  <Input type="email" placeholder="pareja@email.com" />
                </div>

                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px dashed var(--hair-strong)",
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    textWrap: "pretty",
                  }}
                >
                  ¿Aún no sabes con quién juegas? Apúntate y comparte tu código
                  de compañero.
                </div>
              </div>
            </Card>
          </div>

          {/* Disponibilidad */}
          <Card style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Eyebrow>HORARIO · DISPONIBILIDAD · FRANJAS DE 1H</Eyebrow>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.12em",
                  color:
                    blocked.size >= MAX_BLOCKED_HOURS
                      ? "var(--warning)"
                      : "var(--text-faint)",
                }}
              >
                {blocked.size} h marcadas · máx. {MAX_BLOCKED_HOURS} h
              </span>
            </div>

            <p
              style={{
                margin: "12px 0 18px",
                fontSize: 12.5,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              Marca las horas en las que NO puedes jugar. El club lo tendrá en
              cuenta al montar el horario.
            </p>

            <div className="tw-avail-slots">
              <span />
              {SIGNUP_HOURS.map((h) => (
                <span
                  key={h}
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.12em",
                    color: "var(--text-faint)",
                    textAlign: "center",
                  }}
                >
                  {h}
                </span>
              ))}

              {SIGNUP_DAYS.map((d) => (
                <Fragment key={d}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: "var(--text-faint)",
                      alignSelf: "center",
                    }}
                  >
                    {d.toUpperCase()}
                  </span>
                  {SIGNUP_HOURS.map((h) => {
                    const key = `${d} ${h}`;
                    const on = blocked.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${d} a las ${h}${on ? " · no puedo" : ""}`}
                        onClick={() => toggleSlot(key)}
                        style={{
                          padding: "12px 4px",
                          borderRadius: 9,
                          fontSize: 11,
                          cursor: "pointer",
                          background: on ? "var(--error-soft)" : "var(--bg-card-2)",
                          color: on ? "var(--error)" : "var(--text-faint)",
                          border: `1px solid ${on ? "var(--error)" : "transparent"}`,
                          transition: "all var(--dur-fast) var(--ease)",
                        }}
                      >
                        {on ? "✕" : "·"}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </Card>

          {signErr && (
            <p style={{ margin: "0 0 12px", color: "var(--error)", fontSize: 13 }}>
              {signErr}
            </p>
          )}
          <button
            className="btn btn-accent"
            disabled={busy || name.trim().length < 3}
            onClick={submitSignup}
            style={{ width: "100%", padding: 16, fontSize: 15 }}
          >
            {busy ? "Inscribiendo…" : "Apuntarme al torneo"}
          </button>
        </>
      )}
    </div>
  );
}

