// Depuración: imprime la rejilla de un cuadro guardado en un .html (latin1).
//   node dumpgrid.mjs fichero.html
import fs from 'node:fs';
import { extractTable, buildGrid } from './lib/grid.mjs';

const html = fs.readFileSync(process.argv[2], 'latin1');
const t = extractTable(html, /<table[^>]*class=["'][^"']*tablaCuadros[^"']*["'][^>]*>/i);
if (!t) { console.log('sin tablaCuadros'); process.exit(); }
const { cells } = buildGrid(t.inner);
let lastR = -1;
for (const c of cells) {
  if (!c.text && !c.resultado && !/linea/.test(c.cls)) continue;
  if (c.r !== lastR) { process.stdout.write(`\n${String(c.r).padStart(3)}: `); lastR = c.r; }
  const tag = c.resultado != null ? `R[${c.resultado}]` : c.text;
  process.stdout.write(`  c${c.c}${c.rs > 1 ? '/rs' + c.rs : ''}${c.cs > 1 ? '/cs' + c.cs : ''}<${c.cls.replace('tablalinea', 'L.')}>${tag}`);
}
console.log();
