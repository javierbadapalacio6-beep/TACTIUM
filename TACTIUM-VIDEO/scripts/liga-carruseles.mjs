// Carruseles de la Liga Cántabra 2026/27 a partir de los datos reales (scripts/liga-datos.mjs).
//   node scripts/liga-carruseles.mjs  → carruseles/L1.json … L4.json
// Fuerza de un equipo = media de puntos FCP de sus 10 mejores jugadores (las 5 parejas que
// juegan); la de un grupo, la media de sus equipos.
import fs from "node:fs";

const d = JSON.parse(fs.readFileSync("carruseles/datos/liga-2627.json", "utf8"));
const E = d.equipos.filter((e) => e.subgrupo); // sin las 2 inscripciones retiradas que quedan sin grupo
// es-ES no separa los miles en números de 4 cifras: se hace a mano.
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// El patrocinador sobra si lo que queda delante ya lleva la letra del equipo («MONTEVERDE E - LA RINCUENCA»).
const corto = (n) => { const m = n.match(/^(.*?\s[A-Z])\s*-\s*\S/); return (m ? m[1] : n).replace(/\s+/g, " ").trim(); };
const nombreCat = (g) => g.replace(" CATEGORIA ", " ").replace("MASCULINA", "Masculina").replace("FEMENINA", "Femenina");

function categorias(genero) {
  const cats = [...new Set(E.filter((e) => e.genero === genero).map((e) => e.grupo_nombre))].sort();
  return cats.map((c) => {
    const eqs = E.filter((e) => e.grupo_nombre === c);
    // Si al quitar el patrocinador dos equipos se quedan con el mismo nombre (pasa en 5ª M con
    // dos «RACKET SPORT F»), esos van con el nombre completo.
    const cuenta = eqs.reduce((a, e) => ((a[corto(e.equipo)] = (a[corto(e.equipo)] || 0) + 1), a), {});
    const nombre = (e) => (cuenta[corto(e.equipo)] > 1 ? e.equipo.replace(/\s+/g, " ") : corto(e.equipo));
    const letras = [...new Set(eqs.map((e) => e.subgrupo))].sort();
    const grupos = letras.map((l) => {
      const g = eqs.filter((e) => e.subgrupo === l);
      return { letra: l, equipos: g.map(nombre), fuerza: media(g.map((e) => e.fuerza)) };
    });
    const duro = grupos.reduce((a, b) => (b.fuerza > a.fuerza ? b : a));
    const mediaCat = media(eqs.map((e) => e.fuerza));
    grupos.forEach((g) => (g.duro = g === duro && grupos.length > 1));
    return { cat: c, nombre: nombreCat(c), grupos, duro, mediaCat, equipos: eqs.length };
  });
}

const M = categorias("M"), F = categorias("F");
const CIERRE_GRUPOS = { tipo: "cierre", foto: "gen/pista-noche.png", titulo: "¿Y la plantilla de *tus rivales?*",
  sub: "En tactium.io ves cada equipo de tu grupo con sus jugadores y sus **puntos FCP**. Gratis.", cta: "tactium.io · Federación", bandera: "cantabria" };

function slidesCategoria(c, eyebrow) {
  const dif = Math.round((c.duro.fuerza / c.mediaCat - 1) * 100);
  return { tipo: "grupos", eyebrow, bandera: "cantabria", titulo: c.nombre, grupos: c.grupos.map(({ letra, equipos, duro }) => ({ letra, equipos, duro })),
    dato: { eyebrow: "El más duro", titulo: `Grupo ${c.duro.letra}: *${fmt(c.duro.fuerza)}*`, sub: `puntos de media por jugador, un ${dif} % por encima de la categoría.` } };
}

const L1 = { id: "L1", titulo: "Todos los grupos · Masculino 2026/27", slides: [
  { tipo: "portada", foto: "gen/tablon-club.png", eyebrow: "Liga Cántabra 2026/27", bandera: "cantabria", titulo: "Todos los grupos. *Masculino.*", sub: `${M.length} categorías, ${M.reduce((a, c) => a + c.grupos.length, 0)} grupos. Busca el tuyo 👉` },
  ...M.map((c) => slidesCategoria(c, "Masculino · 26/27")),
  CIERRE_GRUPOS,
] };
const L2 = { id: "L2", titulo: "Todos los grupos · Femenino 2026/27", slides: [
  { tipo: "portada", foto: "gen/grada.png", eyebrow: "Liga Cántabra 2026/27", bandera: "cantabria", titulo: "Todos los grupos. *Femenino.*", sub: `${F.length} categorías, ${F.reduce((a, c) => a + c.grupos.length, 0)} grupos. Busca el tuyo 👉` },
  ...F.map((c) => slidesCategoria(c, "Femenino · 26/27")),
  CIERRE_GRUPOS,
] };

// L3 · Los grupos más duros: en cada categoría, cuánto se separa el grupo más fuerte de la media.
const fila = (c) => ({ etiqueta: c.nombre.replace(/ (Masculina|Femenina)$/, ""), sub: `Grupo ${c.duro.letra}`, valor: c.duro.fuerza / c.mediaCat - 1,
  texto: `+${Math.round((c.duro.fuerza / c.mediaCat - 1) * 100)} %` });
const todosDuros = [...M, ...F].filter((c) => c.grupos.length > 1).map((c) => ({ c, x: c.duro.fuerza / c.mediaCat }));
const peor = todosDuros.reduce((a, b) => (b.x > a.x ? b : a));
const top = [...E].sort((a, b) => b.fuerza - a.fuerza)[0];
const L3 = { id: "L3", titulo: "Los grupos de la muerte 2026/27", slides: [
  { tipo: "portada", foto: "gen/red-pista.png", eyebrow: "Liga Cántabra 2026/27", bandera: "cantabria", titulo: "Hemos medido los 41 grupos. *Estos son los más duros.*", tam: "sm" },
  { tipo: "texto", eyebrow: "Cómo lo medimos", titulo: "Los puntos FCP de los **10 mejores** de cada plantilla.", sub: "Son las 5 parejas que salen a jugar. La media de sus equipos da la fuerza de cada grupo." },
  { tipo: "barras", eyebrow: "Masculino", titulo: "El grupo más duro de *cada categoría*", sub: "Cuánto supera a la media de su categoría.", filas: M.filter((c) => c.grupos.length > 1).map(fila) },
  { tipo: "barras", eyebrow: "Femenino", titulo: "El grupo más duro de *cada categoría*", sub: "Cuánto supera a la media de su categoría.", filas: F.filter((c) => c.grupos.length > 1).map(fila) },
  { tipo: "numero", eyebrow: `El grupo de la muerte · ${peor.c.nombre}`, valor: `+${Math.round((peor.x - 1) * 100)}%`,
    sub: `El **grupo ${peor.c.duro.letra}** de ${peor.c.nombre.toLowerCase()} es el que más se separa de su categoría. Ahí no hay jornada fácil.` },
  { tipo: "numero", eyebrow: "La plantilla más fuerte de la liga", valor: fmt(top.fuerza),
    sub: `puntos de media en los 10 mejores de **${corto(top.equipo)}** (${nombreCat(top.grupo_nombre).toLowerCase()}).` },
  { tipo: "cierre", foto: "gen/pista-noche.png", titulo: "Mira el nivel de *tu grupo*", sub: "Cada rival, con su plantilla y sus puntos, en tactium.io. **Antes de la jornada 1.**", cta: "tactium.io · Federación", bandera: "cantabria" },
] };

// L4 · La liga en números.
const sedes = Object.entries(E.reduce((a, e) => ((a[e.sede_corta] = (a[e.sede_corta] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
const largo = [...E].sort((a, b) => b.jugadores - a.jugadores)[0];
const titulo = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()).replace(/^g6$/i, "G6");
const L4 = { id: "L4", titulo: "La Liga Cántabra 2026/27 en números", slides: [
  { tipo: "portada", foto: "gen/grada.png", eyebrow: "Liga Cántabra 2026/27", bandera: "cantabria", titulo: "La liga, *en números.*" },
  { tipo: "numero", eyebrow: "Equipos inscritos", valor: String(E.length), sub: `en ${M.length + F.length} categorías: ${M.length} masculinas y ${F.length} femeninas.` },
  { tipo: "numero", eyebrow: "Jugadores en las plantillas", valor: fmt(d.jugadoresDistintos), sub: `Unos **${Math.round(media(E.map((e) => e.jugadores)))} por equipo**. Y cada jornada juegan 10.` },
  { tipo: "barras", eyebrow: "Dónde se juega", titulo: "Las sedes con *más equipos*", filas: sedes.map(([s, n]) => ({ etiqueta: titulo(s), valor: n, texto: `${n} equipos` })) },
  { tipo: "numero", eyebrow: "La plantilla más larga", valor: String(largo.jugadores), sub: `jugadores inscritos en **${corto(largo.equipo)}**. Montar esa alineación cada semana es otro deporte.` },
  { tipo: "cierre", foto: "gen/pista-noche.png", titulo: "Tu equipo, tu grupo y tus rivales en *tactium.io*", sub: "Y si eres capitán, la alineación de cada jornada en **dos minutos** con la app.", cta: "Enlace en la bio", bandera: "cantabria" },
] };

for (const c of [L1, L2, L3, L4]) fs.writeFileSync(`carruseles/${c.id}.json`, JSON.stringify(c, null, 2) + "\n");
console.log("L1", L1.slides.length, "L2", L2.slides.length, "L3", L3.slides.length, "L4", L4.slides.length);
console.log("muerte:", peor.c.nombre, peor.c.duro.letra, Math.round((peor.x - 1) * 100), "| top:", top.equipo, top.fuerza, "| largo:", largo.equipo, largo.jugadores);
console.log(M.concat(F).map((c) => `${c.nombre}: ${c.grupos.map((g) => g.letra + "=" + Math.round(g.fuerza)).join(" ")}`).join("\n"));
