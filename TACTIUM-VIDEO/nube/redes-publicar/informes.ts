// informes.ts · lógica PURA de los informes de Instagram para Telegram (sin red ni Deno).
// La usa `index.ts` (función `redes-publicar`) y se prueba en local con `node probar-informes.mts`.
//
// Un informe distinto por formato, porque cada formato se gana de una forma:
//   · REEL      → retención (los 3 primeros segundos), reparto y que se comparta.
//   · CARRUSEL  → que se guarde y se comparta, y que se deslice (no solo la portada).
//   · POST      → igual que el carrusel, sin deslizar.
//   · HISTORIA  → salidas, toques adelante/atrás y respuestas (conversación).
// Y todos miran lo que importa para CRECER: seguidores ganados y visitas al perfil.

export type Formato = "reel" | "carrusel" | "post" | "story";
export type Metricas = Record<string, number>;

/** Medianas de las últimas piezas del MISMO formato (para decir si va bien o mal). */
export interface Ref {
  n: number;
  views: number;
  reach: number;
  saved: number;
  shares: number;
  watch: number;
  follows: number;
}

export const ETIQUETA: Record<Formato, string> = { reel: "REEL", carrusel: "CARRUSEL", post: "POST", story: "HISTORIA" };

/* ── Formato de números ─────────────────────────────────────────────── */

// es-ES no separa los miles en números de 4 cifras («2036»): se hace a mano.
export const num = (x: number) => String(Math.round(x || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const dec = (x: number, d = 1) => (x || 0).toFixed(d).replace(".", ",");
export const seg = (ms: number) => `${dec((ms || 0) / 1000)} s`;
/** Tasa por cada 1.000 cuentas alcanzadas. */
export const mil = (x: number, reach: number) => (reach > 0 ? (x / reach) * 1000 : 0);
export const pct = (x: number, total: number) => (total > 0 ? (x / total) * 100 : 0);

export const mediana = (xs: number[]) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};

/** «⬆️ +394 %» / «⬇️ −32 %» / «≈ igual» respecto a la mediana. */
export function delta(v: number, ref: number): string {
  if (!ref) return "";
  const d = ((v - ref) / ref) * 100;
  if (Math.abs(d) < 8) return "≈ igual que tu mediana";
  return `${d > 0 ? "⬆️ +" : "⬇️ −"}${num(Math.abs(d))} % vs tu mediana (${num(ref)})`;
}

/** Medianas de varias piezas del mismo formato; con menos de 3 no hay referencia fiable. */
export function resumirRef(filas: Metricas[]): Ref | null {
  const f = filas.filter((m) => m && Number.isFinite(m.views));
  if (f.length < 3) return null;
  const col = (k: string) => mediana(f.map((m) => m[k]).filter((v) => v !== undefined));
  return {
    n: f.length,
    views: col("views"),
    reach: col("reach"),
    saved: col("saved"),
    shares: col("shares"),
    watch: col("ig_reels_avg_watch_time"),
    follows: col("follows"),
  };
}

const cuando = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/* ── Diagnóstico por formato ────────────────────────────────────────── */

export interface Diag {
  /** Una línea de titular con emoji. */
  titular: string;
  /** Lecturas concretas (máx. 4) con el número que las sostiene. */
  lecturas: string[];
  /** Qué hacer en la siguiente pieza. */
  siguiente: string;
}

function crecimiento(m: Metricas): string | null {
  if (m.follows === undefined && m.profile_visits === undefined) return null;
  const partes: string[] = [];
  if (m.follows !== undefined) partes.push(`${num(m.follows)} ${m.follows === 1 ? "seguidor nuevo" : "seguidores nuevos"}`);
  if (m.profile_visits !== undefined) partes.push(`${num(m.profile_visits)} visitas al perfil`);
  return partes.join(" · ");
}

export function diagnosticoReel(m: Metricas, ref: Ref | null): Diag {
  const watch = m.ig_reels_avg_watch_time || 0;
  const compMil = mil(m.shares, m.reach);
  const lecturas: string[] = [];
  let titular: string;
  let siguiente: string;

  if (watch < 3500) {
    titular = "❌ No engancha: la gente se va en los primeros 3 segundos";
    lecturas.push(`Retención: ${seg(watch)} de media. Por debajo de 3,5 s Instagram deja de repartirlo.`);
    siguiente = "Acción o frase fuerte en el primer fotograma, sin intro ni logo, y corta a ≤ 12 s.";
  } else if (ref && m.views >= ref.views * 1.5 && compMil >= 3) {
    titular = "🔥 Ganador: se reparte y se comparte";
    lecturas.push(`Se comparte ${dec(compMil)} veces por cada 1.000 cuentas: ese es el combustible.`);
    siguiente = "Haz otro con el mismo ángulo esta semana y a la misma hora; fija este en el perfil.";
  } else if (ref && m.views >= ref.views * 1.3) {
    titular = "✅ Por encima de tus reels";
    siguiente = "Repite formato y hora. Sube la tasa de compartidos con un cierre que invite a reenviarlo al grupo.";
  } else if (ref && m.views < ref.views * 0.7 && watch >= (ref.watch || 0)) {
    titular = "⚠️ Retiene bien pero Instagram lo ha repartido poco";
    lecturas.push("El problema no es el vídeo: es el tema o la hora. Compártelo en historias para empujarlo.");
    siguiente = "Mismo vídeo con otro tema de portada/primera frase, o publícalo de 19:00 a 20:00.";
  } else {
    titular = "➡️ En la media de tus reels";
    siguiente = "Cambia UNA variable en el siguiente (gancho, duración o tema) para aprender qué mueve la aguja.";
  }

  if (watch >= 3500) {
    lecturas.push(
      watch >= 7000
        ? `Retención de élite: ${seg(watch)} (objetivo 7 s).`
        : `Retención: ${seg(watch)}${ref?.watch ? ` (tu mediana ${seg(ref.watch)})` : ""}; el objetivo son 7 s.`,
    );
  }
  if (compMil <= 1 && m.reach > 300) {
    lecturas.push("Nadie lo reenvía: falta un motivo para mandarlo al grupo (humor, identificación o un dato de su liga).");
  }
  if ((m.comments || 0) === 0 && m.reach > 300) {
    lecturas.push("0 comentarios: cierra con una pregunta de dos opciones y responde a todos en la primera hora.");
  }
  if (m.follows === 0 && m.reach > 500) {
    lecturas.push("Alcanza pero no convierte: la última escena y la bio no dan motivo para seguir.");
  }
  return { titular, lecturas: lecturas.slice(0, 4), siguiente };
}

export function diagnosticoCarrusel(m: Metricas, ref: Ref | null, esCarrusel: boolean): Diag {
  const guardMil = mil(m.saved, m.reach);
  const compMil = mil(m.shares, m.reach);
  const profundidad = m.reach > 0 ? m.views / m.reach : 0; // vistas por cuenta ≈ cuánto desliza
  const lecturas: string[] = [];
  let titular: string;
  let siguiente: string;

  if (guardMil >= 10 || compMil >= 8) {
    titular = "🔥 Se guarda o se comparte: es contenido útil";
    siguiente = "Hazlo serie (uno por categoría o por grupo) y cierra con «guárdalo para la jornada 1».";
  } else if (ref && m.reach >= ref.reach * 1.3) {
    titular = "✅ Llega más que tus carruseles";
    siguiente = "Repite el tema; añade un dato que se pueda guardar (calendario, ranking, norma).";
  } else if (ref && m.reach < ref.reach * 0.7) {
    titular = "⚠️ Llega poco: la portada no está parando el dedo";
    siguiente = "Reescribe la portada con un dato local concreto («323 equipos, 41 grupos») en vez de una idea general.";
  } else {
    titular = "➡️ En la media";
    siguiente = "Cambia solo la portada en el siguiente y compara el alcance.";
  }

  lecturas.push(`Alcance ${num(m.reach)} cuentas${ref?.reach ? ` (tu mediana ${num(ref.reach)})` : ""}.`);
  if (esCarrusel && m.reach > 0) {
    lecturas.push(
      profundidad >= 1.5
        ? `La gente desliza: ${dec(profundidad)} vistas por cuenta.`
        : profundidad < 1.15
          ? `Se quedan en la portada (${dec(profundidad)} vistas por cuenta): lo de dentro no está cumpliendo lo que promete.`
          : `Deslizan algo (${dec(profundidad)} vistas por cuenta).`,
    );
  }
  lecturas.push(
    guardMil >= 10
      ? `Se guarda ${dec(guardMil)} por cada 1.000 cuentas: señal fuerte para el algoritmo.`
      : `Se guarda ${dec(guardMil)} por cada 1.000 (objetivo ≥ 10): hay que darle algo que merezca consultarse después.`,
  );
  if ((m.comments || 0) === 0 && m.reach > 150) lecturas.push("0 comentarios: acaba con una pregunta o un «¿en qué grupo estás?».");
  return { titular, lecturas: lecturas.slice(0, 4), siguiente };
}

export interface NavHistoria {
  adelante: number;
  atras: number;
  salidas: number;
  siguiente: number;
}

export function diagnosticoHistoria(m: Metricas, nav: NavHistoria | null): Diag {
  const views = m.views || 0;
  const lecturas: string[] = [];
  let titular = "➡️ Historia normal";
  let siguiente = "Usa un sticker (pregunta o encuesta) en la próxima: es lo único que convierte vistas en conversación.";

  if (nav && views > 0) {
    const sal = pct(nav.salidas, views);
    const atr = pct(nav.atras, views);
    const ade = pct(nav.adelante, views);
    lecturas.push(`Salidas ${dec(sal, 0)} % · toques adelante ${dec(ade, 0)} % · atrás ${dec(atr, 0)} %.`);
    if (sal >= 35) {
      titular = "❌ Pierde a la gente: demasiadas salidas";
      siguiente = "Acorta a 2–3 historias y pon lo importante en la primera; quita los textos largos.";
    } else if (atr >= 8) {
      titular = "🔥 Se relee: la gente vuelve atrás";
      siguiente = "Es contenido de consulta: guárdalo en una destacada.";
    } else if (sal < 15) {
      titular = "✅ Se ve de principio a fin";
    }
  }
  if ((m.replies || 0) > 0) {
    lecturas.push(`${num(m.replies)} respuestas: hay conversación. Contéstalas (cuentan para el algoritmo).`);
  } else if (views > 150) {
    lecturas.push("0 respuestas: sin sticker de pregunta no hay conversación.");
  }
  if ((m.shares || 0) > 0) lecturas.push(`${num(m.shares)} compartidas por mensaje directo.`);
  return { titular, lecturas: lecturas.slice(0, 4), siguiente };
}

export function diagnostico(f: Formato, m: Metricas, ref: Ref | null, nav: NavHistoria | null = null): Diag {
  if (f === "reel") return diagnosticoReel(m, ref);
  if (f === "story") return diagnosticoHistoria(m, nav);
  return diagnosticoCarrusel(m, ref, f === "carrusel");
}

/* ── Informe de una pieza ───────────────────────────────────────────── */

/**
 * Reel de prueba (solo lo ven quienes no te siguen): ¿se gradúa a seguidores? Reparte menos que un reel
 * normal (Mosseri), así que el listón de alcance es la mitad de la mediana; lo que decide es que
 * retenga y que se mande a amigos.
 */
export function decisionPrueba(m: Metricas, ref: Ref | null): { veredicto: "graduar" | "dudoso" | "descartar"; texto: string } {
  const watch = m.ig_reels_avg_watch_time || 0;
  const compMil = mil(m.shares, m.reach);
  const alcance = ref ? m.views >= ref.views * 0.5 : m.views >= 300;
  const puntos = [watch >= 5000, compMil >= 3, alcance].filter(Boolean).length;
  const datos = `retención ${seg(watch)}, ${dec(compMil)} envíos por 1.000, ${num(m.views)} visualizaciones`;
  if (puntos >= 2) {
    return { veredicto: "graduar", texto: `✅ GRADÚALO: ${datos}. En la app: Reels de prueba → Compartir con todos. Y mándalo tú a los grupos de los equipos.` };
  }
  if (puntos === 1) {
    return { veredicto: "dudoso", texto: `🟡 DUDOSO: ${datos}. Espera a las 72 h; si no mejora, descártalo y prueba el mismo tema con otro gancho.` };
  }
  return { veredicto: "descartar", texto: `🗑️ DESCÁRTALO: ${datos}. Archívalo (no llegó a tus seguidores, no se pierde nada) y prueba otro gancho mañana.` };
}

export function informePieza(o: {
  formato: Formato;
  pieza: string;
  titulo: string;
  publicada: Date;
  horas: number;
  m: Metricas;
  ref: Ref | null;
  nav?: NavHistoria | null;
  enlace?: string | null;
  /** Reel publicado como prueba (solo a no seguidores). */
  prueba?: boolean;
}): string {
  const { formato, m, ref } = o;
  const d = diagnostico(formato, m, ref, o.nav ?? null);
  const L: string[] = [];
  L.push(`📊 ${o.prueba ? "REEL DE PRUEBA 🧪" : ETIQUETA[formato]} · ${o.pieza} · ${o.titulo}`);
  L.push(`${cuando(o.publicada)} · informe a las ${o.horas} h`);
  L.push("");
  L.push(`ALCANCE: ${num(m.reach)} cuentas · ${num(m.views)} visualizaciones`);
  if (ref?.views) L.push(delta(m.views, ref.views) + ` (${ref.n} piezas)`);

  if (formato === "reel") {
    L.push(`RETENCIÓN: ${seg(m.ig_reels_avg_watch_time)} de visionado medio (objetivo 7 s)`);
  }
  if (formato === "story") {
    L.push(`RESPUESTAS: ${num(m.replies || 0)} · COMPARTIDAS: ${num(m.shares || 0)}`);
  } else {
    L.push(`INTERACCIÓN: ❤️ ${num(m.likes)} · 💬 ${num(m.comments)} · 🔁 ${num(m.shares)} · 💾 ${num(m.saved)}`);
    L.push(`TASAS por 1.000 de alcance: compartidos ${dec(mil(m.shares, m.reach))} · guardados ${dec(mil(m.saved, m.reach))}`);
  }
  const cr = crecimiento(m);
  if (cr) L.push(`CRECIMIENTO: ${cr}`);

  L.push("", d.titular);
  for (const l of d.lecturas) L.push(`• ${l}`);
  L.push("", `➡️ SIGUIENTE: ${d.siguiente}`);
  if (o.prueba) L.push("", `DECISIÓN: ${decisionPrueba(m, ref).texto}`);
  if (o.enlace) L.push("", o.enlace);
  return L.join("\n");
}

/* ── Resumen semanal ────────────────────────────────────────────────── */

export interface PiezaSemana {
  pieza: string;
  titulo: string;
  formato: Formato;
  m: Metricas;
}

export interface DatosSemana {
  seguidores: number;
  /** Seguidores de hace una semana (null si no hay histórico). */
  seguidoresAntes: number | null;
  /** Objetivo de seguidores (clave `meta_seguidores`); null si no hay. */
  meta: number | null;
  alcance7: number | null;
  /** Porcentaje del alcance que NO eran seguidores (0-100). */
  alcanceNoSeguidores: number | null;
  visitasPerfil: number | null;
  clicsEnlace: number | null;
  piezas: PiezaSemana[];
  programadas: Record<string, number>;
  proxima: string | null;
}

/** Cuello de botella de la semana → experimento concreto para la siguiente. */
export function cuelloDeBotella(p: PiezaSemana[], d: DatosSemana): { clave: string; texto: string; experimento: string } {
  const feed = p.filter((x) => x.m.reach > 0);
  const reach = feed.reduce((a, x) => a + x.m.reach, 0);
  const sum = (k: string) => feed.reduce((a, x) => a + (x.m[k] || 0), 0);
  const comentarios = sum("comments");
  const guardados = mil(sum("saved"), reach);
  const compartidos = mil(sum("shares"), reach);
  const reels = feed.filter((x) => x.formato === "reel");
  const retencion = reels.length ? mediana(reels.map((x) => x.m.ig_reels_avg_watch_time)) : 0;
  const conv = d.visitasPerfil ? pct(Math.max(0, d.seguidores - (d.seguidoresAntes ?? d.seguidores)), d.visitasPerfil) : null;

  if (reels.length && retencion < 4000) {
    return {
      clave: "retencion",
      texto: `La retención de los reels es baja (mediana ${seg(retencion)}): Instagram los corta antes de repartirlos.`,
      experimento: "3 reels seguidos con la acción en el primer fotograma, sin intro, ≤ 12 s. Mide la retención de cada uno.",
    };
  }
  if (comentarios === 0 && feed.length >= 3) {
    return {
      clave: "conversacion",
      texto: `0 comentarios en ${feed.length} piezas: el algoritmo no ve conversación.`,
      experimento: "Cierra 3 piezas con una pregunta de dos opciones («¿tu pareja 1 o la 2?») y responde a todos en la primera hora.",
    };
  }
  if (guardados < 3 && feed.length >= 3) {
    return {
      clave: "guardado",
      texto: `Casi nada se guarda (${dec(guardados)} por cada 1.000 de alcance; objetivo ≥ 10).`,
      experimento: "1 carrusel de consulta («calendario de tu grupo», «quién sube y quién baja») cerrando con «guárdalo para la jornada 1».",
    };
  }
  if (conv !== null && conv < 5) {
    return {
      clave: "conversion",
      texto: `Solo el ${dec(conv)} % de las visitas al perfil acaba siguiendo.`,
      experimento: "Fija el mejor reel en el perfil, reescribe la bio con el beneficio («Alineación de tu equipo en 20 s · Liga Cántabra») y cierra cada pieza con «sigue la cuenta».",
    };
  }
  if (compartidos < 4) {
    return {
      clave: "viralidad",
      texto: `Se comparte poco (${dec(compartidos)} por cada 1.000 de alcance; objetivo ≥ 4).`,
      experimento: "Serie «ficha de equipo»: una pieza por club o equipo de la liga, etiquetando su cuenta oficial. Lo que habla de ellos, lo reenvían.",
    };
  }
  return {
    clave: "escala",
    texto: "No hay un cuello de botella claro: toca escalar lo que ya funciona.",
    experimento: "Duplica la frecuencia del formato ganador esta semana y mantén todo lo demás igual.",
  };
}

export function informeSemanal(d: DatosSemana): string[] {
  const A: string[] = [];
  const dif = d.seguidoresAntes !== null ? d.seguidores - d.seguidoresAntes : null;
  A.push("📅 SEMANA · crecimiento y lectura del experto", "");
  A.push("CRECIMIENTO");
  A.push(
    `👥 ${num(d.seguidores)} seguidores${dif !== null ? ` (${dif >= 0 ? "+" : "−"}${num(Math.abs(dif))} esta semana${d.seguidoresAntes ? ` · ${dif >= 0 ? "+" : "−"}${dec(Math.abs(pct(dif, d.seguidoresAntes)))} %` : ""})` : ""}`,
  );
  if (d.meta && d.meta > d.seguidores) {
    const falta = d.meta - d.seguidores;
    const ritmo = dif && dif > 0 ? Math.ceil(falta / dif) : null;
    A.push(`🎯 Meta ${num(d.meta)}: faltan ${num(falta)}${ritmo ? ` · a este ritmo, ${ritmo} ${ritmo === 1 ? "semana" : "semanas"}` : " · esta semana no se avanzó"}`);
  }
  if (d.alcance7 !== null) {
    A.push(`📡 ${num(d.alcance7)} cuentas alcanzadas en 7 días${d.alcanceNoSeguidores !== null ? ` · ${num(d.alcanceNoSeguidores)} % no te seguían` : ""}`);
  }
  if (d.visitasPerfil !== null) {
    const nuevos = dif !== null && dif > 0 ? dif : 0;
    A.push(`👤 ${num(d.visitasPerfil)} visitas al perfil → ${num(nuevos)} seguidores nuevos (${dec(pct(nuevos, d.visitasPerfil))} %)`);
  }
  if (d.clicsEnlace !== null) A.push(`🔗 ${num(d.clicsEnlace)} clics en el enlace de la bio`);

  const por: Record<string, PiezaSemana[]> = {};
  for (const p of d.piezas) (por[p.formato] ||= []).push(p);
  const orden: Formato[] = ["reel", "carrusel", "post", "story"];
  if (d.piezas.length) {
    A.push("", "POR FORMATO · mediana de visualizaciones · compartidos y guardados por 1.000 de alcance");
    for (const f of orden) {
      const xs = por[f];
      if (!xs?.length) continue;
      const v = mediana(xs.map((x) => x.m.views));
      const reach = xs.reduce((a, x) => a + x.m.reach, 0);
      const c = mil(xs.reduce((a, x) => a + (x.m.shares || 0), 0), reach);
      const g = mil(xs.reduce((a, x) => a + (x.m.saved || 0), 0), reach);
      A.push(`${ETIQUETA[f]} (${xs.length}): ${num(v)} · ${dec(c)} · ${dec(g)}`);
    }
    const ord = [...d.piezas].sort((a, b) => b.m.views - a.m.views);
    if (ord.length >= 2) {
      const best = ord[0];
      const worst = ord[ord.length - 1];
      A.push("", `🏆 Mejor: ${best.pieza} · ${best.titulo} — ${num(best.m.views)} visualizaciones (${ETIQUETA[best.formato].toLowerCase()})`);
      A.push(`📉 Peor: ${worst.pieza} · ${worst.titulo} — ${num(worst.m.views)} (${ETIQUETA[worst.formato].toLowerCase()})`);
    }
    const cb = cuelloDeBotella(d.piezas, d);
    A.push("", "LECTURA DEL EXPERTO", `• ${cb.texto}`, "", `🧪 APUESTA DE LA SEMANA: ${cb.experimento}`);
  } else {
    A.push("", "Esta semana no ha salido nada: sin publicaciones no hay crecimiento. Lo primero es recuperar la frecuencia.");
  }

  const tot = Object.values(d.programadas).reduce((a, b) => a + b, 0);
  const desglose = Object.entries(d.programadas).filter(([, n]) => n > 0).map(([t, n]) => `${n} ${t}`).join(" · ");
  A.push("", `🗓️ Próxima semana: ${tot} programadas${desglose ? ` (${desglose})` : ""}${d.proxima ? ` · la primera: ${d.proxima}` : ""}`);
  return [A.join("\n")];
}
