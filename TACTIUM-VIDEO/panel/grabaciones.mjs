// Recordatorios de grabación: para cada vídeo «por grabar» del calendario, un mensaje
// de Telegram con el guion, cómo grabarlo y dónde dejar el archivo. Lo manda la nube
// (tipo «grabacion» en redes_publicaciones) dos días antes de su publicación, a las 10:00.
import fs from "node:fs";
import path from "node:path";
import * as calendario from "./calendario.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GUIONES = path.join(ROOT, "GUIONES-REELS.md");

// Lo que hay que grabar además de la cara (de LISTA-DE-RODAJE-REDES.md).
const COBERTURA = {
  A1: "Graba también la pantalla: montar una alineación hasta que se vea la comprobación del orden, y después la Federación Cántabra en Explorar (una clasificación o una jornada).",
  A2: "Graba también la pantalla de la alineación con el aviso en rojo «Pareja 2 más fuerte que la 1» (pon la pareja 2 con más puntos que la 1).",
  R2: "Cobertura B7: el grupo de WhatsApp con muchos mensajes sin leer haciendo scroll, una alineación a boli en una libreta. Tapa nombres y teléfonos.",
  T3: "Graba la pantalla de principio a fin: inscribirse con el código DEMO16, elegir categoría y compañero, confirmar.",
  R4: "Cobertura A3 (crear torneo, cuadro, horarios) y A4 (inscripción con DEMO16), en grabación de pantalla.",
  R1: "Graba también los ganchos alternativos seguidos: te digo cuál tira mejor.",
  T1: "Graba la pantalla de la app de principio a fin haciendo los pasos del guion en orden y sin dudar. Si te equivocas, repite la toma entera.",
  R5: "Cobertura: graba la pantalla de la Federación en la app (buscar un jugador, sus puntos, una clasificación y un cuadro de playoff).",
  R7: "Cobertura: graba la pantalla creando un torneo, la inscripción con código, el pago online y un cuadro con resultados y horarios.",
};

/** El guion (las líneas citadas) y la cabecera de una sección del documento de guiones. */
export function guion(id) {
  const md = fs.readFileSync(GUIONES, "utf8");
  const ini = md.search(new RegExp(`^## ${id} — .*$`, "m"));
  if (ini < 0) return null;
  const resto = md.slice(ini);
  const fin = resto.slice(3).search(/^(## |# |---)/m);
  const sec = fin < 0 ? resto : resto.slice(0, fin + 3);
  const cab = sec.split("\n")[0];
  const archivo = (cab.match(/`([^`]+\.mp4)`/) || [])[1] || `${id}.mp4`;
  const duracion = (cab.match(/~\d+s/) || [""])[0].replace("~", "");
  const lineas = sec.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^>\s?/, "").trim())
    .filter(Boolean)
    .map((l) => l.replace(/\*\*\[(.*?)\]\*\*/g, "($1)").replace(/\*\*/g, ""))
    // Regla de la cuenta: «reclamar», no «impugnar».
    .map((l) => l.replace(/te la pueden impugnar/g, "te lo pueden reclamar").replace(/impugnar/g, "reclamar"));
  // La acción del primer segundo y los ganchos alternativos, si el guion los trae.
  const accion = (sec.match(/^\*\*Primer segundo:\*\*\s*(.+)$/m) || [])[1] || "";
  const alternativos = [...sec.matchAll(/^(?:\*\*Gancho alternativo:\*\*\s*|- )«(.+?)»/gm)].map((m) => `«${m[1]}»`);
  return { archivo, duracion, texto: lineas.join("\n"), accion, alternativos };
}

const fecha = (f) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(f + "T12:00:00Z"));
const menosDias = (f, n) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Texto completo del recordatorio de una pieza por grabar. */
export function mensaje(p) {
  const g = guion(p.id);
  if (!g) throw new Error(`No encuentro el guion de ${p.id} en GUIONES-REELS.md`);
  return [
    `Toca grabar ${p.id} · ${p.titulo}${g.duracion ? ` (${g.duracion})` : ""}.`,
    `Sale el ${fecha(p.fecha)} a las ${p.hora}.`,
    "",
    ...(g.accion ? [`PRIMER SEGUNDO: ${g.accion}`, ""] : []),
    "GUION (dilo con tus palabras, no lo leas):",
    g.texto,
    "",
    "CÓMO:",
    "Móvil en vertical, trípode, a la altura de los ojos, de cuerpo entero con aire sobre la cabeza (se publica en 9:16 y el texto va abajo). Empieza a hablar desde el primer segundo, con la acción del gancho a la vez. Tres tomas; si te trabas, repite la frase y sigue.",
    ...(g.alternativos.length ? ["", `GANCHOS ALTERNATIVOS (graba también estos, uno detrás de otro): ${g.alternativos.join(" · ")}`] : []),
    COBERTURA[p.id] || "",
    "",
    `Mándame cada toma por este bot como vídeo normal (no como archivo), con «${p.id}» en el texto del envío. Las pantallas, igual, con «${p.id} pantalla». Cuando estén todas, avísame y lo monto.`,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

/** Cuándo llega el recordatorio: dos días antes a las 10:00; si ya pasó, en 5 minutos. */
export function cuando(p, madridAUtc) {
  const iso = madridAUtc(menosDias(p.fecha, 2), "10:00");
  return new Date(iso).getTime() > Date.now() ? iso : new Date(Date.now() + 5 * 60000).toISOString();
}

export const porGrabar = () => calendario.leer().piezas.filter((p) => p.estado === "grabar" && p.fecha && p.tipo === "reel");
