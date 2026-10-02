// El calendario de publicaciones: `TACTIUM-VIDEO/calendario.json` es la fuente
// de verdad. El panel lo lee y lo cambia por aquí (estado, día, hora, vínculo
// con Instagram); nunca desde el navegador directamente.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CAL = path.join(ROOT, "calendario.json");
const RENDERS = path.join(ROOT, "renders");

export const leer = () => JSON.parse(fs.readFileSync(CAL, "utf8"));
const guardar = (d) => fs.writeFileSync(CAL, JSON.stringify(d, null, 2) + "\n");

/** Los archivos listos de una pieza, para previsualizarlos y descargarlos. */
function archivos(p) {
  const g = p.generar;
  if (!g) return [];
  if (g.tipo === "reel") {
    const vertical = g.formato === "9x16";
    return [
      // Primero la que se publica: 9:16 si la pieza lo marca (desde el 01-10, los reels), si no la 16:9.
      ...(vertical ? [{ ruta: `${g.id}-9x16.mp4`, formato: "9:16 · la que se publica" }] : []),
      { ruta: `${g.id}-16x9-web.mp4`, formato: vertical ? "16:9 · alternativa" : "16:9 · la que se publica" },
      { ruta: `${g.id}-16x9.mp4`, formato: "16:9 · máster" },
      { ruta: `${g.id}-ig.mp4`, formato: "Vertical · alternativa" },
      { ruta: `${g.id}.mp4`, formato: "Vertical · máster" },
    ].filter((a) => fs.existsSync(path.join(RENDERS, a.ruta)))
      // Una copia «para subir» más vieja que su máster es de un render anterior: no se ofrece.
      .filter((a) => {
        const master = a.ruta.replace("-ig.mp4", ".mp4").replace("-16x9-web.mp4", "-16x9.mp4");
        if (master === a.ruta || !fs.existsSync(path.join(RENDERS, master))) return true;
        return fs.statSync(path.join(RENDERS, a.ruta)).mtimeMs >= fs.statSync(path.join(RENDERS, master)).mtimeMs;
      })
      .map((a) => ({ url: `/renders/${a.ruta}`, formato: a.formato, video: true }));
  }
  const dir = path.join(RENDERS, "carruseles", g.id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
    .map((f) => ({ url: `/renders/carruseles/${g.id}/${f}`, formato: p.tipo === "story" ? "Story 1080×1920" : "1080×1350", video: false }));
}

/** El calendario tal cual, con los archivos de cada pieza ya resueltos. */
export function completo() {
  const d = leer();
  return { ...d, piezas: d.piezas.map((p) => ({ ...p, archivos: archivos(p) })) };
}

const ESTADOS = ["listo", "grabar", "publicado"];

/** Cambia una pieza. Solo admite los campos que el panel sabe editar. */
export function actualizar(id, cambios) {
  const d = leer();
  const p = d.piezas.find((x) => x.id === id);
  if (!p) throw new Error(`No existe la pieza ${id}`);
  const c = {};
  if ("estado" in cambios) {
    if (!ESTADOS.includes(cambios.estado)) throw new Error("Estado no válido");
    c.estado = cambios.estado;
  }
  if ("fecha" in cambios) {
    if (cambios.fecha !== null && !/^\d{4}-\d{2}-\d{2}$/.test(cambios.fecha)) throw new Error("Fecha no válida");
    c.fecha = cambios.fecha;
    // La semana sale de la fecha: así una pieza movida aparece donde toca.
    const s = cambios.fecha && d.semanas.find((w) => cambios.fecha >= w.desde && cambios.fecha <= w.hasta);
    c.semana = s ? s.n : null;
  }
  if ("hora" in cambios) {
    if (cambios.hora !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cambios.hora)) throw new Error("Hora no válida");
    c.hora = cambios.hora;
  }
  if ("ig" in cambios) {
    if (cambios.ig !== null && !/^\d+$/.test(String(cambios.ig))) throw new Error("Publicación no válida");
    // Una publicación de Instagram solo puede ser de una pieza.
    if (cambios.ig) for (const otra of d.piezas) if (otra !== p && otra.ig === String(cambios.ig)) { otra.ig = null; otra.igAuto = false; }
    c.ig = cambios.ig ? String(cambios.ig) : null;
    c.igAuto = false;
    if (c.ig) c.estado = "publicado";
  }
  Object.assign(p, c);
  guardar(d);
  return { ...p, archivos: archivos(p) };
}

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * Vincula solo lo que no tiene duda: una pieza sin vincular, de fecha pasada o
 * de hoy, y exactamente una publicación de Instagram del mismo formato ese mismo
 * día que no sea ya de otra pieza. Lo demás se vincula a mano desde la ficha.
 */
export function autoVincular(media) {
  const d = leer();
  const hoy = hoyMadrid();
  const usadas = new Set(d.piezas.map((p) => p.ig).filter(Boolean));
  let cambios = 0;
  for (const p of d.piezas) {
    if (p.ig || !p.fecha || p.fecha > hoy || p.tipo === "story") continue;
    const candidatas = media.filter((m) => m.fecha === p.fecha && m.tipo === p.tipo && !usadas.has(m.id));
    if (candidatas.length !== 1) continue;
    p.ig = candidatas[0].id;
    p.igAuto = true;
    p.estado = "publicado";
    usadas.add(p.ig);
    cambios++;
  }
  if (cambios) guardar(d);
  return cambios;
}
