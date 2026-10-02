// Renueva el token de Instagram si le quedan menos de 10 días de vida.
// Pensado para lanzarlo una vez a la semana (Programador de tareas de Windows,
// o simplemente ejecutarlo a mano de vez en cuando):
//
//   node panel/renovar-token.mjs
import * as instagram from "./instagram.mjs";
import fs from "node:fs";
import path from "node:path";

const ENV = path.join(import.meta.dirname, ".env");
const vars = Object.fromEntries(
  fs.readFileSync(ENV, "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const diasRestantes = vars.IG_TOKEN_EXPIRES ? (Number(vars.IG_TOKEN_EXPIRES) - Date.now()) / 86400000 : -1;

console.log(`Token con ${diasRestantes.toFixed(1)} días de vida.`);
if (diasRestantes > 10) {
  console.log("Aún no hace falta renovarlo (le quedan más de 10 días).");
} else {
  const { dias } = await instagram.renovarTokenLargo();
  console.log(`Renovado: ahora dura ${dias} días más.`);
}
