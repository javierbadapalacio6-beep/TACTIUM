// Depuración: parsea un cuadro guardado (.html latin1) e imprime los partidos.
//   node testparse.mjs fichero.html
import fs from 'node:fs';
import { parseEliminatoria, parseLiguilla } from './lib/parsers.mjs';

const html = fs.readFileSync(process.argv[2], 'latin1');
const r = /grupoliguilla/i.test(html) ? parseLiguilla(html) : parseEliminatoria(html);
for (const p of r.partidos) {
  console.log(`${p.fase.padEnd(11)} ${String(p.ronda).padEnd(16)} #${p.orden} [${p.estado}] ${p.pareja1 ?? '—'}  vs  ${p.pareja2 ?? '—'}  → g=${p.ganador} ${p.resultado ?? ''} ${p.programado ?? ''}`);
}
console.log({ campeon: r.campeon, finalista: r.finalista, campeon_consolacion: r.campeon_consolacion, clasif: r.clasif?.length, n: r.partidos.length });
