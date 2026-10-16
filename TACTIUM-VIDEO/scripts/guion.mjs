#!/usr/bin/env node
// guion.mjs · herramientas de guion para reels, en español y sin dependencias.
//
// Adaptado al español y a TACTIUM a partir de «instagram-agent-skill» de Jake Schincariol (MIT,
// https://github.com/Jakeschincariol/instagram-agent-skill): las ideas de beats.py y caption.py (tiempos por
// línea, avisos de montaje, la ventana de ~125 caracteres del pie). Las listas de palabras y las reglas son
// nuestras. Los números son una ESTIMACIÓN para planificar, no sustituyen a grabar y medir.
//
//   node scripts/guion.mjs beats guion.txt --objetivo 15          tiempos por línea y avisos de montaje
//   node scripts/guion.mjs pie pie.txt --claves "liga cántabra,alineación"   revisa el pie
//   node scripts/guion.mjs gancho "Domingo 23:30, 47 mensajes: ¿al final jugamos?"   puntúa un gancho
//   node scripts/guion.mjs gancho -f ganchos.txt                  ordena varios (uno por línea)
//   (cualquier fichero puede ser «-» para leer de la entrada estándar)
import fs from "node:fs";

/* ── utilidades ─────────────────────────────────────────────────────── */
const PALABRA = /[\p{L}\p{N}$%'’-]+(?:[.,]\d+)*/gu;
const quitaTildes = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const palabras = (t) => t.match(PALABRA) ?? [];
const VACIAS = new Set(("el la los las un una unos unas y o u pero si de del al a en con por para que esto eso es son era fue ser ha han he tu tus su sus mi mis me te se lo le les nos no ya mas muy como pues entonces ese esa este esta estos estas hay solo sin").split(" "));
const tc = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function leer(ruta) {
  return ruta === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(ruta, "utf8");
}
function opcion(args, nombre, defecto) {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : defecto;
}

/* ── beats: tiempos y avisos de montaje ─────────────────────────────── */
const VENTANA_GANCHO = 3.0; // s: pasado esto el pulgar ya ha decidido
const BEAT_MAX = 4.0; // s sobre una idea sin cambio en pantalla
const RACHA_ABSTRACTA = 3;
// Algo comprobable: un número (en cifras o dicho con palabras, como se escribe un guion hablado) o un nombre propio en mitad de línea.
const CONCRETO = /\d[\d.,:]*|\b(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinti\p{L}+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|mil)\b|(?<!^)\b\p{Lu}\p{Ll}{2,}/gmu;

function beats(texto, ppm, objetivo) {
  const pps = ppm / 60;
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return null;
  const filas = [];
  let reloj = 0;
  lineas.forEach((t, i) => {
    const n = palabras(t).length;
    const dur = n / pps;
    filas.push({ n: i + 1, inicio: reloj, dur, palabras: n, t, concreto: (t.match(CONCRETO) ?? []).length, etiqueta: "", avisos: [] });
    reloj += dur;
  });
  const total = reloj;
  for (const f of filas) if (f.n === 1 || f.inicio + f.dur <= VENTANA_GANCHO) f.etiqueta = "GANCHO";
  filas[filas.length - 1].etiqueta = filas[filas.length - 1].etiqueta ? "GANCHO/CIERRE" : "CIERRE";
  const notas = [];
  const g = filas[0];
  if (g.dur > VENTANA_GANCHO) {
    g.avisos.push(`el gancho dura ${g.dur.toFixed(1)} s`);
    notas.push(`La línea 1 tarda ${g.dur.toFixed(1)} s en decirse. Déjala en ${Math.floor(VENTANA_GANCHO * pps)} palabras o menos: pasado el segundo ${VENTANA_GANCHO}, el pulgar ya ha decidido.`);
  }
  if (g.concreto === 0) notas.push("La línea 1 no lleva ningún número ni nombre. Un gancho sin algo comprobable (un dato, un grupo, un equipo) es el que se salta.");
  const largas = filas.filter((f) => f.dur > BEAT_MAX);
  largas.forEach((f) => f.avisos.push(`${f.dur.toFixed(1)} s sobre una sola idea`));
  if (largas.length) notas.push(`Líneas ${largas.map((f) => f.n).join(", ")} pasan de ${BEAT_MAX} s. Parte la línea o cambia lo que se ve dentro de ella: un plano quieto es donde la gente se va.`);
  let racha = 0, inicioRacha = 0;
  filas.forEach((f, i) => {
    if (f.concreto === 0) { if (!racha) inicioRacha = i; racha += 1; }
    else racha = 0;
    if (racha === RACHA_ABSTRACTA) notas.push(`Las líneas ${inicioRacha + 1}-${i + 1} seguidas no llevan nada concreto. Mete un número, un nombre de grupo o una situación que se vea.`);
  });
  // Bucle: la última línea repite una palabra del gancho (la segunda vuelta es alcance gratis).
  const clave = new Set(palabras(quitaTildes(g.t)).filter((w) => w.length > 3 && !VACIAS.has(w)));
  const ultimas = palabras(quitaTildes(filas[filas.length - 1].t));
  if (filas.length > 1 && !ultimas.some((w) => clave.has(w))) notas.push("Sin bucle: la última línea no repite ninguna palabra del gancho. Repetir una palabra hace que la repetición del vídeo encaje.");
  if (objetivo) {
    const d = total - objetivo;
    if (Math.abs(d) > 2) notas.push(`${Math.abs(d).toFixed(1)} s ${d > 0 ? "por encima" : "por debajo"} del objetivo (${objetivo} s). ${d > 0 ? `Quita ~${Math.round(d * pps)} palabras.` : `Añade ~${Math.round(-d * pps)} palabras o grábalo corto: corto casi siempre acierta.`}`);
  }
  return { filas, total, notas, ppm };
}

function imprimirBeats(r, objetivo) {
  const palabrasTot = r.filas.reduce((a, f) => a + f.palabras, 0);
  console.log(`GUION POR LÍNEAS · ${palabrasTot} palabras · ~${r.total.toFixed(1)} s a ${r.ppm} ppm${objetivo ? ` · objetivo ${objetivo} s` : ""}`);
  console.log("=".repeat(76));
  for (const f of r.filas) {
    const corto = f.t.length > 52 ? f.t.slice(0, 51) + "…" : f.t;
    console.log(`  ${tc(f.inicio)} ${f.dur.toFixed(1).padStart(4)} s  ${f.etiqueta.padEnd(13)} ${corto}`);
    for (const a of f.avisos) console.log(`${" ".repeat(32)}^ ${a}`);
  }
  console.log("-".repeat(76));
  if (!r.notas.length) console.log("  Sin avisos de montaje.");
  for (const n of r.notas) console.log(`  - ${n}`);
}

/* ── pie: revisión del texto del reel o del post ────────────────────── */
const VISIBLE = 125; // caracteres que enseña el feed antes de «… más»
const PETICIONES = [
  ["comentar", /\bcoment(a|e|ad|ar)\b/],
  ["guardar", /\bguard(a|alo|ad|ar)\b/],
  ["etiquetar", /\betiquet(a|alo|ad|ar)\b/],
  ["seguir", /\bsigu(e|enos|ela)\b|\bsegu(ir|idnos)\b/],
  // Con los enclíticos de verdad: «mándaselo», «envíaselo», «mándalo».
  ["enviar", /\b(envi(a|alo|aselo|aselos|ar)|mand(a|alo|aselo|aselos|ar))\b/],
  ["responder", /\brespond(e|ed|er)\b/],
  ["enlace", /enlace en (la )?bio|link en (la )?bio/],
];
// Muletillas que delatan texto escrito por una IA (se dicen mal en voz alta y en un pie suenan a anuncio).
const HUELLAS_IA = ["sumergete", "en el mundo actual", "en el vertiginoso", "descubre como", "desbloquea", "revoluciona", "no es solo", "mas que un", "te invitamos a", "en definitiva", "sin duda alguna", "imprescindible", "elevar tu", "llevar al siguiente nivel", "en el panorama"];

function revisarPie(texto, claves) {
  const t = texto.trim();
  const filas = [];
  const add = (estado, nombre, detalle) => filas.push({ estado, nombre, detalle });
  const visible = t.slice(0, VISIBLE);
  add(t.length <= 2200 ? "OK" : "MAL", "LARGO", `${t.length} / 2200 caracteres`);
  const primera = t.split(/\r?\n/)[0];
  add(primera.length <= VISIBLE ? "OK" : "AVISO", "PRIMERA LÍNEA", primera.length <= VISIBLE ? `${primera.length} caracteres: entra entera en la ventana visible` : `${primera.length} caracteres: se corta a los ${VISIBLE}, en mitad de frase`);
  const concretos = (visible.match(CONCRETO) ?? []).length;
  add(concretos ? "OK" : "AVISO", "GANCHO CONCRETO", concretos ? `${concretos} número(s) o nombre(s) en la ventana visible` : "ningún número ni nombre en lo que se ve antes de «… más»");
  const tags = t.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  add(tags.length <= 5 ? "OK" : "AVISO", "HASHTAGS", `${tags.length} etiqueta(s)${tags.length ? ": " + tags.slice(0, 6).join(" ") : ""}${tags.length > 5 ? " · recomendado 3-5 relevantes (no son una palanca de crecimiento)" : ""}`);
  const norm = quitaTildes(t);
  const pides = PETICIONES.filter(([, re]) => re.test(norm)).map(([n]) => n);
  add(pides.length === 1 ? "OK" : pides.length === 0 ? "AVISO" : pides.length > 2 ? "AVISO" : "OK", "UNA PETICIÓN", pides.length ? `${pides.length}: ${pides.join(", ")}` : "ninguna: cierra con una sola petición (comenta, guarda, etiqueta)");
  if (claves.length) {
    const faltan = claves.filter((c) => !norm.includes(quitaTildes(c)));
    add(faltan.length === 0 ? "OK" : "AVISO", "BÚSQUEDA", `${claves.length - faltan.length}/${claves.length} palabras clave${faltan.length ? ". Faltan: " + faltan.join(", ") : ""}`);
  }
  const rayas = (t.match(/[—–]/g) ?? []).length;
  add(rayas ? "AVISO" : "OK", "RAYAS LARGAS", rayas ? `${rayas}: delatan texto de IA; usa comas, puntos o dos puntos` : "ninguna");
  const huellas = HUELLAS_IA.filter((h) => norm.includes(h));
  add(huellas.length ? "AVISO" : "OK", "MULETILLAS DE IA", huellas.length ? huellas.join(", ") : "ninguna");
  const nombres = (t.match(/@[\w.]+/g) ?? []);
  add(nombres.length <= 3 ? "OK" : "AVISO", "MENCIONES", `${nombres.length}${nombres.length > 3 ? " · máximo 2-3 y solo equipos o clubs claros" : ""}`);

  console.log("LO QUE ENSEÑA EL FEED");
  const trozos = visible.match(/.{1,52}/gs) ?? [""];
  console.log("  +" + "-".repeat(54) + "+");
  trozos.forEach((l) => console.log("  | " + l.replace(/\r?\n/g, " ").padEnd(52) + " |"));
  console.log("  +" + "-".repeat(44) + " … más +\n");
  for (const f of filas) console.log(`  ${f.estado.padEnd(5)} ${f.nombre.padEnd(18)} ${f.detalle}`);
}

/* ── gancho: puntuación orientativa ─────────────────────────────────── */
const SALUDOS = /^\s*(hola|buenas|que tal|bienvenid|hoy (te )?(voy|vamos|traigo)|en este (video|reel)|amigos|chicos|familia)/;
const TENSION = ["nadie", "nunca", "error", "mentira", "pierdes", "perdi", "cuesta", "costo", "horas", "minutos", "gratis", "antes", "despues", "cuidado", "ojo", "problema", "ultimo", "unico", "secreto", "verdad", "cuantas", "sabias", "olvida", "falta", "bajas", "sube", "baja", "domingo"];
const DIRIGIDO = /\b(tu|tus|tu equipo|tu grupo|tu capitan|tu pareja|tu liga|tu club|vosotros|os|te|ti|contigo)\b|\?/;

function puntuarGancho(linea) {
  const norm = quitaTildes(linea);
  const n = palabras(linea).length;
  const cortes = [];
  let frontload = 100;
  if (SALUDOS.test(norm)) { frontload = 0; cortes.push("Empieza con un saludo o una presentación. Nadie vino al feed a que lo saludaran."); }
  else if (/^\s*(para de mirar|no pases|espera)/.test(norm)) { frontload = 40; cortes.push("Pedir atención no la gana: hay que merecerla con el contenido."); }
  const largo = n <= 8 ? 100 : n <= 12 ? 80 : n <= 16 ? 50 : 20;
  const concreto = (linea.match(CONCRETO) ?? []).length;
  const especifico = concreto >= 2 ? 100 : concreto === 1 ? 75 : /\b(equipo|grupo|capitan|pareja|liga|jornada|alineacion)\b/.test(norm) ? 55 : 15;
  const dirigido = DIRIGIDO.test(norm) ? 100 : 40;
  const tens = TENSION.filter((w) => norm.includes(w)).length;
  const tension = tens >= 2 ? 100 : tens === 1 ? 70 : 30;
  const dims = { "PRIMERAS PALABRAS": frontload, "BREVEDAD": largo, "CONCRECIÓN": especifico, "A QUIÉN LE HABLA": dirigido, "TENSIÓN": tension };
  const puntos = Math.round(frontload * 0.3 + largo * 0.15 + especifico * 0.25 + dirigido * 0.15 + tension * 0.15);
  const peor = Object.entries(dims).sort((a, b) => a[1] - b[1])[0];
  const nota = cortes.length ? Math.min(puntos, 35) : puntos;
  return { linea, palabras: n, puntos: nota, etiqueta: nota >= 75 ? "FUERTE" : nota >= 50 ? "REGULAR" : "FLOJO", peor, cortes };
}

function imprimirGanchos(res) {
  res.sort((a, b) => b.puntos - a.puntos);
  console.log("RANKING DE GANCHOS (orientativo: regla de oficio, no una medición de Instagram)");
  console.log("=".repeat(78));
  res.forEach((r, i) => {
    const l = r.linea.length > 62 ? r.linea.slice(0, 61) + "…" : r.linea;
    console.log(`${i === 0 ? "->" : "  "} ${String(r.puntos).padStart(3)} ${r.etiqueta.padEnd(8)} ${l}`);
    console.log(`        punto débil: ${r.peor[0]} (${r.peor[1]}) · ${r.palabras} palabras`);
    r.cortes.forEach((c) => console.log(`        eliminatorio: ${c}`));
  });
  if (res[0].puntos < 50) console.log("\nEl mejor está por debajo de 50: todavía no hay gancho. Reescribe, no retoques.");
}

/* ── entrada ────────────────────────────────────────────────────────── */
const [, , cmd, ...args] = process.argv;
try {
  if (cmd === "beats") {
    const ruta = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true) ?? "-";
    const objetivo = Number(opcion(args, "objetivo", 0)) || null;
    const ppm = Number(opcion(args, "ppm", 160));
    const r = beats(leer(ruta), ppm, objetivo);
    if (!r) { console.error("El guion está vacío."); process.exit(1); }
    if (args.includes("--json")) console.log(JSON.stringify(r, null, 2)); else imprimirBeats(r, objetivo);
  } else if (cmd === "pie") {
    const ruta = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "-";
    const claves = (opcion(args, "claves", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
    revisarPie(leer(ruta), claves);
  } else if (cmd === "gancho") {
    const lineas = args[0] === "-f" ? leer(args[1] ?? "-").split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [args.join(" ").trim()].filter(Boolean);
    if (!lineas.length) { console.error('Uso: guion.mjs gancho "línea"  |  guion.mjs gancho -f fichero.txt'); process.exit(1); }
    imprimirGanchos(lineas.map(puntuarGancho));
  } else {
    console.log("Uso: guion.mjs beats|pie|gancho …  (ver la cabecera del fichero)");
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
