"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { CATEGORIES, GENDERS } from "@/lib/tournament-data";
import { priceSignup } from "@/lib/tournament-signup-pricing";
import {
  checkCategoryEligibility,
  type CategoryRules,
} from "@/lib/tournament-eligibility";
import {
  fetchTournament,
  fetchTournamentSignupWindow,
  resolveFcpPlayer,
  tournamentSignup,
  tournamentSignupOffline,
  getRegistrationPartnerCode,
} from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card, Eyebrow } from "@/components/ui";
import { SkeletonCard } from "@/components/states";
import { IconCheck, IconSearch } from "@/components/Icon";
import { GoogleLogo } from "@/components/GoogleLogo";

/* Torneo real (RPC pública) y su forma normalizada para el formulario. */
interface RealTournament {
  name: string;
  club_name?: string | null;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  entry_fee: number | null;
  fee_currency: string | null;
  signup_code: string | null;
  category: string | null;
  categories: string[] | null;
  gender: string | null;
  genders: string[] | null;
}
interface NormTournament {
  name: string;
  club: string | null;
  place: string | null;
  dates: string | null;
  fee: string | null;
  code: string;
  categories: string[];
  genders: string[];
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Nombre + al menos un apellido (2 palabras). Se exige cuando NO hay respaldo
 *  de la Federación (si lo hay, el nombre canónico ya viene completo). */
const isFullName = (s: string) =>
  s.trim().split(/\s+/).filter((w) => w.length > 1).length >= 2;

/** Email con pinta razonable (validación suave, el server no depende de esto). */
const looksLikeEmail = (s: string) => /.+@.+\..+/.test(s.trim());

/** Valida el género REAL (FCP) contra la división del torneo. Solo bloquea
 *  cuando se conoce el género (jugador confirmado en la Federación); sin dato
 *  no se puede saber, así que no bloquea. */
function genderMismatch(
  divisionDb: string,
  players: ("M" | "F" | null)[],
): string | null {
  const known = players.filter((g): g is "M" | "F" => g === "M" || g === "F");
  if (divisionDb === "masculino" && known.some((g) => g === "F"))
    return "Este torneo es masculino: la pareja debe ser de hombres.";
  if (divisionDb === "femenino" && known.some((g) => g === "M"))
    return "Este torneo es femenino: la pareja debe ser de mujeres.";
  return null;
}

const DOW_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Días REALES del torneo (de starts_on a ends_on) para el grid de
 *  disponibilidad. Sin fechas -> [] (no se pinta un horario inventado). */
function buildSignupDays(startsOn: string | null, endsOn: string | null): string[] {
  if (!startsOn) return [];
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(startsOn);
  const end = endsOn ? parse(endsOn) : start;
  const out: string[] = [];
  const d = new Date(start);
  let g = 0;
  while (d.getTime() <= end.getTime() && g < 21) {
    out.push(`${DOW_ABBR[d.getDay()]} ${d.getDate()}`);
    d.setDate(d.getDate() + 1);
    g++;
  }
  return out;
}

/** Franjas de 1 h de la ventana horaria del torneo (start_time..end_time), como
 *  `hourlyFranjas` en la app: la última franja EMPIEZA en (fin − 1 h). Sin datos
 *  → 09:00–22:00. Devuelve las horas de inicio ("09:00" … "21:00"). */
function buildSignupHours(
  start?: string | null,
  end?: string | null,
): string[] {
  const sh = parseInt((start || "09:00").slice(0, 2), 10);
  const eh = parseInt((end || "22:00").slice(0, 2), 10);
  const s = Number.isFinite(sh) ? sh : 9;
  const e = Number.isFinite(eh) ? eh : 22;
  const out: string[] = [];
  for (let h = s; h + 1 <= e && out.length < 18; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
  }
  return out.length ? out : [`${String(s).padStart(2, "0")}:00`];
}

function fmtDates(a: string | null, b: string | null): string | null {
  const f = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };
  const da = f(a);
  const db = f(b);
  if (da && db && da !== db) return `${da} – ${db}`;
  return da || db || null;
}

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
// Sugerencia de la Federación (dato REAL de fcp_jugadores, no mock). Igual que
// el chip FcpSuggest de la app: al escribir el nombre buscamos en la FCP y
// proponemos puntos + categoría de la mejor coincidencia.
type FcpHint = {
  pts: number;
  level: string;
  matched: string;
  genero: "M" | "F" | null;
  equipo: string | null;
};

/** Hook: busca en la FCP el nombre escrito (debounced) y devuelve HASTA 4
 *  candidatos (para poder distinguir homónimos por club/puntos). */
function useFcpHints(query: string): FcpHint[] {
  const [hints, setHints] = useState<FcpHint[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHints([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const rows = await resolveFcpPlayer(q);
        if (!alive) return;
        setHints(
          rows.slice(0, 4).map((r) => ({
            pts: r.puntos ?? 0,
            // La LIGA en la que juega (division real), no "ABS".
            level: r.categoriaDiv ?? "",
            matched: r.name,
            genero: r.genero ?? null,
            equipo: r.equipo ?? null,
          })),
        );
      } catch {
        if (alive) setHints([]);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);
  return hints;
}

/** Checkbox "No está federado": el jugador no tiene ficha FCP → puntos y nivel
 *  cuentan como 0 y no se piden. */
function NoFedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        cursor: "pointer",
        fontSize: 12.5,
        color: "var(--text-muted)",
        marginTop: 4,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
      />
      No está federado (sin puntos ni nivel de la FCP)
    </label>
  );
}

/** Selector de coincidencias FCP. Si hay varias personas con el mismo nombre,
 *  el usuario elige la suya por CLUB y PUNTOS (evita atribuir los datos de un
 *  homónimo). Si no es ninguna (otra federación no gestionada), no elige y usa
 *  "No está federado" o escribe los puntos a mano. */
function FcpPicker({
  hints,
  confirmed,
  onPick,
}: {
  hints: FcpHint[];
  confirmed: string | null;
  onPick: (h: FcpHint) => void;
}) {
  if (!hints.length) return null;
  if (confirmed) {
    return (
      <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--accent)" }}>
        ✓ {confirmed} · confirmado en la Federación.
      </p>
    );
  }
  const many = hints.length > 1;
  return (
    <div style={{ marginTop: 10 }}>
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          color: "var(--text-faint)",
          marginBottom: 8,
        }}
      >
        {many ? "VARIOS EN LA FEDERACIÓN · ¿CUÁL ERES?" : "DETECTADO EN LA FEDERACIÓN"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hints.map((h, i) => (
          <button
            key={`${h.matched}-${i}`}
            type="button"
            onClick={() => onPick(h)}
            style={{
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
            <span style={{ fontSize: 13, fontWeight: 600 }}>{h.matched}</span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                marginLeft: "auto",
                color: "var(--text-muted)",
              }}
            >
              {h.pts} pts{h.level ? ` · ${h.level}` : ""}
              {h.equipo ? ` · ${h.equipo}` : ""}
            </span>
          </button>
        ))}
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 11,
          color: "var(--text-faint)",
          textWrap: "pretty",
        }}
      >
        ¿No eres ninguno? Marca «No está federado» o escribe tus puntos a mano.
      </p>
    </div>
  );
}

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
  // Torneo REAL por id (RPC pública), no la maqueta. Si el id es válido se salta
  // la pantalla de "mete el código": el torneo ya se conoce por el enlace.
  const { data: real, loading } = useAsync(
    () => fetchTournament(id) as Promise<RealTournament | null>,
    [id],
  );
  // Días reales del torneo para el grid de disponibilidad (no mock).
  const availDays = useMemo(
    () => buildSignupDays(real?.starts_on ?? null, real?.ends_on ?? null),
    [real?.starts_on, real?.ends_on],
  );
  const t: NormTournament | null = real
    ? {
        name: real.name,
        club: real.club_name ?? null,
        place: real.location ?? null,
        dates: fmtDates(real.starts_on, real.ends_on),
        fee:
          real.entry_fee != null
            ? `${real.entry_fee} ${real.fee_currency ?? "€"}`
            : null,
        code: real.signup_code ?? "",
        categories: real.categories?.length
          ? real.categories
          : real.category
            ? [real.category]
            : [],
        genders: (real.genders?.length
          ? real.genders
          : real.gender
            ? [real.gender]
            : []
        ).map(capitalize),
      }
    : null;

  const [code, setCode] = useState("");
  const [found, setFound] = useState(false);
  const [category, setCategory] = useState<string>("1ª");
  const [gender, setGender] = useState<string>("Masculino");

  // Al cargar el torneo real, sembramos código/categoría/género una sola vez.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!real || seeded) return;
    const cats = real.categories?.length
      ? real.categories
      : real.category
        ? [real.category]
        : [];
    const gens = (
      real.genders?.length ? real.genders : real.gender ? [real.gender] : []
    ).map(capitalize);
    if (real.signup_code) setCode(real.signup_code);
    if (cats.length) setCategory(cats[0]);
    if (gens.length) setGender(gens[0]);
    setFound(true);
    setSeeded(true);
  }, [real, seeded]);

  const [name, setName] = useState("");
  const [pts, setPts] = useState("");
  const [level, setLevel] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mateName, setMateName] = useState("");
  const [matePts, setMatePts] = useState("");
  const [mateLevel, setMateLevel] = useState("");
  const [mateEmail, setMateEmail] = useState("");
  // Nombre COMPLETO tal cual figura en la Federación, fijado SOLO cuando el
  // usuario confirma la coincidencia (toca el chip). Si lo hay, es el que se
  // guarda (nombre canónico); si no, se exige nombre y apellidos escritos.
  const [fedName, setFedName] = useState<string | null>(null);
  const [mateFedName, setMateFedName] = useState<string | null>(null);
  // Género REAL (FCP) de cada jugador confirmado, para validar la división del
  // torneo (evita mujer en torneo masculino y viceversa).
  const [fedGender, setFedGender] = useState<"M" | "F" | null>(null);
  const [mateFedGender, setMateFedGender] = useState<"M" | "F" | null>(null);
  // "No está federado": sin ficha FCP → puntos y nivel cuentan como 0 y no se
  // piden. Igual que en la app.
  const [noFed, setNoFed] = useState(false);
  const [mateNoFed, setMateNoFed] = useState(false);

  // 2ª categoría OPCIONAL (como en la app): el mismo jugador se apunta a otra
  // categoría, posiblemente con OTRO compañero. Su precio pasa a la cuota de 2
  // categorías. Solo se ofrece si el torneo tiene ≥2 categorías.
  const [category2, setCategory2] = useState<string | null>(null);
  const [mate2Name, setMate2Name] = useState("");
  const [mate2Pts, setMate2Pts] = useState("");
  const [mate2Level, setMate2Level] = useState("");
  const [mate2Email, setMate2Email] = useState("");
  const [mate2FedName, setMate2FedName] = useState<string | null>(null);
  const [mate2FedGender, setMate2FedGender] = useState<"M" | "F" | null>(null);
  const [mate2NoFed, setMate2NoFed] = useState(false);
  // Cuota de 2 categorías del torneo (para el desglose). Llega con la ventana.
  const [entryFee2, setEntryFee2] = useState<number | null>(null);
  // Reglas de elegibilidad por categoría (nivel/puntos). Del torneo (FCP).
  const [categoryRules, setCategoryRules] = useState<CategoryRules | null>(null);

  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);
  // Códigos de compañero de las inscripciones creadas (gratis/club), para
  // mostrarlos en la pantalla de éxito y que P1 se los pase a su pareja.
  const [doneCodes, setDoneCodes] = useState<
    { partner: string; category: string | null; code: string }[]
  >([]);

  // Login OBLIGATORIO para inscribirse: así la inscripción queda ligada a la
  // cuenta del que se apunta (p1_user_id) y aparece en sus torneos/stats. El
  // compañero se vincula luego con su código (claim_partner_by_code, en la app).
  const [authUser, setAuthUser] = useState<{
    id: string;
    email: string | null;
  } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  useEffect(() => {
    let alive = true;
    const sb = supabaseBrowser();
    sb.auth
      .getUser()
      .then(({ data }) => {
        if (!alive) return;
        const u = data.user;
        setAuthUser(u ? { id: u.id, email: u.email ?? null } : null);
        setCheckingAuth(false);
        if (u?.email) setEmail((e) => e || u.email!);
      })
      .catch(() => {
        if (alive) {
          setAuthUser(null);
          setCheckingAuth(false);
        }
      });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setAuthUser(u ? { id: u.id, email: u.email ?? null } : null);
      if (u?.email) setEmail((e) => e || u.email!);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const loginToSignup = (provider: "google" | "apple") => {
    const next =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : `/torneos/${id}/inscripcion`;
    // El redirectTo se FIJA al dominio canónico app.tactium.io (salvo en local):
    // ni window.location.origin ni NEXT_PUBLIC_APP_URL son fiables (pueden ser
    // una URL …vercel.app, que NO está en la allowlist de Supabase → el login
    // cae al Site URL, tactium.io). El destino va por cookie.
    const h = window.location.hostname;
    const appBase =
      h === "localhost" || h === "127.0.0.1"
        ? window.location.origin
        : "https://app.tactium.io";
    document.cookie = `tactium_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
    supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${appBase}/auth/callback` },
    });
  };

  // ¿Puede el club cobrar la inscripción online (Stripe Connect activo)?
  //  null  = aún comprobando
  //  true  = pago online disponible → botón de Stripe
  //  false = solo "pagar en el club" (club sin Connect o torneo gratis)
  // Evita el bug de "parece que pagué" cuando el club no está dado de alta.
  const [payOnline, setPayOnline] = useState<boolean | null>(null);
  // Rejilla de disponibilidad: horas y tope REALES del torneo (los fija el club
  // al crearlo). Por defecto 09:00–22:00 hasta que llega el dato de la FCP.
  const [signupHours, setSignupHours] = useState<string[]>(() =>
    buildSignupHours(null, null),
  );
  // Tope de horas marcables = el REAL del torneo (max_removable_hours). null =
  // sin límite, igual que la app (no un 8 inventado).
  const [removeCap, setRemoveCap] = useState<number | null>(null);
  useEffect(() => {
    const code = real?.signup_code;
    if (!code) return;
    let alive = true;
    fetchTournamentSignupWindow(code)
      .then((w) => {
        if (!alive || !w) return;
        setSignupHours(buildSignupHours(w.start_time, w.end_time));
        setRemoveCap(w.max_removable_hours);
        setEntryFee2(w.entry_fee_2);
        setCategoryRules((w.category_rules as CategoryRules | null) ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [real?.signup_code]);
  useEffect(() => {
    if (!real || (real.entry_fee ?? 0) <= 0) {
      setPayOnline(false);
      return;
    }
    setPayOnline(null);
    let alive = true;
    fetch(`/api/tournaments/${id}/signup-connect`)
      .then((r) => r.json())
      .then((d: { online?: boolean }) => {
        if (alive) setPayOnline(!!d.online);
      })
      .catch(() => {
        if (alive) setPayOnline(false);
      });
    return () => {
      alive = false;
    };
  }, [real, id]);

  async function submitSignup(offline = false) {
    if (busy) return;
    // Nombre CANÓNICO: el de la Federación si se confirmó (chip), si no el
    // escrito. Sin respaldo federativo se exige nombre + apellidos.
    const p1Full = (fedName ?? name).trim();
    const p2Full = (mateFedName ?? mateName).trim();
    if (!p1Full || !p2Full) {
      setSignErr("Faltan los nombres de la pareja.");
      return;
    }
    if (!fedName && !isFullName(name)) {
      setSignErr("Escribe tu nombre y apellidos completos.");
      return;
    }
    if (!mateFedName && !isFullName(mateName)) {
      setSignErr("Escribe el nombre y apellidos completos de tu pareja.");
      return;
    }
    if (!looksLikeEmail(email)) {
      setSignErr("Necesitamos tu email para enviarte la confirmación.");
      return;
    }
    if (code.trim().length < 4) {
      setSignErr("Falta el código del torneo.");
      return;
    }

    // 2ª categoría (opcional): compañero — puede ser otro — y categoría distinta.
    const p2bFull = (mate2FedName ?? mate2Name).trim();
    if (category2) {
      if (category2 === category) {
        setSignErr("La 2ª categoría debe ser distinta de la primera.");
        return;
      }
      if (!p2bFull) {
        setSignErr("Falta el compañero de la 2ª categoría.");
        return;
      }
      if (!mate2FedName && !isFullName(mate2Name)) {
        setSignErr(
          "Escribe el nombre y apellidos del compañero de la 2ª categoría.",
        );
        return;
      }
    }

    // Elegibilidad por categoría (nivel/puntos). Es CRÍTICO bloquear aquí: el
    // pago online crea la inscripción tras cobrar, así que un rechazo del
    // servidor dejaría al usuario pagado y sin inscribir.
    if (genderErr) {
      setSignErr(genderErr);
      return;
    }
    if (elig1) {
      setSignErr(elig1);
      return;
    }
    if (category2 && elig2) {
      setSignErr(elig2);
      return;
    }

    setBusy(true);
    setSignErr(null);

    const avail = [...blocked];
    // 0 si el jugador no está federado (sin ficha FCP).
    const aPts = noFed ? 0 : parseInt(pts || "0", 10) || 0;
    const aLvl = noFed ? 0 : parseInt(level || "0", 10) || 0;
    const matePtsV = mateNoFed ? 0 : parseInt(matePts || "0", 10) || 0;
    const mateLvlV = mateNoFed ? 0 : parseInt(mateLevel || "0", 10) || 0;
    const mate2PtsV = mate2NoFed ? 0 : parseInt(mate2Pts || "0", 10) || 0;
    const mate2LvlV = mate2NoFed ? 0 : parseInt(mate2Level || "0", 10) || 0;
    const p1Email = email.trim() || null;
    const p1Phone = phone.trim() || null;

    // Inscripciones a crear: una por categoría. La 2ª comparte jugador 1 (A) y
    // lleva su propio compañero (B2).
    const regs = [
      {
        code,
        category,
        gender: genderDb,
        p1Name: p1Full,
        p2Name: p2Full,
        p1Email,
        p1Phone,
        p2Email: mateEmail.trim() || null,
        seedPoints: aPts + matePtsV || null,
        leagueSum: aLvl + mateLvlV || null,
        availability: avail,
      },
    ];
    if (category2) {
      regs.push({
        code,
        category: category2,
        gender: genderDb,
        p1Name: p1Full,
        p2Name: p2bFull,
        p1Email,
        p1Phone,
        p2Email: mate2Email.trim() || null,
        seedPoints: aPts + mate2PtsV || null,
        leagueSum: aLvl + mate2LvlV || null,
        availability: avail,
      });
    }

    // Confirmación por email (gratis / pago en el club). Fire-and-forget: el
    // correo NO bloquea ni revierte la inscripción. El pago online la envía
    // desde el webhook de Stripe, no aquí. Incluye el código de compañero.
    const notifyConfirm = (method: "club" | "free", codes: (string | null)[]) => {
      fetch("/api/tournaments/signup-confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          method,
          regs: regs.map((r, i) => ({
            p1Name: r.p1Name,
            p2Name: r.p2Name,
            p1Email: r.p1Email,
            p2Email: r.p2Email,
            category: r.category,
            gender: r.gender,
            partnerCode: codes[i] ?? null,
          })),
        }),
      }).catch(() => {});
    };

    // Tras crear las inscripciones (gratis/club): recupera el código de
    // compañero de cada una, lo muestra en la pantalla de éxito y lo envía.
    const afterCreate = async (
      method: "club" | "free",
      regIds: (string | null)[],
    ) => {
      const codes = await Promise.all(
        regIds.map((rid) =>
          rid
            ? getRegistrationPartnerCode(rid).catch(() => null)
            : Promise.resolve(null),
        ),
      );
      const rows = regs
        .map((r, i) => ({
          partner: r.p2Name,
          category: (r.category ?? null) as string | null,
          code: codes[i],
        }))
        .filter((x) => !!x.code) as {
        partner: string;
        category: string | null;
        code: string;
      }[];
      setDoneCodes(rows);
      notifyConfirm(method, codes);
    };

    // "Pagar en el club": crea las inscripciones como PENDIENTES de pago en el
    // club (sin Stripe). El club las confirma al cobrar.
    if (offline) {
      const regIds: (string | null)[] = [];
      for (const r of regs) {
        const res = await guardedWrite("inscribir (pago en el club)", () =>
          tournamentSignupOffline(r),
        );
        if (!res.ok) {
          setBusy(false);
          setSignErr(res.reason);
          return;
        }
        regIds.push(typeof res.data === "string" ? res.data : null);
      }
      await afterCreate("club", regIds);
      setBusy(false);
      setDone(true);
      return;
    }

    // Con cuota → COBRO online (Connect): un solo pago cubre TODAS las
    // categorías; el webhook crea las inscripciones al confirmarse. Si el club
    // no está conectado, se cae a "pagar en el club".
    if ((real?.entry_fee ?? 0) > 0) {
      try {
        const r = await fetch("/api/tournaments/signup-checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, regs }),
        });
        const d = (await r.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
          reason?: string;
        };
        if (r.ok && d.url) {
          window.location.href = d.url; // → Stripe Checkout
          return;
        }
        setBusy(false);
        if (d.reason === "not_connected") {
          setPayOnline(false);
          setSignErr(
            "Este club no tiene el pago online activado. Inscríbete y paga la cuota en el club.",
          );
        } else {
          setSignErr(d.error ?? "No se pudo iniciar el pago de la inscripción.");
        }
        return;
      } catch {
        setBusy(false);
        setSignErr("No se pudo conectar con la pasarela de pago.");
        return;
      }
    }

    // Torneo gratis: crea las inscripciones directamente.
    const regIds: (string | null)[] = [];
    for (const r of regs) {
      const res = await guardedWrite("inscribir la pareja", () =>
        tournamentSignup(r),
      );
      if (!res.ok) {
        setBusy(false);
        setSignErr(res.reason);
        return;
      }
      regIds.push(typeof res.data === "string" ? res.data : null);
    }
    await afterCreate("free", regIds);
    setBusy(false);
    setDone(true);
  }

  const hints = useFcpHints(name);
  const mateHints = useFcpHints(mateName);
  const mate2Hints = useFcpHints(mate2Name);

  // Precio POR PERSONA: cada jugador paga según cuántas categorías juega (1 →
  // entry_fee, 2 → entry_fee_2). El que se inscribe paga por todos. El helper
  // agrupa por nombre y calcula el total (mismo cálculo que el servidor).
  const feePer = real?.entry_fee ?? 0;
  const feeCur = real?.fee_currency ?? "€";
  const hasTwoCats = (t?.categories.length ?? 0) >= 2;
  const regsPreview = useMemo(() => {
    const p1 = fedName ?? name;
    const list = [{ category, p1Name: p1, p2Name: mateFedName ?? mateName }];
    if (category2)
      list.push({
        category: category2,
        p1Name: p1,
        p2Name: mate2FedName ?? mate2Name,
      });
    return list;
  }, [
    category,
    category2,
    name,
    fedName,
    mateName,
    mateFedName,
    mate2Name,
    mate2FedName,
  ]);
  const pricing = useMemo(
    () => priceSignup(regsPreview, feePer, entryFee2),
    [regsPreview, feePer, entryFee2],
  );
  const feeTotal = pricing.totalCents / 100;

  // Elegibilidad por categoría (nivel/puntos), igual que la app y que la RPC del
  // servidor. Se calcula con los puntos/nivel SUMADOS de cada pareja.
  const genderDb = SIGNUP_GENDER_DB[gender] ?? gender.toLowerCase();
  // Puntos/nivel EFECTIVOS: 0 si el jugador NO está federado (sin ficha FCP).
  const p1PtsN = noFed ? 0 : parseInt(pts || "0", 10) || 0;
  const p1LvlN = noFed ? 0 : parseInt(level || "0", 10) || 0;
  const matePtsN = mateNoFed ? 0 : parseInt(matePts || "0", 10) || 0;
  const mateLvlN = mateNoFed ? 0 : parseInt(mateLevel || "0", 10) || 0;
  const mate2PtsN = mate2NoFed ? 0 : parseInt(mate2Pts || "0", 10) || 0;
  const mate2LvlN = mate2NoFed ? 0 : parseInt(mate2Level || "0", 10) || 0;
  const elig1 = useMemo(
    () =>
      checkCategoryEligibility(
        categoryRules,
        category,
        genderDb,
        p1PtsN + matePtsN,
        p1LvlN + mateLvlN,
      ),
    [categoryRules, category, genderDb, p1PtsN, p1LvlN, matePtsN, mateLvlN],
  );
  const elig2 = useMemo(
    () =>
      category2
        ? checkCategoryEligibility(
            categoryRules,
            category2,
            genderDb,
            p1PtsN + mate2PtsN,
            p1LvlN + mate2LvlN,
          )
        : null,
    [categoryRules, category2, genderDb, p1PtsN, p1LvlN, mate2PtsN, mate2LvlN],
  );
  // Género real (FCP) vs división del torneo. La misma división aplica a las 2
  // categorías (hay una sola selección de género en la ficha).
  const genderErr = useMemo(() => {
    const div = SIGNUP_GENDER_DB[gender] ?? gender.toLowerCase();
    const players: ("M" | "F" | null)[] = [fedGender, mateFedGender];
    if (category2) players.push(mate2FedGender);
    return genderMismatch(div, players);
  }, [gender, fedGender, mateFedGender, mate2FedGender, category2]);
  const eligBlocked =
    !!elig1 || (!!category2 && !!elig2) || !!genderErr;

  function toggleSlot(key: string) {
    setBlocked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else if (removeCap == null || next.size < removeCap) next.add(key);
      return next;
    });
  }

  // Mientras se resuelve el torneo real, no se pinta la pantalla del código.
  if (loading && !real) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <SkeletonCard />
      </div>
    );
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

          {doneCodes.length > 0 && (
            <div
              style={{
                marginTop: 22,
                padding: "16px 16px 14px",
                borderRadius: 14,
                border: "1px dashed var(--hair-strong)",
                background: "var(--bg-card-2)",
                textAlign: "left",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  color: "var(--accent)",
                }}
              >
                CÓDIGO PARA TU COMPAÑERO
              </div>
              <p
                style={{
                  margin: "8px 0 12px",
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  textWrap: "pretty",
                }}
              >
                Pásale este código a tu compañero. Cuando lo meta en{" "}
                <b>Mis torneos</b>, el torneo aparecerá también en su cuenta.
              </p>
              {doneCodes.map((d, i) => (
                <div
                  key={`${d.code}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 0",
                    borderTop:
                      i > 0 ? "1px solid var(--hair-strong)" : "none",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--text)" }}>
                    {d.partner}
                    {d.category ? (
                      <span style={{ color: "var(--text-faint)" }}>
                        {" · "}
                        {d.category}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: "var(--accent)",
                    }}
                  >
                    {d.code}
                  </span>
                </div>
              ))}
            </div>
          )}

          <a
            href="/torneos/mios"
            className="btn btn-accent"
            style={{
              display: "inline-flex",
              marginTop: 22,
              padding: "13px 24px",
              fontSize: 14,
            }}
          >
            Ver mis torneos
          </a>
          <a
            href="tactium://"
            className="btn btn-ghost"
            style={{
              display: "inline-flex",
              marginTop: 10,
              padding: "12px 24px",
              fontSize: 14,
            }}
          >
            Volver a la app
          </a>
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

      {/* Gate de login: para inscribirse hay que iniciar sesión. */}
      {(found || t) && !checkingAuth && !authUser && (
        <Card style={{ marginBottom: 20 }}>
          <Eyebrow>INICIA SESIÓN PARA INSCRIBIRTE</Eyebrow>
          <p
            style={{
              margin: "14px 0 20px",
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            Entra con tu cuenta para apuntarte. Así tu inscripción queda en tu
            perfil, con tus torneos y estadísticas. Tu compañero podrá vincularse
            luego con su código, tenga o no club.
          </p>
          <button
            className="btn btn-accent"
            onClick={() => loginToSignup("google")}
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
            <a
              href={`/entrar?next=${encodeURIComponent(`/torneos/${id}/inscripcion`)}`}
              style={{ color: "var(--accent)" }}
            >
              Inicia sesión aquí
            </a>
          </p>
        </Card>
      )}

      {(found || t) && authUser && (
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
                  <Label>TU NOMBRE Y APELLIDOS</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFedName(null); // editar a mano descarta el nombre FCP
                      setFedGender(null);
                    }}
                    placeholder="Nombre y apellidos"
                  />
                  {!noFed && (
                    <FcpPicker
                      hints={hints}
                      confirmed={fedName}
                      onPick={(h) => {
                        setName(h.matched);
                        setFedName(h.matched);
                        setFedGender(h.genero);
                        setPts(String(h.pts));
                        setLevel(h.level);
                      }}
                    />
                  )}
                </div>

                <NoFedToggle
                  checked={noFed}
                  onChange={(v) => {
                    setNoFed(v);
                    if (v) {
                      setPts("");
                      setLevel("");
                      setFedName(null);
                      setFedGender(null);
                    }
                  }}
                />
                {!noFed && (
                  <div className="tw-form-grid">
                    <div>
                      <Label>TUS PUNTOS</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={pts}
                        onChange={(e) =>
                          setPts(e.target.value.replace(/\D/g, ""))
                        }
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
                )}

                <div>
                  <Label>TU EMAIL</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 11,
                      color: "var(--text-faint)",
                    }}
                  >
                    Te enviaremos la confirmación de la inscripción aquí.
                  </p>
                </div>
                <div>
                  <Label>TU TELÉFONO · OPCIONAL</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="600 000 000"
                    className="mono"
                  />
                </div>
              </div>
            </Card>

            {/* Compañero */}
            <Card>
              <Eyebrow>TU COMPAÑERO/A</Eyebrow>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <Label>NOMBRE Y APELLIDOS DE TU PAREJA</Label>
                  <Input
                    type="text"
                    value={mateName}
                    onChange={(e) => {
                      setMateName(e.target.value);
                      setMateFedName(null);
                      setMateFedGender(null);
                    }}
                    placeholder="Nombre y apellidos de tu pareja"
                  />
                  {!mateNoFed && (
                    <FcpPicker
                      hints={mateHints}
                      confirmed={mateFedName}
                      onPick={(h) => {
                        setMateName(h.matched);
                        setMateFedName(h.matched);
                        setMateFedGender(h.genero);
                        setMatePts(String(h.pts));
                        setMateLevel(h.level);
                      }}
                    />
                  )}
                </div>

                <NoFedToggle
                  checked={mateNoFed}
                  onChange={(v) => {
                    setMateNoFed(v);
                    if (v) {
                      setMatePts("");
                      setMateLevel("");
                      setMateFedName(null);
                      setMateFedGender(null);
                    }
                  }}
                />
                {!mateNoFed && (
                  <div className="tw-form-grid">
                    <div>
                      <Label>SUS PUNTOS</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={matePts}
                        onChange={(e) =>
                          setMatePts(e.target.value.replace(/\D/g, ""))
                        }
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
                )}

                <div>
                  <Label>EMAIL DE TU COMPAÑERO/A · OPCIONAL</Label>
                  <Input
                    type="email"
                    value={mateEmail}
                    onChange={(e) => setMateEmail(e.target.value)}
                    placeholder="pareja@email.com"
                  />
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 11,
                      color: "var(--text-faint)",
                    }}
                  >
                    Si lo pones, le llega también la confirmación.
                  </p>
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

          {/* 2ª categoría OPCIONAL (como en la app). Solo si el torneo tiene ≥2
              categorías. El compañero puede ser distinto. */}
          {hasTwoCats && (
            <Card style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Eyebrow>2ª CATEGORÍA · OPCIONAL</Eyebrow>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      textWrap: "pretty",
                    }}
                  >
                    Puedes jugar una segunda categoría, con otro compañero si
                    hace falta. Pagas la cuota de 2 categorías (no el doble).
                  </p>
                </div>
                {!category2 ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setCategory2(
                        (t?.categories ?? []).find((c) => c !== category) ??
                          null,
                      )
                    }
                    style={{
                      padding: "9px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--accent)",
                      border: "1px solid var(--accent)",
                      background: "var(--accent-10)",
                    }}
                  >
                    + Añadir
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setCategory2(null);
                      setMate2Name("");
                      setMate2Pts("");
                      setMate2Level("");
                      setMate2Email("");
                      setMate2FedName(null);
                    }}
                    style={{
                      padding: "9px 16px",
                      fontSize: 13,
                      color: "var(--text-muted)",
                      border: "1px solid var(--hair-strong)",
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>

              {category2 && (
                <div style={{ marginTop: 18 }}>
                  <Label>ELIGE LA 2ª CATEGORÍA</Label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(t?.categories ?? [])
                      .filter((c) => c !== category)
                      .map((c) => {
                        const on = category2 === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategory2(c)}
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

                  <div style={{ marginTop: 18 }}>
                    <Label>NOMBRE Y APELLIDOS DEL COMPAÑERO (2ª CATEGORÍA)</Label>
                    <Input
                      type="text"
                      value={mate2Name}
                      onChange={(e) => {
                        setMate2Name(e.target.value);
                        setMate2FedName(null);
                        setMate2FedGender(null);
                      }}
                      placeholder="Nombre y apellidos"
                    />
                    {!mate2NoFed && (
                      <FcpPicker
                        hints={mate2Hints}
                        confirmed={mate2FedName}
                        onPick={(h) => {
                          setMate2Name(h.matched);
                          setMate2FedName(h.matched);
                          setMate2FedGender(h.genero);
                          setMate2Pts(String(h.pts));
                          setMate2Level(h.level);
                        }}
                      />
                    )}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <NoFedToggle
                      checked={mate2NoFed}
                      onChange={(v) => {
                        setMate2NoFed(v);
                        if (v) {
                          setMate2Pts("");
                          setMate2Level("");
                          setMate2FedName(null);
                          setMate2FedGender(null);
                        }
                      }}
                    />
                  </div>
                  {!mate2NoFed && (
                    <div className="tw-form-grid" style={{ marginTop: 16 }}>
                      <div>
                        <Label>SUS PUNTOS</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={mate2Pts}
                          onChange={(e) =>
                            setMate2Pts(e.target.value.replace(/\D/g, ""))
                          }
                          className="mono"
                        />
                      </div>
                      <div>
                        <Label>SU NIVEL DE LIGA</Label>
                        <Input
                          type="text"
                          value={mate2Level}
                          onChange={(e) => setMate2Level(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 16 }}>
                    <Label>EMAIL DEL COMPAÑERO (2ª) · OPCIONAL</Label>
                    <Input
                      type="email"
                      value={mate2Email}
                      onChange={(e) => setMate2Email(e.target.value)}
                      placeholder="pareja2@email.com"
                    />
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Disponibilidad — solo si el torneo tiene fechas reales. */}
          {availDays.length > 0 && (
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
                    removeCap != null && blocked.size >= removeCap
                      ? "var(--warning)"
                      : "var(--text-faint)",
                }}
              >
                {blocked.size} h marcadas
                {removeCap != null ? ` · máx. ${removeCap} h` : ""}
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

            <div style={{ overflowX: "auto", margin: "0 -4px", padding: "0 4px 4px" }}>
            <div
              className="tw-avail-slots"
              style={{
                gridTemplateColumns: `56px repeat(${signupHours.length}, minmax(38px, 1fr))`,
                minWidth: signupHours.length > 6 ? "max-content" : undefined,
              }}
            >
              <span />
              {signupHours.map((h) => (
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

              {availDays.map((d) => (
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
                  {signupHours.map((h) => {
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
            </div>
          </Card>
          )}

          {/* Género (división) + elegibilidad por categoría: avisos persistentes.
              Bloquean el botón. */}
          {(genderErr || elig1 || (category2 && elig2)) && (
            <div
              style={{
                margin: "0 0 12px",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--warning)",
                background: "rgba(242,201,76,0.10)",
              }}
            >
              {genderErr && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--warning)",
                    marginBottom: elig1 || (category2 && elig2) ? 4 : 0,
                  }}
                >
                  {genderErr}
                </div>
              )}
              {elig1 && (
                <div style={{ fontSize: 12.5, color: "var(--warning)" }}>
                  1ª categoría · {elig1}
                </div>
              )}
              {category2 && elig2 && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--warning)",
                    marginTop: elig1 ? 4 : 0,
                  }}
                >
                  2ª categoría · {elig2}
                </div>
              )}
            </div>
          )}
          {signErr && (
            <p style={{ margin: "0 0 12px", color: "var(--error)", fontSize: 13 }}>
              {signErr}
            </p>
          )}

          {/* Desglose: la cuota es POR PERSONA (según cuántas categorías juega
              cada uno) y tú pagas por todos. */}
          {feePer > 0 && (
            <div
              style={{
                padding: "12px 16px",
                marginBottom: 12,
                borderRadius: 12,
                border: "1px solid var(--hair-strong)",
                background: "var(--bg-card-2)",
              }}
            >
              {pricing.persons.length > 0 ? (
                <>
                  {pricing.persons.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "3px 0",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--text)" }}>
                        {p.name}
                        <span style={{ color: "var(--text-faint)" }}>
                          {" · "}
                          {p.categories >= 2 ? "2 categorías" : "1 categoría"}
                        </span>
                      </span>
                      <span className="mono" style={{ fontSize: 13 }}>
                        {p.feeCents / 100} {feeCur}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: "1px solid var(--hair-strong)",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Total · {pricing.persons.length} jugadores
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--accent)",
                      }}
                    >
                      {feeTotal} {feeCur}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text)" }}>
                  Cuota por persona: {feePer} {feeCur} (1 categoría)
                  {entryFee2 ? ` · ${entryFee2} ${feeCur} (2 categorías)` : ""}
                </div>
              )}
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11.5,
                  color: "var(--text-faint)",
                }}
              >
                Al inscribirte pagas por todos los jugadores.
              </div>
            </div>
          )}
          {(real?.entry_fee ?? 0) <= 0 ? (
            /* Torneo gratis: un único botón de inscripción. */
            <button
              className="btn btn-accent"
              disabled={busy || name.trim().length < 3 || eligBlocked}
              onClick={() => submitSignup(false)}
              style={{ width: "100%", padding: 16, fontSize: 15 }}
            >
              {busy ? "Inscribiendo…" : "Apuntarme al torneo"}
            </button>
          ) : payOnline === null ? (
            /* Comprobando si el club cobra online. */
            <button
              className="btn btn-accent"
              disabled
              style={{ width: "100%", padding: 16, fontSize: 15, opacity: 0.7 }}
            >
              Comprobando forma de pago…
            </button>
          ) : payOnline ? (
            /* Club con pago online: Stripe (principal) + pagar en el club. */
            <>
              <button
                className="btn btn-accent"
                disabled={busy || name.trim().length < 3 || eligBlocked}
                onClick={() => submitSignup(false)}
                style={{ width: "100%", padding: 16, fontSize: 15 }}
              >
                {busy
                  ? "Inscribiendo…"
                  : `Pagar inscripción · ${feeTotal} ${feeCur}`}
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy || name.trim().length < 3 || eligBlocked}
                onClick={() => submitSignup(true)}
                style={{ width: "100%", padding: 14, fontSize: 14, marginTop: 10 }}
              >
                Pagar en el club (efectivo)
              </button>
            </>
          ) : (
            /* Club SIN pago online: solo se puede pagar en el club. */
            <>
              <button
                className="btn btn-accent"
                disabled={busy || name.trim().length < 3 || eligBlocked}
                onClick={() => submitSignup(true)}
                style={{ width: "100%", padding: 16, fontSize: 15 }}
              >
                {busy
                  ? "Inscribiendo…"
                  : `Inscribirme · pago en el club (${feeTotal} ${feeCur})`}
              </button>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  textWrap: "pretty",
                }}
              >
                Este club cobra la inscripción en persona. Te apuntas ahora y
                pagas la cuota directamente en el club.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

