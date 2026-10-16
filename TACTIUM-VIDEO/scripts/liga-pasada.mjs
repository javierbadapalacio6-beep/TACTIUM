// Carruseles de «mirada atrás» para el inicio de la liga 2026/27: primeros de grupo de 2026 y ascensos a 1ª.
//   node scripts/liga-pasada.mjs  → carruseles/L5.json (ascensos) y L6.json (primeros de grupo)
// Datos (11-10-2026, consultados en la base):
//  · Primeros de grupo = posición 1 de fcp_clasificacion (liga 28074 = Liga Cántabra 2026), grupos de fase regular.
//    OJO: NO son los campeones de la liga (el playoff no está completo en los datos).
//  · Ascensos = equipos de 2026/27 en 1ª que en 2026 jugaban en 2ª, cruzando plantillas por nombre de jugador
//    (≥ 6 en común) y con el MISMO nombre de equipo (los que cambian de nombre se dejan fuera por prudencia).
import fs from "node:fs";

const CIERRE = (titulo, sub) => ({ tipo: "cierre", foto: "gen/pista-noche.png", titulo, sub, cta: "tactium.io · Federación", bandera: "cantabria" });
const G = (letra, ...equipos) => ({ letra, equipos });

const C = (cat, letra, equipo) => ({ etiqueta: cat + " · Grupo " + letra, equipos: [equipo] });
const L6 = { id: "L6", titulo: "Los primeros de grupo de la Liga 2026", slides: [
  { tipo: "portada", foto: "gen/tablon-club.png", eyebrow: "Liga Cántabra 2026", bandera: "cantabria", titulo: "Quién acabó *primero* en cada grupo", sub: "Las tres categorías de arriba, antes de que empiece la 26/27 👉", tam: "sm" },
  { tipo: "grupos", eyebrow: "Primeros de grupo · 2026", bandera: "cantabria", titulo: "Masculina: *1ª y 2ª*", grupos: [C("1ª", "A", "CENTRAL PADEL A"), C("1ª", "B", "LA MARINA A"), C("2ª", "A", "A.D.R.M. A"), C("2ª", "B", "ALDAY BOUCO A"), C("2ª", "C", "MIOÑO PADEL GYM A")],
    dato: { eyebrow: "Dato", titulo: "Los tres de 2ª *juegan en 1ª* esta temporada" } },
  { tipo: "grupos", eyebrow: "Primeros de grupo · 2026", bandera: "cantabria", titulo: "Femenina: *1ª y 2ª*", grupos: [C("1ª", "A", "CENTRAL PADEL A"), C("1ª", "B", "MONTEVERDE A"), C("2ª", "A", "SMASH SANTANDER B"), C("2ª", "B", "ZINK PADEL A"), C("2ª", "C", "MOVE & GO A")],
    dato: { eyebrow: "Dato", titulo: "Dos de 2ª *juegan en 1ª* esta temporada" } },
  { tipo: "grupos", eyebrow: "Primeros de grupo · 2026", bandera: "cantabria", titulo: "Los de *3ª*", grupos: [C("M", "A", "LA MARINA F"), C("M", "B", "S.T.C. CASTRO URDIALES B"), C("M", "C", "SMASH PADEL C"), C("M", "D", "LOS TROYANOS"), C("F", "A", "MONTEVERDE F"), C("F", "B", "CENTRAL PADEL E"), C("F", "C", "ZINK PADEL C")] },
  CIERRE("¿Tu equipo estaba *en la lista?*", "Etiqueta a tu capitán. **Y mira tu grupo de esta temporada** en tactium.io."),
] };

const L5 = { id: "L5", titulo: "Los equipos que suben a 1ª en 2026/27", slides: [
  { tipo: "portada", foto: "gen/grada.png", eyebrow: "Liga Cántabra 2026/27", bandera: "cantabria", titulo: "Estos equipos *dan el salto a 1ª*", sub: "Jugaban en 2ª en 2026. Ahora, en 1ª 👉", tam: "sm" },
  { tipo: "grupos", eyebrow: "Suben a 1ª · Masculina", bandera: "cantabria", titulo: "De 2ª a 1ª Masculina",
    grupos: [{ etiqueta: "Suben", equipos: ["MEDIO CUDEYO A", "SMASH PADEL A", "ALDAY BOUCO A", "A.D.R.M. A", "MONTEVERDE B"] }, { etiqueta: "Y también", equipos: ["REINOSA PADEL CLUB A", "C.D. LA PLAYUCA ASTILLERO A", "MIOÑO PADEL GYM A", "PADEL X5 A"] }] },
  { tipo: "grupos", eyebrow: "Suben a 1ª · Femenina", bandera: "cantabria", titulo: "De 2ª a 1ª Femenina",
    grupos: [{ etiqueta: "Suben", equipos: ["EL TEMPLO A", "G6 C"] }, { etiqueta: "Y también", equipos: ["MOVE & GO A", "SMASH SANTANDER B"] }],
    dato: { eyebrow: "Fíjate", titulo: "Smash Santander B y Move & Go A *ganaron su grupo en 2ª*" } },
  { tipo: "numero", eyebrow: "Suben a 1ª Masculina", valor: "9", sub: "equipos de 2ª juegan este año en la máxima categoría. **Tres de ellos ganaron su grupo** en 2ª." },
  CIERRE("¿Tu equipo *ha subido?*", "Mira la plantilla y los rivales de tu grupo en tactium.io. **Gratis.**"),
] };

for (const c of [L5, L6]) fs.writeFileSync(`carruseles/${c.id}.json`, JSON.stringify(c, null, 2) + "\n");
console.log("L5", L5.slides.length, "L6", L6.slides.length);
