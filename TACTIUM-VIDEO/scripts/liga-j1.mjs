// Carruseles «Jornada 1» de todas las categorías a partir del calendario oficial 2026/27
// (fcp_partidos liga 28942, jornada 1 = 23-25 oct). El primer equipo de cada cruce es el local.
//   node scripts/liga-j1.mjs  → carruseles/L9.json (1ª) y L11 … L15 (2ª-7ª M, 2ª-5ª F)
// Solo entran los grupos que YA tienen su jornada 1 cargada; los que faltan se avisan y NO se publican a medias.
import fs from "node:fs";
import path from "node:path";

const LIGA = 28942;
const envWeb = fs.readFileSync(path.resolve("../tactium-web/.env.local"), "utf8");
const v = (k) => envWeb.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1].trim().replace(/^"|"$/g, "");
const URL_ = v("NEXT_PUBLIC_SUPABASE_URL"), KEY = v("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const get = async (q) => { const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } }); if (!r.ok) throw new Error(`${q}: ${r.status}`); return r.json(); };

const grupos = await get(`fcp_grupos?id_liga=eq.${LIGA}&select=id_grupo,nombre&limit=200`);
const partidos = await get(`fcp_partidos?id_liga=eq.${LIGA}&jornada=eq.1&select=id_grupo,equipo_local,equipo_visit&limit=1000`);

// «MONTEVERDE E - LA RINCUENCA» → «MONTEVERDE E»: el patrocinador sobra si la letra ya identifica al equipo.
const corto = (n) => { const m = n.match(/^(.*?\s[A-ZÑ])\s*-\s*\S/); return (m ? m[1] : n).replace(/\s+/g, " ").trim(); };
// Nombres largos: la tarjeta cabe unos 24 caracteres («vs » incluido).
const ABREV = [
  [/^C\.D\.E\. EL REFUGIO.*$/, "C.D.E. EL REFUGIO"],
  [/^WALA PADEL-.*?( [AB])?$/, (_, l) => "WALA PADEL" + (l ?? "")],
  [/^NUEVO SAN LAZARO\s*-\s*PONTEJOS/, "SAN LAZARO-PONTEJOS"],
  [/^PADEL RENEDO-.*$/, "PADEL RENEDO"],
  [/^PADEL PIELAGOS RENEDO-.*$/, "PIELAGOS RENEDO"],
  [/^PADEL LIENCRES PIELAGOS/, "LIENCRES PIELAGOS"],
  [/^PADEL CAMPOO SUR DEL NORTE/, "CAMPOO SUR DEL NORTE"],
  [/^ARENAS DISTRITO AJO PADEL/, "ARENAS AJO PADEL"],
  [/^P\.A\.G\. ASTILLERO GUARNIZO/, "ASTILLERO GUARNIZO"],
  [/^C\.D\.E\. ESCALANTE PADEL CLUB/, "ESCALANTE PADEL CLUB"],
  [/^C\.D\. LA PLAYUCA/, "LA PLAYUCA"],
  [/^S\.T\.C\. CASTRO URDIALES/, "CASTRO URDIALES"],
  [/^BATHCO PADEL TEAM ATP/, "BATHCO ATP"],
  [/^A\.D\.R\.M\. ([A-D])-.*$/, "A.D.R.M. $1"],
  [/^RACKET SPORT ([A-Z]) ?-.*$/, "RACKET SPORT $1"],
  [/^\+ ?PADEL SANTANDER/, "+PADEL SANTANDER"],
];
const ab = (n) => { for (const [re, to] of ABREV) if (re.test(n)) return n.replace(re, to); return n; };

const nombreG = Object.fromEntries(grupos.map((g) => [g.id_grupo, g.nombre.replace(/\s*-\s*GRUPO\s+/i, " · Grupo ")]));
const porGrupo = {};
for (const p of partidos) (porGrupo[p.id_grupo] ||= []).push([ab(corto(p.equipo_local)), ab(corto(p.equipo_visit))]);
const cats = {}, esperados = {};
for (const g of grupos) { const [cat] = nombreG[g.id_grupo].split(" · "); esperados[cat] = (esperados[cat] || 0) + 1; }
for (const [id, ps] of Object.entries(porGrupo)) {
  const [cat, grupo] = nombreG[id].split(" · ");
  (cats[cat] ||= []).push({ grupo: grupo.replace("Grupo ", ""), ps: ps.sort((a, b) => a[0].localeCompare(b[0])) });
}
for (const c of Object.values(cats)) c.sort((a, b) => a.grupo.localeCompare(b.grupo));

const bonito = (c) => c.replace(" CATEGORIA ", " ").replace("MASCULINA", "Masculina").replace("FEMENINA", "Femenina");
// Dos grupos por diapositiva (8 cruces): el espacio se llena y salen la mitad de diapositivas.
const slidesDe = (cat) => {
  const out = [], gs = cats[cat] ?? [];
  for (let i = 0; i < gs.length; i += 2) {
    const par = gs.slice(i, i + 2);
    out.push({ tipo: "grupos", eyebrow: "Jornada 1 · 23-25 octubre", bandera: "cantabria",
      titulo: `${bonito(cat)} · ${par.length === 2 ? `Grupos ${par[0].grupo} y ${par[1].grupo}` : `Grupo ${par[0].grupo}`}`,
      grupos: par.flatMap((g) => g.ps.map(([l, vi], k) => ({ etiqueta: `${g.grupo} · ${k + 1}`, equipos: [l, "vs " + vi] }))) });
  }
  return out;
};
const portada = (t, foto) => ({ tipo: "portada", foto, eyebrow: "Liga Cántabra 2026/27", bandera: "cantabria", titulo: t, sub: "23, 24 y 25 de octubre. El local, primero 👉", tam: "sm" });
const cierre = { tipo: "cierre", foto: "gen/pista-noche.png", titulo: "¿Y *tu jornada 1?*", sub: "Los cruces de tu grupo, con las plantillas y los puntos de cada rival, en tactium.io.", cta: "tactium.io · Federación", bandera: "cantabria" };

const M = (n) => `${n}ª CATEGORIA MASCULINA`, F = (n) => `${n}ª CATEGORIA FEMENINA`;
const SETS = [
  { id: "L9", titulo: "Jornada 1: los cruces de 1ª", cats: [M(1), F(1)], p: ["Jornada 1. *Los cruces de 1ª.*", "gen/red-pista.png"] },
  { id: "L11", titulo: "Jornada 1: los cruces de 2ª y 3ª masculina", cats: [M(2), M(3)], p: ["Jornada 1. *2ª y 3ª masculina.*", "gen/tablon-club.png"] },
  { id: "L12", titulo: "Jornada 1: los cruces de 4ª y 5ª masculina", cats: [M(4), M(5)], p: ["Jornada 1. *4ª y 5ª masculina.*", "gen/grada.png"] },
  { id: "L13", titulo: "Jornada 1: los cruces de 6ª y 7ª masculina", cats: [M(6), M(7)], p: ["Jornada 1. *6ª y 7ª masculina.*", "gen/red-pista.png"] },
  { id: "L14", titulo: "Jornada 1: los cruces de 2ª y 3ª femenina", cats: [F(2), F(3)], p: ["Jornada 1. *2ª y 3ª femenina.*", "gen/grada.png"] },
  { id: "L15", titulo: "Jornada 1: los cruces de 4ª y 5ª femenina", cats: [F(4), F(5)], p: ["Jornada 1. *4ª y 5ª femenina.*", "gen/tablon-club.png"] },
];
for (const s of SETS) {
  const faltan = s.cats.flatMap((c) => { const n = (cats[c] ?? []).length; return n < esperados[c] ? [`${bonito(c)}: ${n}/${esperados[c]} grupos`] : []; });
  const slides = s.cats.flatMap(slidesDe);
  fs.writeFileSync(`carruseles/${s.id}.json`, JSON.stringify({ id: s.id, titulo: s.titulo, slides: [portada(...s.p), ...slides, cierre] }, null, 2) + "\n");
  console.log(`${s.id} ${slides.length + 2} diapositivas${faltan.length ? "  ⚠ INCOMPLETO → " + faltan.join(" · ") : "  ✓ completo"}`);
}
const largos = Object.values(cats).flat().flatMap((g) => g.ps.flat()).filter((n) => n.length > 21);
console.log("nombres > 21 caracteres:", [...new Set(largos)].join(" | "));
