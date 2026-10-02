"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { formatFee, priceSignup } from "@/lib/tournament-signup-pricing";
import {
  checkCategoryEligibility,
  type CategoryRules,
} from "@/lib/tournament-eligibility";
import {
  defaultTournamentTerms,
  fetchTournament,
  fetchTournamentSignupWindow,
  tournamentSignup,
  tournamentSignupOffline,
  getRegistrationPartnerCode,
} from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Field,
  Note,
  PageHeader,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { IconAlert, IconChevronRight, IconTrophy } from "@/components/Icon";
import { GoogleLogo } from "@/components/GoogleLogo";
import { canonicalOrigin } from "@/lib/site";

import {
  buildSignupDays,
  capitalize,
  describeThreshold,
  fmtDates,
  genderMismatch,
  hourlyFranjas,
  isFullName,
  looksLikeEmail,
  rulesUseNivel,
  shortEligibility,
  SIGNUP_GENDER_DB,
  type NormTournament,
  type RealTournament,
} from "./signup/helpers";
import {
  LinkBtn,
  PlayerFields,
  validatePlayer,
  type PlayerDraft,
  type PlayerErrors,
} from "./signup/PlayerFields";
import { AvailabilityGrid, RadioCard, StepBar } from "./signup/parts";
import { SuccessTicket } from "./signup/SuccessTicket";
import { saveSignupDraft, takeSignupDraft } from "./signup/draft";

const EMPTY_PLAYER: PlayerDraft = {
  name: "",
  fedName: null,
  fedGender: null,
  noFed: false,
  pts: "",
  level: "",
  email: "",
  phone: "",
};

const hasErrors = (e: PlayerErrors) => Object.keys(e).length > 0;

/**
 * Suma de una pareja (puntos o nivel) tal como la valida el servidor:
 * no federado = 0 (válido); federado con el campo vacío = null («falta el
 * dato»). Antes el vacío contaba como 0 y una suma de 0 se enviaba como null:
 * la web daba el OK y el servidor rechazaba DESPUÉS de cobrar.
 */
function pairSum(
  noFedA: boolean,
  rawA: string,
  noFedB: boolean,
  rawB: string,
): number | null {
  const a = noFedA ? 0 : rawA.trim() === "" ? null : parseInt(rawA, 10);
  const b = noFedB ? 0 : rawB.trim() === "" ? null : parseInt(rawB, 10);
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  return a + b;
}

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: "¿Quiénes jugáis?",
  2: "¿En qué categoría?",
  3: "Horario y pago",
};

/**
 * Inscripción a un torneo en 3 pasos (tras el login, que es obligatorio):
 *   1 · ¿Quiénes jugáis?  — género, tu ficha y la de tu pareja.
 *   2 · ¿En qué categoría? — solo las que permiten vuestros puntos/nivel.
 *   3 · Horario y pago    — horas que no podéis, condiciones, cuota y pago.
 * Volver atrás no borra nada. El envío y el cobro (Stripe Connect, pago en el
 * club, gratis) son los de siempre: `submitSignup`.
 */
export function SignupForm({ id }: { id: string }) {
  // Torneo REAL por id (RPC pública). La página siempre llega con id: el
  // torneo ya se conoce por el enlace (no hay buscador por código).
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
            ? formatFee(real.entry_fee, real.fee_currency)
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

  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState("");
  // Sin valores inventados: la categoría y el género salen del torneo. Sin
  // categorías → «Categoría única» (null); un solo género → se elige solo.
  const [category, setCategory] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("");

  // Al cargar el torneo real, sembramos código y género una sola vez.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!real || seeded) return;
    const gens = (
      real.genders?.length ? real.genders : real.gender ? [real.gender] : []
    ).map(capitalize);
    if (real.signup_code) setCode(real.signup_code);
    if (gens.length === 1) setGender(gens[0]);
    setSeeded(true);
  }, [real, seeded]);

  // Fichas: tú (jugador 1), tu pareja y, si hay 2ª categoría, su compañero.
  const [me, setMe] = useState<PlayerDraft>(EMPTY_PLAYER);
  const [mate, setMate] = useState<PlayerDraft>(EMPTY_PLAYER);
  const [mate2, setMate2] = useState<PlayerDraft>(EMPTY_PLAYER);
  const patchMe = (p: Partial<PlayerDraft>) => setMe((s) => ({ ...s, ...p }));
  const patchMate = (p: Partial<PlayerDraft>) => setMate((s) => ({ ...s, ...p }));
  const patchMate2 = (p: Partial<PlayerDraft>) => setMate2((s) => ({ ...s, ...p }));
  const { name, fedName, fedGender, noFed, pts, level, email, phone } = me;
  const {
    name: mateName,
    fedName: mateFedName,
    fedGender: mateFedGender,
    noFed: mateNoFed,
    pts: matePts,
    level: mateLevel,
    email: mateEmail,
  } = mate;
  const {
    name: mate2Name,
    fedName: mate2FedName,
    fedGender: mate2FedGender,
    noFed: mate2NoFed,
    pts: mate2Pts,
    level: mate2Level,
    email: mate2Email,
  } = mate2;

  // 2ª categoría OPCIONAL (como en la app): el mismo jugador se apunta a otra
  // categoría, posiblemente con OTRO compañero. Su precio pasa a la cuota de 2
  // categorías. Solo se ofrece si el torneo tiene ≥2 categorías.
  const [want2, setWant2] = useState(false);
  const [category2, setCategory2] = useState<string | null>(null);
  // Cuota de 2 categorías del torneo (para el desglose). Llega con la ventana.
  const [entryFee2, setEntryFee2] = useState<number | null>(null);
  // Reglas de elegibilidad por categoría (nivel/puntos). Del torneo (FCP).
  const [categoryRules, setCategoryRules] = useState<CategoryRules | null>(null);

  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);
  // Condiciones del torneo: casilla OBLIGATORIA (el servidor también la exige).
  // Si el texto del torneo no llega, se enseñan las estándar: la casilla
  // siempre está a la vista (nunca un error por una casilla invisible).
  const [terms, setTerms] = useState<string | null>(null);
  const [defaultTerms, setDefaultTerms] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  // Errores de cada paso: solo se enseñan tras intentar avanzar.
  const [tried1, setTried1] = useState(false);
  const [tried2, setTried2] = useState(false);
  // Vuelta de Stripe con el pago cancelado.
  const [payCancelled, setPayCancelled] = useState(false);
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
        if (u?.email) setMe((p) => (p.email ? p : { ...p, email: u.email! }));
        if (!u) return;
        // Nombre de la cuenta para prerrellenar la ficha (perfil o, si no,
        // el que dio Google). Solo si el campo sigue vacío.
        const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
        const metaName = (meta.full_name || meta.name || "").trim();
        sb.from("profiles")
          .select("full_name")
          .eq("id", u.id)
          .maybeSingle()
          .then(
            ({ data: prof }) => {
              if (!alive) return;
              const n =
                ((prof as { full_name?: string | null } | null)?.full_name ?? "").trim() ||
                metaName;
              if (n) setMe((p) => (p.name ? p : { ...p, name: n }));
            },
            () => {
              if (alive && metaName)
                setMe((p) => (p.name ? p : { ...p, name: metaName }));
            },
          );
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
      if (u?.email) setMe((p) => (p.email ? p : { ...p, email: u.email! }));
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
    // El redirectTo se FIJA al dominio canónico (salvo en local): una URL
    // …vercel.app NO está en la allowlist de Supabase y el login caería al
    // Site URL. El destino va por cookie.
    const appBase = canonicalOrigin();
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
  // Rejilla de disponibilidad: franjas y tope REALES del torneo (los fija el
  // club al crearlo). Por defecto 09:00–22:00 hasta que llega el dato.
  const [slots, setSlots] = useState(() => hourlyFranjas(null, null));
  // Tope de horas marcables = el REAL del torneo (max_removable_hours). null =
  // sin límite, igual que la app (no un 8 inventado).
  const [removeCap, setRemoveCap] = useState<number | null>(null);
  useEffect(() => {
    const code = real?.signup_code;
    if (!code) return;
    let alive = true;
    // Condiciones estándar por si el torneo no trae las suyas.
    const loadDefaultTerms = () => {
      defaultTournamentTerms()
        .then((txt) => {
          if (alive && txt) setDefaultTerms(txt);
        })
        .catch(() => {});
    };
    fetchTournamentSignupWindow(code)
      .then((w) => {
        if (!alive) return;
        if (!w) {
          loadDefaultTerms();
          return;
        }
        setSlots(hourlyFranjas(w.start_time, w.end_time));
        setRemoveCap(w.max_removable_hours);
        setEntryFee2(w.entry_fee_2);
        setCategoryRules((w.category_rules as CategoryRules | null) ?? null);
        setTerms(w.terms);
        if (!w.terms) loadDefaultTerms();
      })
      .catch(() => {
        if (alive) loadDefaultTerms();
      });
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

  // Pago cancelado en Stripe: se recupera el borrador y se vuelve al paso 3.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!seeded || restoredRef.current) return;
    restoredRef.current = true;
    let cancelled = false;
    try {
      cancelled =
        new URLSearchParams(window.location.search).get("pago") === "cancelado";
    } catch {
      cancelled = false;
    }
    if (!cancelled) return;
    setPayCancelled(true);
    const d = takeSignupDraft(id);
    if (!d) return;
    setGender(d.gender);
    setCategory(d.category);
    setWant2(d.want2);
    setCategory2(d.category2);
    setMe(d.me);
    setMate(d.mate);
    setMate2(d.mate2 ?? EMPTY_PLAYER);
    setBlocked(new Set(d.blocked ?? []));
    setTermsOk(!!d.termsOk);
    setStep(3);
  }, [seeded, id]);

  // Lo que se guarda: las franjas que NO podéis, con el formato de la app
  // («Vie 24 09:00–10:00»), en el orden de la rejilla.
  const availability = useMemo(() => {
    const out: string[] = [];
    for (const d of availDays)
      for (const s of slots) {
        const key = `${d} ${s.label}`;
        if (blocked.has(key)) out.push(key);
      }
    return out;
  }, [availDays, slots, blocked]);

  function saveDraft() {
    saveSignupDraft(id, {
      v: 1,
      gender,
      category,
      want2,
      category2,
      me,
      mate,
      mate2,
      blocked: [...blocked],
      termsOk,
    });
  }

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
    if (!termsOk) {
      setSignErr("Acepta las condiciones del torneo para inscribirte.");
      return;
    }

    setBusy(true);
    setSignErr(null);

    const avail = availability;
    // 0 si el jugador no está federado (sin ficha FCP).
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
        seedPoints: pairSum(noFed, pts, mateNoFed, matePts),
        leagueSum: pairSum(noFed, level, mateNoFed, mateLevel),
        availability: avail,
        termsAccepted: true, // la casilla bloquea el envío si no está marcada
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
        seedPoints: pairSum(noFed, pts, mate2NoFed, mate2Pts),
        leagueSum: pairSum(noFed, level, mate2NoFed, mate2Level),
        availability: avail,
        termsAccepted: true,
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
          // Borrador por si cancela en Stripe (vuelve con ?pago=cancelado).
          saveDraft();
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

  // Precio POR PERSONA: cada jugador paga según cuántas categorías juega (1 →
  // entry_fee, 2 → entry_fee_2). El que se inscribe paga por todos. El helper
  // agrupa por nombre y calcula el total (mismo cálculo que el servidor).
  const feePer = real?.entry_fee ?? 0;
  const feeCur = real?.fee_currency ?? "€";
  const cats = t?.categories ?? [];
  const hasCats = cats.length > 0;
  const hasTwoCats = cats.length >= 2;
  const genders = t?.genders ?? [];
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
  const genderDb: string | null = gender
    ? (SIGNUP_GENDER_DB[gender] ?? gender.toLowerCase())
    : null;
  // Puntos/nivel de la pareja: ver pairSum (no federado = 0, vacío = falta).
  const pair1Pts = pairSum(noFed, pts, mateNoFed, matePts);
  const pair1Niv = pairSum(noFed, level, mateNoFed, mateLevel);
  const pair2Pts = pairSum(noFed, pts, mate2NoFed, mate2Pts);
  const pair2Niv = pairSum(noFed, level, mate2NoFed, mate2Level);
  const elig1 = useMemo(
    () => checkCategoryEligibility(categoryRules, category, genderDb, pair1Pts, pair1Niv),
    [categoryRules, category, genderDb, pair1Pts, pair1Niv],
  );
  const elig2 = useMemo(
    () =>
      category2
        ? checkCategoryEligibility(categoryRules, category2, genderDb, pair2Pts, pair2Niv)
        : null,
    [categoryRules, category2, genderDb, pair2Pts, pair2Niv],
  );
  // Género real (FCP) vs división del torneo. La misma división aplica a las 2
  // categorías (hay una sola selección de género en la ficha).
  const genderErr = useMemo(() => {
    const players: ("M" | "F" | null)[] = [fedGender, mateFedGender];
    if (category2) players.push(mate2FedGender);
    return genderMismatch(genderDb ?? "", players);
  }, [genderDb, fedGender, mateFedGender, mate2FedGender, category2]);
  const eligBlocked =
    !!elig1 || (!!category2 && !!elig2) || !!genderErr;

  // ── Paso 1: validación (errores junto al campo, solo tras intentar) ──
  const showLevel = rulesUseNivel(categoryRules);
  const genderNeeded = genders.length > 1 && !gender;
  const meErrs = useMemo(
    () =>
      validatePlayer(me, { self: true, showLevel, requireEmail: true, requirePhone: true }),
    [me, showLevel],
  );
  const mateErrs = useMemo(
    () =>
      validatePlayer(mate, { self: false, showLevel, requireEmail: false, requirePhone: false }),
    [mate, showLevel],
  );
  const mate2Errs = useMemo(
    () =>
      validatePlayer(mate2, { self: false, showLevel, requireEmail: false, requirePhone: false }),
    [mate2, showLevel],
  );

  // ── Paso 2: categorías con su elegibilidad ──
  const catOptions = useMemo(() => {
    const rows = cats.map((c) => ({
      c,
      why: checkCategoryEligibility(categoryRules, c, genderDb, pair1Pts, pair1Niv),
    }));
    return [...rows.filter((r) => !r.why), ...rows.filter((r) => !!r.why)];
  }, [cats, categoryRules, genderDb, pair1Pts, pair1Niv]);
  const eligibleCats = catOptions.filter((r) => !r.why).map((r) => r.c);
  const mate2Ready =
    mate2.noFed ||
    (mate2.pts.trim() !== "" && (!showLevel || mate2.level.trim() !== ""));
  const cat2Options = useMemo(
    () =>
      cats
        .filter((c) => c !== category)
        .filter(
          (c) =>
            !checkCategoryEligibility(categoryRules, c, genderDb, pair2Pts, pair2Niv),
        ),
    [cats, category, categoryRules, genderDb, pair2Pts, pair2Niv],
  );
  const noneEligible = hasCats && eligibleCats.length === 0;
  const catErr = hasCats && !category ? "Elige una categoría." : null;
  const cat2Err =
    want2 && !category2 ? "Elige la 2ª categoría o quita la segunda inscripción." : null;

  function scrollTop() {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      /* nada */
    }
  }

  function goStep2() {
    setTried1(true);
    if (genderNeeded || hasErrors(meErrs) || hasErrors(mateErrs)) return;
    // La categoría elegida ya no vale (cambió la pareja) → se deselecciona.
    // Si solo hay una a la que podéis ir, se elige sola.
    if (category && !eligibleCats.includes(category)) setCategory(null);
    if (eligibleCats.length === 1) setCategory(eligibleCats[0]);
    setStep(2);
    scrollTop();
  }

  function goStep3() {
    setTried2(true);
    if (genderErr || noneEligible || catErr || elig1) return;
    if (want2 && (cat2Err || hasErrors(mate2Errs) || elig2)) return;
    setStep(3);
    scrollTop();
  }

  function goBack() {
    setStep((s) => (s === 3 ? 2 : 1));
    scrollTop();
  }

  function toggleSlot(key: string) {
    setBlocked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else if (removeCap == null || next.size < removeCap) next.add(key);
      return next;
    });
  }

  function removeSecond() {
    setWant2(false);
    setCategory2(null);
    setMate2(EMPTY_PLAYER);
  }

  // Mientras se resuelve el torneo real, esqueleto.
  if (loading && !real) return <SkeletonPage />;

  if (!real || !t) {
    return (
      <div className="tw-page-narrow">
        <EmptyState
          icon={<IconTrophy size={22} />}
          title="No encontramos este torneo"
          body="El enlace no es válido o el torneo ya no está publicado."
          action={
            <BtnLink href="/torneos" variant="accent">
              Ver torneos
            </BtnLink>
          }
        />
      </div>
    );
  }

  if (!real.signup_code) {
    return (
      <div className="tw-page-narrow">
        <EmptyState
          icon={<IconTrophy size={22} />}
          title="Inscripción no disponible"
          body="Este torneo no tiene la inscripción abierta."
          action={
            <BtnLink href={`/torneos/${id}`} variant="accent">
              Ver el torneo
            </BtnLink>
          }
        />
      </div>
    );
  }

  if (done) {
    const p1 = fedName ?? name;
    const entries = [{ pair: `${p1} y ${mateFedName ?? mateName}`, category }];
    if (category2)
      entries.push({ pair: `${p1} y ${mate2FedName ?? mate2Name}`, category: category2 });
    return (
      <SuccessTicket
        tournamentName={t.name}
        dates={t.dates}
        place={t.club ?? t.place}
        entries={entries}
        payInClub={feePer > 0}
        codes={doneCodes}
      />
    );
  }

  // Antes del login: cabecera del torneo + puerta de acceso.
  if (!authUser) {
    return (
      <div className="tw-page-narrow">
        <PageHeader
          title={t.name}
          lede="Apúntate con tu pareja en tres pasos: quiénes jugáis, en qué categoría y cuándo podéis."
          meta={[t.club, t.place].filter(Boolean) as string[]}
        />
        <StatRow style={{ marginBottom: 16 }}>
          <Stat label="Fechas" value={t.dates ?? "Por confirmar"} />
          <Stat
            label="Cuota"
            value={t.fee ?? "Gratis"}
            tone="accent"
            sub="Por persona y categoría"
          />
        </StatRow>

        {!checkingAuth && (
          <Card flush style={{ marginBottom: 16 }}>
            <CardHead title="Inicia sesión para inscribirte" />
            <div className="card-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", textWrap: "pretty" }}>
                Entra con tu cuenta para apuntarte. Así tu inscripción queda en tu
                perfil, con tus torneos y estadísticas. Tu compañero podrá vincularse
                luego con su código, tenga o no club.
              </p>
              <Btn
                variant="accent"
                block
                size="lg"
                onClick={() => loginToSignup("google")}
                icon={<GoogleLogo />}
                style={{ marginTop: 18 }}
              >
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
                <a href={`/entrar?next=${encodeURIComponent(`/torneos/${id}/inscripcion`)}`}>
                  Inicia sesión aquí
                </a>
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Asistente ──
  const stepLede =
    step === 1
      ? "Tus datos y los de tu pareja. Los rellenas tú; tu pareja se vincula luego con su código."
      : step === 2
        ? [
            pair1Pts != null ? `Sumáis ${pair1Pts} pts` : null,
            showLevel && pair1Niv != null ? `nivel ${pair1Niv}` : null,
            gender || null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "Marca cuándo no podéis jugar, acepta las condiciones y confirma.";
  const termsText = terms ?? defaultTerms;
  const nextArrow = <IconChevronRight size={15} />;

  return (
    <div className="tw-page-narrow">
      <StepBar step={step} />
      <PageHeader
        eyebrow={`Paso ${step} de 3 · ${t.name}`}
        title={STEP_TITLES[step]}
        lede={stepLede}
      />

      {payCancelled && (
        <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 16 }}>
          Pago cancelado: no se ha cobrado nada. Revisa y vuelve a intentarlo.
        </Note>
      )}

      {/* ─────────────── PASO 1 · ¿Quiénes jugáis? ─────────────── */}
      {step === 1 && (
        <>
          {genders.length > 1 && (
            <Card style={{ marginBottom: 16 }}>
              <Field
                label="Cuadro"
                error={tried1 && genderNeeded ? "Elige el cuadro en el que jugáis." : undefined}
              >
                <Segmented
                  label="Cuadro"
                  value={gender}
                  options={genders.map((g) => ({ value: g, label: g }))}
                  onChange={setGender}
                />
              </Field>
            </Card>
          )}

          <Card flush style={{ marginBottom: 16 }}>
            <CardHead title="Tú" />
            <div className="card-body">
              <PlayerFields
                idPrefix="sf-me"
                self
                value={me}
                onChange={patchMe}
                showLevel={showLevel}
                requireEmail
                showPhone
                errors={tried1 ? meErrs : undefined}
              />
            </div>
          </Card>

          <Card flush style={{ marginBottom: 16 }}>
            <CardHead
              title="Tu pareja"
              sub="Rellenas tú sus datos. Al terminar te damos un código para que vincule su cuenta."
            />
            <div className="card-body">
              <PlayerFields
                idPrefix="sf-mate"
                self={false}
                value={mate}
                onChange={patchMate}
                showLevel={showLevel}
                requireEmail={false}
                showPhone={false}
                errors={tried1 ? mateErrs : undefined}
              />
            </div>
          </Card>

          {tried1 && (genderNeeded || hasErrors(meErrs) || hasErrors(mateErrs)) && (
            <Note tone="error" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
              Revisa los campos marcados para seguir.
            </Note>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn variant="accent" size="lg" onClick={goStep2}>
              Ver categorías {nextArrow}
            </Btn>
          </div>
        </>
      )}

      {/* ─────────────── PASO 2 · ¿En qué categoría? ─────────────── */}
      {step === 2 && (
        <>
          {genderErr && (
            <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 16 }}>
              {genderErr} Revisa el cuadro o los jugadores en el paso 1.
            </Note>
          )}

          <Card flush style={{ marginBottom: 16 }}>
            <CardHead title="Categoría" />
            <div className="card-body">
              {!hasCats ? (
                <div role="radiogroup" aria-label="Categoría">
                  <RadioCard on title="Categoría única">
                    Este torneo no se divide por categorías.
                  </RadioCard>
                </div>
              ) : noneEligible ? (
                <>
                  <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
                    Con los datos de la pareja no entráis en ninguna categoría de
                    este torneo. Revisa los puntos
                    {showLevel ? " y el nivel" : ""} en el paso 1.
                  </Note>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {catOptions.map((o) => (
                      <RadioCard key={o.c} on={false} disabled title={o.c}>
                        {o.why ? shortEligibility(o.why) : null}
                      </RadioCard>
                    ))}
                  </div>
                </>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Categoría"
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {catOptions.map((o) => (
                    <RadioCard
                      key={o.c}
                      on={!o.why && category === o.c}
                      disabled={!!o.why}
                      onClick={() => {
                        setCategory(o.c);
                        if (category2 === o.c) setCategory2(null);
                      }}
                      title={o.c}
                    >
                      {o.why
                        ? shortEligibility(o.why)
                        : describeThreshold(categoryRules, o.c, genderDb)}
                    </RadioCard>
                  ))}
                </div>
              )}
              {tried2 && catErr && !noneEligible && (
                <div className="field-error" style={{ marginTop: 8 }}>
                  {catErr}
                </div>
              )}
            </div>
          </Card>

          {/* 2ª categoría OPCIONAL. El compañero puede ser distinto. */}
          {hasTwoCats && !noneEligible && (
            <>
              {!want2 ? (
                <div style={{ marginBottom: 16 }}>
                  <LinkBtn onClick={() => setWant2(true)}>
                    + Apuntarme también a una 2ª categoría
                  </LinkBtn>
                </div>
              ) : (
                <Card flush style={{ marginBottom: 16 }}>
                  <CardHead
                    title="Segunda categoría"
                    sub="Puedes jugarla con otro compañero. Pagas la cuota de 2 categorías, no el doble."
                  >
                    <Btn size="sm" variant="quiet" onClick={removeSecond}>
                      Quitar
                    </Btn>
                  </CardHead>
                  <div
                    className="card-body"
                    style={{ display: "flex", flexDirection: "column", gap: 16 }}
                  >
                    <PlayerFields
                      idPrefix="sf-mate2"
                      self={false}
                      value={mate2}
                      onChange={patchMate2}
                      showLevel={showLevel}
                      requireEmail={false}
                      showPhone={false}
                      errors={tried2 ? mate2Errs : undefined}
                    />
                    <div className="divider" style={{ margin: 0 }} />
                    <Field
                      label="2ª categoría"
                      error={tried2 ? (cat2Err ?? undefined) : undefined}
                    >
                      {!mate2Ready ? (
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
                          Completa los puntos de tu compañero para ver en qué
                          categorías podéis jugar.
                        </p>
                      ) : cat2Options.length === 0 ? (
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
                          Con este compañero no entráis en otra categoría del torneo.
                        </p>
                      ) : (
                        <div
                          role="radiogroup"
                          aria-label="Segunda categoría"
                          style={{ display: "flex", flexDirection: "column", gap: 8 }}
                        >
                          {cat2Options.map((c) => (
                            <RadioCard
                              key={c}
                              on={category2 === c}
                              onClick={() => setCategory2(c)}
                              title={c}
                            >
                              {describeThreshold(categoryRules, c, genderDb)}
                            </RadioCard>
                          ))}
                        </div>
                      )}
                    </Field>
                    {tried2 && category2 && elig2 && (
                      <div className="field-error">{elig2}</div>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <Btn onClick={goBack}>Atrás</Btn>
            {genderErr || noneEligible ? (
              <Btn variant="accent" size="lg" onClick={goBack}>
                Volver al paso 1
              </Btn>
            ) : (
              <Btn variant="accent" size="lg" onClick={goStep3}>
                Elegir horario {nextArrow}
              </Btn>
            )}
          </div>
        </>
      )}

      {/* ─────────────── PASO 3 · Horario y pago ─────────────── */}
      {step === 3 && (
        <>
          {/* Disponibilidad — solo si el torneo tiene fechas reales. */}
          {availDays.length > 0 && (
            <AvailabilityGrid
              days={availDays}
              slots={slots}
              blocked={blocked}
              cap={removeCap}
              onToggle={toggleSlot}
            />
          )}

          {/* Género (división) + elegibilidad: avisos persistentes. Bloquean
              el botón (red de seguridad: los pasos anteriores ya lo filtran). */}
          {(genderErr || elig1 || (category2 && elig2)) && (
            <Note tone="warning" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
              {genderErr && <div>{genderErr}</div>}
              {elig1 && <div style={{ marginTop: genderErr ? 4 : 0 }}>1ª categoría · {elig1}</div>}
              {category2 && elig2 && (
                <div style={{ marginTop: genderErr || elig1 ? 4 : 0 }}>
                  2ª categoría · {elig2}
                </div>
              )}
            </Note>
          )}

          {/* Condiciones: una línea con la casilla (siempre visible) y un
              enlace para desplegar el texto. */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={termsOk}
                  onChange={(e) => setTermsOk(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                />
                Acepto las condiciones del torneo
              </label>
              {termsText && (
                <LinkBtn onClick={() => setTermsOpen((v) => !v)}>
                  {termsOpen ? "Ocultar" : "Leer condiciones"}
                </LinkBtn>
              )}
            </div>
            {termsText && termsOpen && (
              <Note style={{ marginTop: 10 }}>
                <span style={{ display: "block", whiteSpace: "pre-line" }}>{termsText}</span>
              </Note>
            )}
            {!termsText && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
                No hemos podido cargar el texto de las condiciones. Si tienes
                dudas, pregunta al club antes de inscribirte.
              </p>
            )}
          </div>

          {signErr && (
            <Note tone="error" icon={<IconAlert size={15} />} style={{ marginBottom: 12 }}>
              {signErr}
            </Note>
          )}

          {/* Desglose: la cuota es POR PERSONA (según cuántas categorías juega
              cada uno) y tú pagas por todos. */}
          {feePer > 0 && (
            <Card flush style={{ marginBottom: 12 }}>
              <CardHead
                title="Cuota de inscripción"
                sub="Al inscribirte pagas por todos los jugadores."
              />
              <div className="card-body">
                {pricing.persons.length > 0 ? (
                  <>
                    <dl className="kv" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                      {pricing.persons.map((p, i) => (
                        <Fragment key={`${p.name}-${i}`}>
                          <dt>
                            {p.name}
                            <span style={{ color: "var(--text-faint)" }}>
                              {" · "}
                              {p.categories >= 2 ? "2 categorías" : "1 categoría"}
                            </span>
                          </dt>
                          <dd className="mono" style={{ textAlign: "right" }}>
                            {formatFee(p.feeCents / 100, feeCur)}
                          </dd>
                        </Fragment>
                      ))}
                    </dl>
                    <div className="divider" style={{ margin: "12px 0" }} />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                        Total · {pricing.persons.length} jugadores
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}
                      >
                        {formatFee(feeTotal, feeCur)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13.5 }}>
                    Cuota por persona:{" "}
                    <span className="mono">
                      {formatFee(feePer, feeCur)}
                    </span>{" "}
                    (1 categoría)
                    {entryFee2 ? (
                      <>
                        {" · "}
                        <span className="mono">
                          {formatFee(entryFee2, feeCur)}
                        </span>{" "}
                        (2 categorías)
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
          )}

          {(real?.entry_fee ?? 0) <= 0 ? (
            /* Torneo gratis: un único botón de inscripción. */
            <Btn
              variant="accent"
              size="lg"
              block
              disabled={busy || name.trim().length < 3 || eligBlocked}
              onClick={() => submitSignup(false)}
            >
              {busy ? "Inscribiendo…" : "Apuntarme al torneo"}
            </Btn>
          ) : payOnline === null ? (
            /* Comprobando si el club cobra online. */
            <Btn variant="accent" size="lg" block disabled>
              Comprobando forma de pago…
            </Btn>
          ) : payOnline ? (
            /* Club con pago online: Stripe (principal) + pagar en el club. */
            <>
              <Btn
                variant="accent"
                size="lg"
                block
                disabled={busy || name.trim().length < 3 || eligBlocked}
                onClick={() => submitSignup(false)}
              >
                {busy
                  ? "Inscribiendo…"
                  : `Pagar inscripción · ${formatFee(feeTotal, feeCur)}`}
              </Btn>
              <Btn
                block
                disabled={busy || name.trim().length < 3 || eligBlocked}
                onClick={() => submitSignup(true)}
                style={{ marginTop: 8 }}
              >
                Pagar en el club (efectivo)
              </Btn>
            </>
          ) : (
            /* Club SIN pago online: solo se puede pagar en el club. */
            <>
              <Btn
                variant="accent"
                size="lg"
                block
                disabled={busy || name.trim().length < 3 || eligBlocked}
                onClick={() => submitSignup(true)}
              >
                {busy
                  ? "Inscribiendo…"
                  : `Inscribirme · pago en el club (${formatFee(feeTotal, feeCur)})`}
              </Btn>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 12.5,
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

          <div style={{ marginTop: 16 }}>
            <Btn variant="quiet" onClick={goBack} disabled={busy}>
              Atrás
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
