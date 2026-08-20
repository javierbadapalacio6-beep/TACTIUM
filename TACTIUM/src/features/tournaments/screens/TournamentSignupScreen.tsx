import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { displayNameOf } from '@core/utils/format';
import { toast } from '@store/toastStore';
import {
  signupByCode,
  lookupTournament,
  formatFee,
  getRegistrationPartnerCode,
  sendPartnerInviteEmail,
  checkCategoryEligibility,
  resolveCategoryThreshold,
  hourlyFranjas,
  type TournamentLookup,
} from '@core/services/tournaments';
import { resolveFcpPlayer, type FcpPlayerMatch } from '@core/services/fcpSearch';
import { Share } from 'react-native';

import type { RootStackScreenProps } from '@navigation/types';

// Disponibilidad: rejilla día × franja horaria. El jugador marca todas las
// casillas (día + hora) en las que puede jugar, para que el club vea cuándo
// encajar sus partidos. Se guarda como texto legible: "Sáb 18:00–21:00".
const DOW = [1, 2, 3, 4, 5, 6, 7];
const DOW_SHORT = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DOW_FULL = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FRANJAS = [
  '9:00–12:00',
  '12:00–15:00',
  '15:00–18:00',
  '18:00–21:00',
  '21:00–00:00',
];
const slotStr = (dow: number, franja: string) => `${DOW_FULL[dow]} ${franja}`;

// Días concretos del torneo (índice = getDay(): 0=Dom … 6=Sáb).
const DOW_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW_NAME = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const FRANJA_SHORT: Record<string, string> = {
  '9:00–12:00': '9-12',
  '12:00–15:00': '12-15',
  '15:00–18:00': '15-18',
  '18:00–21:00': '18-21',
  '21:00–00:00': '21-0',
};
const parseIsoDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// Etiqueta de una casilla concreta del torneo: "Vie 24 18:00–21:00".
const daySlot = (label: string, franja: string) => `${label} ${franja}`;

interface TDay {
  label: string; // "Vie 24"
  full: string; // "Viernes 24"
}

const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};

export const TournamentSignupScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'TournamentSignup'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [code, setCode] = useState(route.params?.code ?? '');
  const [found, setFound] = useState<TournamentLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  // 2ª categoría OPCIONAL: el jugador puede apuntarse a una segunda categoría
  // con OTRO compañero. El precio pasa a la cuota de 2 categorías.
  const [category2, setCategory2] = useState<string | null>(null);
  const [p2b, setP2b] = useState('');
  const [p2bEmail, setP2bEmail] = useState('');
  const [p2bPts, setP2bPts] = useState('');
  const [p2bLvl, setP2bLvl] = useState('');
  const [p1, setP1] = useState(user ? displayNameOf(user) : '');
  const [p1Email, setP1Email] = useState(
    (user?.email as string | undefined) ?? '',
  );
  const [p1Phone, setP1Phone] = useState('');
  const [p2, setP2] = useState('');
  const [p2Email, setP2Email] = useState('');
  const [p1Pts, setP1Pts] = useState('');
  const [p2Pts, setP2Pts] = useState('');
  const [p1Lvl, setP1Lvl] = useState('');
  const [p2Lvl, setP2Lvl] = useState('');
  // "No juega federado": sus puntos y nivel cuentan como 0 (no tiene ficha FCP).
  const [p1NoFed, setP1NoFed] = useState(false);
  const [p2NoFed, setP2NoFed] = useState(false);
  const [p2bNoFed, setP2bNoFed] = useState(false);
  // Franjas de 1h que el jugador marca que NO puede (por día). Por defecto vacío
  // = disponible a cualquier hora.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Pantalla de éxito: un código de compañero por cada inscripción (1 o 2).
  const [done, setDone] = useState<
    { cat: string | null; partner: string; code: string; emailedTo: string | null }[] | null
  >(null);

  // Días concretos del torneo (del inicio al fin).
  const tDays = useMemo<TDay[]>(() => {
    if (!found?.starts_on) return [];
    const start = parseIsoDate(found.starts_on);
    const end = found.ends_on ? parseIsoDate(found.ends_on) : start;
    const out: TDay[] = [];
    const d = new Date(start);
    let guard = 0;
    while (d.getTime() <= end.getTime() && guard < 31) {
      const dow = d.getDay();
      const num = d.getDate();
      out.push({ label: `${DOW_ABBR[dow]} ${num}`, full: `${DOW_NAME[dow]} ${num}` });
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return out;
  }, [found]);

  // Disponibilidad por FRANJAS DE 1H: el jugador marca las horas que NO puede,
  // hasta el tope que fije el club. Por defecto disponible en todas.
  const slots = useMemo(
    () => hourlyFranjas(found?.start_time, found?.end_time),
    [found?.start_time, found?.end_time],
  );
  const removeCap = found?.max_removable_hours ?? null;
  const keyOf = (dayLabel: string, from: number) => `${dayLabel}#${from}`;
  const toggleRemoved = (dayLabel: string, from: number) => {
    const k = keyOf(dayLabel, from);
    setRemoved((prev) => {
      const n = new Set(prev);
      if (n.has(k)) {
        n.delete(k);
        return n;
      }
      if (removeCap != null && n.size >= removeCap) {
        toast.error(
          `Máximo ${removeCap} ${removeCap === 1 ? 'hora' : 'horas'}`,
          'No puedes quitar más franjas en este torneo.',
        );
        return prev;
      }
      n.add(k);
      return n;
    });
  };
  // Lo que se guarda: las franjas que el jugador NO puede (las que marcó en
  // rojo). Vacío = puede a cualquier hora. Guardar directamente las "no puede"
  // (en vez del complemento) permite excluir un día ENTERO sin ambigüedad.
  const availability = useMemo<string[]>(() => {
    if (removed.size === 0 || tDays.length === 0) return [];
    const out: string[] = [];
    for (const day of tDays)
      for (const s of slots)
        if (removed.has(keyOf(day.label, s.from))) out.push(`${day.label} ${s.label}`);
    return out;
  }, [removed, tDays, slots]);

  const doLookup = async () => {
    if (code.trim().length < 4) {
      toast.error('Escribe el código del torneo');
      return;
    }
    setLooking(true);
    try {
      const t = await lookupTournament(code);
      if (!t) {
        setFound(null);
        toast.error('No encontrado', 'Revisa el código o la inscripción está cerrada.');
        return;
      }
      setFound(t);
      setGender(t.genders.length === 1 ? t.genders[0] : null);
      setCategory(t.categories.length === 1 ? t.categories[0] : null);
      setCategory2(null);
    } catch (e: any) {
      toast.error('Error al buscar', e?.message ?? '');
    } finally {
      setLooking(false);
    }
  };

  // Si llegamos con el código precargado (desde Explorar/Seguir), busca el
  // torneo automáticamente para que se muestren género/categoría y el botón
  // de inscribirse funcione sin tener que pulsar "Buscar".
  useEffect(() => {
    if (route.params?.code && !found) doLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsGender = (found?.genders.length ?? 0) > 0;
  const needsCategory = (found?.categories.length ?? 0) > 0;
  const isPair = found?.pair_based !== false;
  // Contribución de cada jugador (0 si NO es federado: sin ficha FCP → 0).
  const p1P = p1NoFed ? 0 : parseInt(p1Pts, 10) || 0;
  const p2P = p2NoFed ? 0 : parseInt(p2Pts, 10) || 0;
  const seedPoints = p1P + (isPair ? p2P : 0);
  // Reglas de categoría (nivel/puntos) del torneo.
  const rules = found?.category_rules ?? null;
  const usesNivel = !!rules && (rules.mode === 'nivel' || rules.mode === 'both');
  // Nivel "conocido" de un jugador = no federado (cuenta 0) o introducido.
  const p1NivKnown = p1NoFed || !!p1Lvl.trim();
  const p2NivKnown = p2NoFed || !!p2Lvl.trim();
  const nivelEntered = p1NivKnown && (!isPair || p2NivKnown);
  const p1Niv = p1NoFed ? 0 : parseInt(p1Lvl, 10) || 0;
  const p2Niv = p2NoFed ? 0 : parseInt(p2Lvl, 10) || 0;
  const leagueSum = nivelEntered ? p1Niv + (isPair ? p2Niv : 0) : null;

  // ── Detección automática de categoría ────────────────────────────────
  // Con los puntos/nivel de la pareja + las reglas del torneo, deducimos en
  // qué categorías encajáis (el jugador no tiene que interpretar las normas).
  const ptsEntered = (p1NoFed || !!p1Pts.trim()) && (!isPair || p2NoFed || !!p2Pts.trim());
  const canDetectCat = useMemo(() => {
    if (!rules) return false;
    const needPts = rules.mode === 'points' || rules.mode === 'both';
    const needNiv = rules.mode === 'nivel' || rules.mode === 'both';
    return (!needPts || ptsEntered) && (!needNiv || nivelEntered);
  }, [rules, ptsEntered, nivelEntered]);
  const catElig = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const cat of found?.categories ?? [])
      map[cat] =
        checkCategoryEligibility(rules, cat, gender, ptsEntered ? seedPoints : null, leagueSum) ===
        null;
    return map;
  }, [found, rules, gender, ptsEntered, seedPoints, leagueSum]);
  const eligibleCats = useMemo(
    () => (found?.categories ?? []).filter((cat) => catElig[cat]),
    [found, catElig],
  );
  // Si con los datos solo encaja UNA categoría y no hay ninguna elegida, la
  // seleccionamos sola (la app "te dice" tu categoría).
  useEffect(() => {
    if (canDetectCat && !category && eligibleCats.length === 1) setCategory(eligibleCats[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canDetectCat, eligibleCats, category]);

  // ── 2ª categoría (compañero B) ───────────────────────────────────────
  // Solo se ofrece si el torneo tiene ≥2 categorías, es por parejas y ya se
  // eligió la 1ª. El compañero puede ser distinto al de la 1ª categoría.
  const hasSecondOption =
    !!found && (found.categories?.length ?? 0) >= 2 && isPair && !!category;
  const p2bP = p2bNoFed ? 0 : parseInt(p2bPts, 10) || 0;
  const seedPointsB = p1P + p2bP;
  const p2bNivKnown = p2bNoFed || !!p2bLvl.trim();
  const nivelEnteredB = p1NivKnown && p2bNivKnown;
  const leagueSumB = nivelEnteredB
    ? p1Niv + (p2bNoFed ? 0 : parseInt(p2bLvl, 10) || 0)
    : null;
  const catThresholdB = resolveCategoryThreshold(rules, category2, gender);
  const eligibilityErrorB = category2
    ? checkCategoryEligibility(
        rules,
        category2,
        gender,
        (p1NoFed || p1Pts.trim()) && (p2bNoFed || p2bPts.trim()) ? seedPointsB : null,
        leagueSumB,
      )
    : null;
  // Precio a pagar: cuota de 2 categorías si hay 2ª (fallback a 2× la de 1).
  const feeToPay = category2
    ? found?.entry_fee_2 ?? (found?.entry_fee != null ? found.entry_fee * 2 : null)
    : found?.entry_fee ?? null;
  // Texto del chip: estructura de precios (1 cat / 2 cats) o cuota única.
  const feeInfo = ((): string => {
    if (!found) return '';
    const oneFee = found.entry_fee;
    const twoFee = found.entry_fee_2 ?? (oneFee != null ? oneFee * 2 : null);
    const hasTwo = (found.categories?.length ?? 0) >= 2;
    if (!oneFee && !twoFee) return 'Inscripción gratuita';
    if (hasTwo && twoFee != null) {
      return `1 categoría ${oneFee ? formatFee(oneFee, found.fee_currency) : 'gratis'} · 2 categorías ${formatFee(twoFee, found.fee_currency)} · se paga en el club`;
    }
    return oneFee
      ? `Inscripción: ${formatFee(oneFee, found.fee_currency)} · se paga en el club`
      : 'Inscripción gratuita';
  })();
  // Rango de fechas legible del torneo ("Sáb 15 – Dom 16 ago").
  const datesLabel = useMemo(() => {
    if (!found?.starts_on) return null;
    const s = parseIsoDate(found.starts_on);
    const sLbl = `${DOW_ABBR[s.getDay()]} ${s.getDate()} ${MESES3[s.getMonth()]}`;
    if (!found.ends_on || found.ends_on === found.starts_on) return sLbl;
    const e = parseIsoDate(found.ends_on);
    return `${DOW_ABBR[s.getDay()]} ${s.getDate()} – ${DOW_ABBR[e.getDay()]} ${e.getDate()} ${MESES3[e.getMonth()]}`;
  }, [found]);

  // ── Auto-detección desde la Federación (por nombre) ──────────────────
  // Al escribir el nombre, buscamos al jugador en la FCP y ofrecemos rellenar
  // sus PUNTOS y su NIVEL (nº de división). Ayuda, no obligación: si no está
  // federado o el match no cuadra, se sigue metiendo a mano.
  const generoFilter: 'M' | 'F' | null =
    gender === 'masculino' ? 'M' : gender === 'femenino' ? 'F' : null;
  const [p1Matches, setP1Matches] = useState<FcpPlayerMatch[]>([]);
  const [p2Matches, setP2Matches] = useState<FcpPlayerMatch[]>([]);
  const [p2bMatches, setP2bMatches] = useState<FcpPlayerMatch[]>([]);
  const p1Req = useRef(0);
  const p2Req = useRef(0);
  const p2bReq = useRef(0);

  useEffect(() => {
    const name = p1.trim();
    if (name.length < 3) {
      setP1Matches([]);
      return;
    }
    const id = ++p1Req.current;
    const t = setTimeout(async () => {
      try {
        const m = await resolveFcpPlayer(name, { genero: generoFilter });
        if (p1Req.current === id) setP1Matches(m);
      } catch {
        if (p1Req.current === id) setP1Matches([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [p1, generoFilter]);

  useEffect(() => {
    const name = p2.trim();
    if (!isPair || name.length < 3) {
      setP2Matches([]);
      return;
    }
    const id = ++p2Req.current;
    const t = setTimeout(async () => {
      try {
        const m = await resolveFcpPlayer(name, { genero: generoFilter });
        if (p2Req.current === id) setP2Matches(m);
      } catch {
        if (p2Req.current === id) setP2Matches([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [p2, isPair, generoFilter]);

  useEffect(() => {
    const name = p2b.trim();
    if (!isPair || !category2 || name.length < 3) {
      setP2bMatches([]);
      return;
    }
    const id = ++p2bReq.current;
    const t = setTimeout(async () => {
      try {
        const m = await resolveFcpPlayer(name, { genero: generoFilter });
        if (p2bReq.current === id) setP2bMatches(m);
      } catch {
        if (p2bReq.current === id) setP2bMatches([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [p2b, isPair, category2, generoFilter]);

  const applyMatchB = (m: FcpPlayerMatch) => {
    if (m.puntos != null) setP2bPts(String(m.puntos));
    if (m.nivel != null) setP2bLvl(String(m.nivel));
    setP2bMatches([]);
  };

  const applyMatch = (who: 1 | 2, m: FcpPlayerMatch) => {
    if (who === 1) {
      if (m.puntos != null) setP1Pts(String(m.puntos));
      if (m.nivel != null) setP1Lvl(String(m.nivel));
      setP1Matches([]);
    } else {
      if (m.puntos != null) setP2Pts(String(m.puntos));
      if (m.nivel != null) setP2Lvl(String(m.nivel));
      setP2Matches([]);
    }
  };
  const catThreshold = resolveCategoryThreshold(rules, category, gender);
  const eligibilityError = checkCategoryEligibility(
    rules,
    category,
    gender,
    (p1NoFed || p1Pts.trim()) ? seedPoints : null,
    leagueSum,
  );
  const valid =
    !!found &&
    !!p1.trim() &&
    (p1NoFed || !!p1Pts.trim()) &&
    !!p1Phone.trim() &&
    (!isPair || (!!p2.trim() && (p2NoFed || !!p2Pts.trim()))) &&
    (!needsGender || !!gender) &&
    (!needsCategory || !!category) &&
    !eligibilityError &&
    // Si eligió 2ª categoría, su compañero y puntos + elegibilidad OK.
    (!category2 || (!!p2b.trim() && (p2bNoFed || !!p2bPts.trim()) && !eligibilityErrorB));

  const save = async () => {
    if (!found) {
      toast.error('Busca primero el torneo con su código');
      return;
    }
    // Torneo con CUOTA → el pago es web-first (Apple 3.1.3: la app no puede
    // cobrar servicios del mundo real por métodos ajenos a IAP dentro de la app,
    // pero sí comunicarlos fuera). Se abre la ficha de pago en el navegador; allí
    // la pareja rellena, paga y queda inscrita. La BD además bloquea la
    // inscripción gratuita en estos torneos.
    if ((found.entry_fee ?? 0) > 0) {
      Linking.openURL(
        `https://app.tactium.io/torneos/${found.id}/inscripcion`,
      ).catch(() => toast.error('No se pudo abrir la ficha de pago'));
      return;
    }
    if (needsGender && !gender) {
      toast.error('Elige tu género');
      return;
    }
    if (needsCategory && !category) {
      toast.error('Elige tu categoría');
      return;
    }
    if (
      !p1.trim() ||
      (!p1NoFed && !p1Pts.trim()) ||
      (isPair && (!p2.trim() || (!p2NoFed && !p2Pts.trim())))
    ) {
      toast.error('Rellena nombres y puntos (o marca "no federado")');
      return;
    }
    if (!p1Phone.trim()) {
      toast.error('El teléfono es obligatorio');
      return;
    }
    if (eligibilityError) {
      toast.error('No cumplís los requisitos de la categoría', eligibilityError);
      return;
    }
    if (category2) {
      if (!p2b.trim() || (!p2bNoFed && !p2bPts.trim())) {
        toast.error('Rellena el compañero y sus puntos de la 2ª categoría');
        return;
      }
      if (eligibilityErrorB) {
        toast.error('No cumplís los requisitos de la 2ª categoría', eligibilityErrorB);
        return;
      }
    }
    setSaving(true);
    try {
      // Inscribe UNA categoría con su compañero; devuelve el código de compañero
      // (o null si es individual o no se pudo recuperar).
      const signupOne = async (
        cat: string | null,
        partnerName: string,
        partnerEmail: string,
        seed: number,
        league: number | null,
      ) => {
        const regId = await signupByCode({
          code,
          gender,
          category: cat,
          p1Name: p1,
          p1Email: p1Email || undefined,
          p1Phone: p1Phone || undefined,
          p2Name: isPair ? partnerName : '',
          p2Email: isPair ? partnerEmail || undefined : undefined,
          seedPoints: seed,
          leagueSum: league,
          availability,
        });
        if (!isPair) return null;
        const partnerCode = await getRegistrationPartnerCode(regId).catch(() => null);
        let emailedTo: string | null = null;
        if (partnerCode && partnerEmail.trim()) {
          const ok = await sendPartnerInviteEmail({
            toEmail: partnerEmail.trim(),
            toName: partnerName.trim() || null,
            fromName: p1.trim() || 'Tu compañero',
            tournamentName: found?.name ?? 'el torneo',
            code: partnerCode,
          });
          if (ok) emailedTo = partnerEmail.trim();
        }
        return partnerCode
          ? { cat, partner: partnerName.trim(), code: partnerCode, emailedTo }
          : null;
      };

      const results: {
        cat: string | null;
        partner: string;
        code: string;
        emailedTo: string | null;
      }[] = [];
      const r1 = await signupOne(category, p2, p2Email, seedPoints, leagueSum);
      if (r1) results.push(r1);
      if (category2) {
        const r2 = await signupOne(category2, p2b, p2bEmail, seedPointsB, leagueSumB);
        if (r2) results.push(r2);
      }

      if (!isPair || results.length === 0) {
        toast.success('¡Inscripción hecha!', 'El club te confirmará el cuadro.');
        navigation.goBack();
        return;
      }
      setDone(results);
    } catch (e: any) {
      toast.error('No se pudo inscribir', e?.message ?? 'Revisa el código.');
    } finally {
      setSaving(false);
    }
  };

  const shareCode = async () => {
    if (!done || done.length === 0) return;
    const lines = done
      .map((d) => `${d.cat ? d.cat + ': ' : ''}${d.partner || 'tu pareja'} → código ${d.code}`)
      .join('\n');
    try {
      await Share.share({
        message: `🎾 Te he apuntado como pareja en "${found?.name ?? 'un torneo'}" (TACTIUM).\n${lines}\nVincula tu cuenta en la app: Torneos → "Tengo un código de compañero".`,
      });
    } catch {
      /* cancelado */
    }
  };

  if (done) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24, flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.successTick]}>✓</Text>
          <Text style={styles.successTitle}>¡Inscritos!</Text>
          <Text style={styles.successText}>
            {done.length > 1
              ? 'Te has apuntado a 2 categorías. Pásale a cada compañero/a su código para que vincule su cuenta y vea el torneo.'
              : 'El club os confirmará el cuadro. Pásale este código a tu compañero/a para que vincule su cuenta y vea el torneo en su app.'}
          </Text>

          {done.map((d, i) => (
            <View key={i} style={styles.codeBigCard}>
              <Text style={styles.codeBigLabel}>
                CÓDIGO DE COMPAÑERO{d.cat ? ` · ${d.cat}` : ''}
              </Text>
              <Text style={styles.codeBig}>{d.code}</Text>
              <Text style={[styles.successText, { marginTop: 6 }]}>
                {d.partner || 'Tu pareja'}
                {d.emailedTo ? ` · 📧 ${d.emailedTo}` : ''}
              </Text>
            </View>
          ))}

          <Pressable onPress={shareCode} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>
              Compartir {done.length > 1 ? 'códigos' : 'código'}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Hecho</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>TORNEO</Text>
          <Text style={styles.title}>Apuntarme</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>CÓDIGO DEL TORNEO</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.input, { flex: 1 }]}>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase().replace(/\s/g, ''));
                setFound(null);
              }}
              placeholder="ABC123"
              placeholderTextColor={c.textFaint}
              style={[styles.inputField, { fontFamily: Fonts.mono, letterSpacing: 3 }]}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>
          <Pressable
            onPress={doLookup}
            disabled={looking}
            style={({ pressed }) => [styles.lookupBtn, pressed && { opacity: 0.85 }]}
          >
            {looking ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <Text style={styles.lookupText}>Buscar</Text>
            )}
          </Pressable>
        </View>

        {found ? (
          <View style={styles.foundCard}>
            <Text style={styles.foundName} numberOfLines={2}>{found.name}</Text>

            {/* Ficha ordenada del torneo */}
            <View style={styles.infoBox}>
              {datesLabel ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>FECHAS</Text>
                  <Text style={styles.infoValue}>{datesLabel}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>HORARIO</Text>
                <Text style={styles.infoValue}>
                  {(found.start_time || '09:00').slice(0, 5)}–{(found.end_time || '22:00').slice(0, 5)}
                </Text>
              </View>
              {found.genders.length ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>GÉNEROS</Text>
                  <Text style={styles.infoValue}>
                    {found.genders.map((g) => GENDER_LABEL[g] ?? g).join(' · ')}
                  </Text>
                </View>
              ) : null}
              {found.categories.length ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>CATEGORÍAS</Text>
                  <Text style={styles.infoValue}>{found.categories.join(' · ')}</Text>
                </View>
              ) : null}
              <View style={[styles.infoRow, styles.infoRowLast]}>
                <Text style={styles.infoLabel}>CUOTA</Text>
                <Text style={[styles.infoValue, { color: c.accent, fontWeight: '800' }]}>
                  {feeInfo}
                </Text>
              </View>
            </View>

            {found.genders.length > 0 ? (
              <>
                <Text style={styles.foundLabel}>ELIGE TU GÉNERO</Text>
                <View style={styles.catChips}>
                  {found.genders.map((g) => {
                    const sel = gender === g;
                    return (
                      <Pressable
                        key={g}
                        onPress={() => setGender(g)}
                        style={[
                          styles.catChip,
                          sel && { backgroundColor: c.accent, borderColor: c.accent },
                        ]}
                      >
                        <Text style={[styles.catChipText, { color: sel ? c.textInverse : c.text }]}>
                          {GENDER_LABEL[g] ?? g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {found.categories.length > 0 ? (
              <>
                <Text style={styles.foundLabel}>ELIGE TU CATEGORÍA</Text>
                <View style={styles.catChips}>
                  {found.categories.map((cat) => {
                    const sel = category === cat;
                    // Con datos suficientes, atenúa las categorías que no cumplís.
                    const dim = canDetectCat && !catElig[cat] && !sel;
                    const okMark = canDetectCat && catElig[cat] && !sel;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => {
                          setCategory(cat);
                          if (category2 === cat) setCategory2(null);
                        }}
                        style={[
                          styles.catChip,
                          sel && { backgroundColor: c.accent, borderColor: c.accent },
                          okMark && { borderColor: c.accent40 },
                          dim && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={[styles.catChipText, { color: sel ? c.textInverse : c.text }]}>
                          {cat}
                          {okMark ? ' ✓' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {canDetectCat ? (
                  <Text style={styles.detectHint}>
                    {eligibleCats.length
                      ? `Según vuestros ${
                          rules?.mode === 'nivel' ? 'niveles' : rules?.mode === 'points' ? 'puntos' : 'puntos y niveles'
                        }, podéis jugar: ${eligibleCats.join(' · ')}.`
                      : 'Con esos datos no cumplís los requisitos de ninguna categoría.'}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.two}>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>TU NOMBRE</Text>
            <View style={styles.input}>
              <TextInput value={p1} onChangeText={setP1} placeholder="Tu nombre" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TUS PUNTOS</Text>
            <View style={[styles.input, p1NoFed && { opacity: 0.5 }]}>
              <TextInput
                value={p1NoFed ? '0' : p1Pts}
                onChangeText={(v) => setP1Pts(v.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor={c.textFaint}
                style={styles.inputField}
                keyboardType="number-pad"
                maxLength={6}
                editable={!p1NoFed}
              />
            </View>
          </View>
        </View>
        {p1NoFed ? null : (
          <FcpSuggest c={c} styles={styles} matches={p1Matches} onPick={(m) => applyMatch(1, m)} />
        )}
        <FedToggle noFed={p1NoFed} onToggle={() => setP1NoFed((v) => !v)} styles={styles} c={c} />

        <View style={styles.two}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TU EMAIL</Text>
            <View style={styles.input}>
              <TextInput value={p1Email} onChangeText={setP1Email} placeholder="opcional" placeholderTextColor={c.textFaint} style={styles.inputField} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TU TELÉFONO</Text>
            <View style={styles.input}>
              <TextInput value={p1Phone} onChangeText={setP1Phone} placeholder="obligatorio" placeholderTextColor={c.textFaint} style={styles.inputField} keyboardType="phone-pad" />
            </View>
          </View>
        </View>

        {isPair ? (
          <>
            <View style={styles.two}>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>TU COMPAÑERO/A</Text>
                <View style={styles.input}>
                  <TextInput value={p2} onChangeText={setP2} placeholder="Nombre de tu pareja" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SUS PUNTOS</Text>
                <View style={[styles.input, p2NoFed && { opacity: 0.5 }]}>
                  <TextInput
                    value={p2NoFed ? '0' : p2Pts}
                    onChangeText={(v) => setP2Pts(v.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={c.textFaint}
                    style={styles.inputField}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!p2NoFed}
                  />
                </View>
              </View>
            </View>
            {p2NoFed ? null : (
              <FcpSuggest c={c} styles={styles} matches={p2Matches} onPick={(m) => applyMatch(2, m)} />
            )}
            <FedToggle noFed={p2NoFed} onToggle={() => setP2NoFed((v) => !v)} styles={styles} c={c} />
            <Text style={styles.availHint}>
              Sumamos vuestros puntos ({seedPoints || 0}) para sembrar el cuadro.
            </Text>

            <Text style={styles.label}>EMAIL DE TU COMPAÑERO/A · OPCIONAL</Text>
            <View style={styles.input}>
              <TextInput
                value={p2Email}
                onChangeText={setP2Email}
                placeholder="para enviarle el código de acceso"
                placeholderTextColor={c.textFaint}
                style={styles.inputField}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={80}
              />
            </View>
            <Text style={styles.availHint}>
              Le llega un código para vincular su cuenta. Si no, se lo pasas tú al apuntarte.
            </Text>
          </>
        ) : (
          <Text style={styles.availHint}>Tus puntos sirven para sembrar el cuadro.</Text>
        )}

        {usesNivel ? (
          <>
            <View style={styles.two}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TU NIVEL DE LIGA</Text>
                <View style={[styles.input, p1NoFed && { opacity: 0.5 }]}>
                  <TextInput
                    value={p1NoFed ? '0' : p1Lvl}
                    onChangeText={(v) => setP1Lvl(v.replace(/[^0-9]/g, ''))}
                    placeholder="ej. 4"
                    placeholderTextColor={c.textFaint}
                    style={styles.inputField}
                    keyboardType="number-pad"
                    maxLength={2}
                    editable={!p1NoFed}
                  />
                </View>
              </View>
              {isPair ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>NIVEL DE TU PAREJA</Text>
                  <View style={[styles.input, p2NoFed && { opacity: 0.5 }]}>
                    <TextInput
                      value={p2NoFed ? '0' : p2Lvl}
                      onChangeText={(v) => setP2Lvl(v.replace(/[^0-9]/g, ''))}
                      placeholder="ej. 6"
                      placeholderTextColor={c.textFaint}
                      style={styles.inputField}
                      keyboardType="number-pad"
                      editable={!p2NoFed}
                      maxLength={2}
                    />
                  </View>
                </View>
              ) : null}
            </View>
            <Text style={styles.availHint}>
              Su división de liga (2ª → 2, 4ª → 4…).
              {isPair ? ` Suma: ${leagueSum ?? '—'}.` : ''}
            </Text>
          </>
        ) : null}

        {catThreshold ? (
          <Text style={styles.limitHint}>
            Requisito {category}:{' '}
            {[
              catThreshold.nivel != null &&
              (rules?.mode === 'nivel' || rules?.mode === 'both')
                ? `nivel ≥ ${catThreshold.nivel}`
                : null,
              catThreshold.puntos != null &&
              (rules?.mode === 'points' || rules?.mode === 'both')
                ? `puntos ≤ ${catThreshold.puntos}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
        {eligibilityError ? (
          <Text style={styles.eligibilityError}>⚠️ {eligibilityError}</Text>
        ) : null}

        {hasSecondOption && found ? (
          <View style={styles.secondCatBlock}>
            <Text style={styles.foundLabel}>¿APUNTARTE A UNA 2ª CATEGORÍA? · OPCIONAL</Text>
            <View style={styles.catChips}>
              {found.categories
                .filter((cat) => cat !== category)
                .map((cat) => {
                  const sel = category2 === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory2(sel ? null : cat)}
                      style={[
                        styles.catChip,
                        sel && { backgroundColor: c.accent, borderColor: c.accent },
                      ]}
                    >
                      <Text style={[styles.catChipText, { color: sel ? c.textInverse : c.text }]}>
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>

            {category2 ? (
              <>
                <View style={[styles.two, { marginTop: 4 }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>COMPAÑERO/A · {category2}</Text>
                    <View style={styles.input}>
                      <TextInput
                        value={p2b}
                        onChangeText={setP2b}
                        placeholder="Otro compañero (o el mismo)"
                        placeholderTextColor={c.textFaint}
                        style={styles.inputField}
                        maxLength={40}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>SUS PUNTOS</Text>
                    <View style={[styles.input, p2bNoFed && { opacity: 0.5 }]}>
                      <TextInput
                        value={p2bNoFed ? '0' : p2bPts}
                        onChangeText={(v) => setP2bPts(v.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        placeholderTextColor={c.textFaint}
                        style={styles.inputField}
                        keyboardType="number-pad"
                        maxLength={6}
                        editable={!p2bNoFed}
                      />
                    </View>
                  </View>
                </View>
                {p2bNoFed ? null : (
                  <FcpSuggest c={c} styles={styles} matches={p2bMatches} onPick={applyMatchB} />
                )}
                <FedToggle noFed={p2bNoFed} onToggle={() => setP2bNoFed((v) => !v)} styles={styles} c={c} />

                {usesNivel ? (
                  <View style={styles.two}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>SU NIVEL DE LIGA</Text>
                      <View style={[styles.input, p2bNoFed && { opacity: 0.5 }]}>
                        <TextInput
                          value={p2bNoFed ? '0' : p2bLvl}
                          onChangeText={(v) => setP2bLvl(v.replace(/[^0-9]/g, ''))}
                          placeholder="ej. 6"
                          placeholderTextColor={c.textFaint}
                          style={styles.inputField}
                          keyboardType="number-pad"
                          maxLength={2}
                          editable={!p2bNoFed}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1 }} />
                  </View>
                ) : null}

                <Text style={styles.label}>EMAIL DE TU COMPAÑERO/A · OPCIONAL</Text>
                <View style={styles.input}>
                  <TextInput
                    value={p2bEmail}
                    onChangeText={setP2bEmail}
                    placeholder="para enviarle el código"
                    placeholderTextColor={c.textFaint}
                    style={styles.inputField}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    maxLength={80}
                  />
                </View>

                {catThresholdB ? (
                  <Text style={[styles.limitHint, { marginTop: 8 }]}>
                    Requisito {category2}:{' '}
                    {[
                      catThresholdB.nivel != null &&
                      (rules?.mode === 'nivel' || rules?.mode === 'both')
                        ? `nivel ≥ ${catThresholdB.nivel}`
                        : null,
                      catThresholdB.puntos != null &&
                      (rules?.mode === 'points' || rules?.mode === 'both')
                        ? `puntos ≤ ${catThresholdB.puntos}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                {eligibilityErrorB ? (
                  <Text style={styles.eligibilityError}>⚠️ {eligibilityErrorB}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.label}>DISPONIBILIDAD</Text>
        {tDays.length === 0 ? (
          <Text style={styles.availHint}>
            Sin fechas aún · te apuntas disponible a cualquier hora.
          </Text>
        ) : (
          <>
            <Text style={styles.availHint}>
              Marca en rojo las franjas que{' '}
              <Text style={{ fontWeight: '800', color: c.text }}>NO</Text> puedes.
              {removeCap != null ? ` (máx ${removeCap} · ${removed.size}/${removeCap})` : ''}
            </Text>
            {tDays.map((day) => (
              <View key={day.label} style={styles.franjaBlock}>
                <Text style={styles.franjaLabel}>{day.full}</Text>
                <View style={styles.hourGrid}>
                  {slots.map((s) => {
                    const off = removed.has(keyOf(day.label, s.from));
                    return (
                      <Pressable
                        key={s.from}
                        onPress={() => toggleRemoved(day.label, s.from)}
                        style={[
                          styles.hourCell,
                          off && { backgroundColor: c.error, borderColor: c.error },
                        ]}
                      >
                        <Text
                          style={[styles.hourCellText, { color: off ? c.textInverse : c.text }]}
                          numberOfLines={1}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {found && feeToPay != null && feeToPay > 0 ? (
          <Text style={styles.payLine}>
            A pagar: {formatFee(feeToPay, found.fee_currency)}
            {category2 ? ' · 2 categorías' : ''} · en el club
          </Text>
        ) : null}
        <Pressable
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            // En torneos con cuota el botón va a la web (no valida el formulario
            // local), así que no se atenúa por `valid`.
            ((!valid && !((found?.entry_fee ?? 0) > 0)) || saving) && {
              opacity: 0.5,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>
              {(found?.entry_fee ?? 0) > 0
                ? `Pagar inscripción · ${found?.entry_fee} ${found?.fee_currency ?? '€'}`
                : 'Apuntarme al torneo'}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

// Sugerencias de la Federación bajo el nombre: candidatos con sus puntos y
// nivel; al tocar uno se autocompletan los campos. Si hay ambigüedad de nombre,
// se muestran varios para elegir la persona correcta.
// Check "no juega federado": pone a 0 los puntos y el nivel de ese jugador.
const FedToggle: React.FC<{
  noFed: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}> = ({ noFed, onToggle, styles, c }) => (
  <Pressable onPress={onToggle} hitSlop={6} style={styles.fedToggle}>
    <View style={[styles.fedBox, noFed && { backgroundColor: c.accent, borderColor: c.accent }]}>
      {noFed ? <Text style={styles.fedCheck}>✓</Text> : null}
    </View>
    <Text style={styles.fedLabel}>No juega federado (cuenta 0 puntos y nivel)</Text>
  </Pressable>
);

const FcpSuggest: React.FC<{
  c: Palette;
  styles: ReturnType<typeof makeStyles>;
  matches: FcpPlayerMatch[];
  onPick: (m: FcpPlayerMatch) => void;
}> = ({ c, styles, matches, onPick }) => {
  if (matches.length === 0) return null;
  return (
    <View style={styles.suggestWrap}>
      <Text style={styles.suggestLabel}>
        {matches.length > 1 ? 'FEDERACIÓN · ¿QUIÉN ERES?' : 'DETECTADO EN LA FEDERACIÓN'}
      </Text>
      <View style={styles.suggestRow}>
        {matches.slice(0, 3).map((m) => (
          <Pressable
            key={m.idJugador}
            onPress={() => onPick(m)}
            style={({ pressed }) => [styles.suggestChip, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.suggestName} numberOfLines={1}>{m.name}</Text>
            <Text style={styles.suggestMeta} numberOfLines={1}>
              {[
                m.equipo,
                m.puntos != null ? `${m.puntos} pts` : null,
                m.categoriaDiv ? `nivel ${m.nivel} (${m.categoriaDiv})` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.suggestHint}>Toca para autorrellenar.</Text>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    suggestWrap: {
      marginTop: 2,
      marginBottom: 12,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 10,
    },
    suggestLabel: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 1.4,
      color: c.accent,
      fontWeight: '700',
    },
    suggestRow: { gap: 8 },
    suggestChip: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    suggestName: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    suggestMeta: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11.5, marginTop: 4 },
    suggestHint: { color: c.textFaint, fontSize: 11, marginTop: 2 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 16,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputField: { color: c.text, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
    two: { flexDirection: 'row', gap: 12 },
    lookupBtn: {
      paddingHorizontal: 18,
      minHeight: 50,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lookupText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    foundCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    foundName: { color: c.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
    foundMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    infoBox: {
      marginTop: 12,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderColor: c.hair,
    },
    infoRowLast: { borderBottomWidth: 0 },
    infoLabel: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1,
      color: c.textFaint,
      fontWeight: '700',
      width: 92,
      paddingTop: 1,
    },
    infoValue: { flex: 1, minWidth: 0, color: c.text, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
    feeChip: {
      marginTop: 10,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 9999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    feeChipText: { color: c.accent, fontSize: 12.5, fontWeight: '800' },
    successTick: {
      color: c.accent,
      fontSize: 46,
      fontWeight: '900',
      textAlign: 'center',
      marginBottom: 4,
    },
    successTitle: {
      color: c.text,
      fontSize: 26,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    successText: {
      color: c.textMuted,
      fontSize: 14.5,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 10,
    },
    codeBigCard: {
      marginTop: 20,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent40,
      borderRadius: 18,
      paddingVertical: 22,
      alignItems: 'center',
    },
    codeBigLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      letterSpacing: 2,
    },
    codeBig: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: 8,
      marginTop: 8,
    },
    primaryBtn: {
      marginTop: 22,
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    primaryBtnText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
    secondaryBtn: { marginTop: 10, paddingVertical: 14, alignItems: 'center' },
    secondaryBtnText: { color: c.textMuted, fontSize: 15, fontWeight: '700' },
    foundLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 14,
      marginBottom: 8,
    },
    catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 10,
      marginBottom: 14,
    },
    fedBox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fedCheck: { color: c.textInverse, fontSize: 12, fontWeight: '900' },
    fedLabel: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    detectHint: {
      color: c.accent,
      fontSize: 12.5,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 10,
    },
    secondCatBlock: {
      marginTop: 16,
      padding: 14,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent25,
      gap: 4,
    },
    payLine: {
      color: c.accent,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 10,
    },
    catChip: {
      paddingHorizontal: 16,
      height: 42,
      borderRadius: Radius.md,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catChipText: { fontSize: 15, fontWeight: '700' },
    availHint: { color: c.textMuted, fontSize: 12, marginTop: -2, marginBottom: 10, lineHeight: 17 },
    limitHint: {
      color: c.accent,
      fontSize: 12.5,
      fontWeight: '700',
      marginTop: -2,
      marginBottom: 8,
    },
    eligibilityError: {
      color: c.error,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 10,
      lineHeight: 18,
    },
    anytimeBtn: {
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    anytimeText: { fontSize: 14, fontWeight: '700' },
    franjaBlock: { marginBottom: 12 },
    franjaLabel: {
      fontFamily: Fonts.mono,
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
    },
    dayRow: { flexDirection: 'row', gap: 6 },
    hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    hourCell: {
      width: 86,
      height: 38,
      borderRadius: Radius.sm,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hourCellText: { fontFamily: Fonts.mono, fontSize: 11.5, fontWeight: '700' },
    dayCell: {
      flex: 1,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
    footer: {
      paddingHorizontal: 22,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.background,
    },
    saveBtn: { height: 52, borderRadius: Radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  });
