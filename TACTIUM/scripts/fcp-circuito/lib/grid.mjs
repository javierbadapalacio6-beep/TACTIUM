// Convierte una <table> HTML en una rejilla (fila × columna) respetando rowspan/colspan.
import { decode, attr } from './html.mjs';

/** Extrae el HTML interior de la primera <table> cuya etiqueta de apertura cumpla `re`. Soporta anidadas. */
export function extractTable(html, re) {
  const open = re.exec(html);
  if (!open) return null;
  let depth = 0;
  const tagRe = /<(\/?)table\b[^>]*>/gi;
  tagRe.lastIndex = open.index;
  let m;
  let start = -1;
  while ((m = tagRe.exec(html))) {
    if (!m[1]) { depth++; if (depth === 1) start = m.index + m[0].length; }
    else { depth--; if (depth === 0) return { inner: html.slice(start, m.index), end: m.index + m[0].length, start: open.index }; }
  }
  return { inner: html.slice(start), end: html.length, start: open.index };
}

/**
 * Devuelve { grid, cells }:
 *  grid[r][c] = índice en cells (o undefined)
 *  cells[i] = { r, c, rs, cs, cls, html, text, resultado }
 */
export function buildGrid(tableInner) {
  const cells = [];
  const grid = [];
  const trRe = /<tr\b([^>]*)>([\s\S]*?)(?=<tr\b|$)/gi;
  let tr;
  let r = 0;
  while ((tr = trRe.exec(tableInner))) {
    const body = tr[2].replace(/<\/tr>[\s\S]*$/i, '');
    grid[r] = grid[r] || [];
    const tdRe = /<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|$)/gi;
    let td;
    let c = 0;
    while ((td = tdRe.exec(body))) {
      while (grid[r][c] !== undefined) c++;
      const a = td[2];
      const inner = td[3].replace(/<\/t[dh]>\s*$/i, '');
      const rs = Math.max(1, parseInt(attr(a, 'rowspan') || '1', 10) || 1);
      const cs = Math.max(1, parseInt(attr(a, 'colspan') || '1', 10) || 1);
      const resM = /<div[^>]*class=["']?resultado["']?[^>]*>([\s\S]*?)<\/div>/i.exec(inner);
      const cell = {
        r, c, rs, cs,
        cls: (attr(a, 'class') || '').trim(),
        html: inner,
        text: decode(inner),
        resultado: resM ? decode(resM[1]) : null,
      };
      const idx = cells.push(cell) - 1;
      for (let dr = 0; dr < rs; dr++) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < cs; dc++) grid[r + dr][c + dc] = idx;
      }
      c += cs;
    }
    r++;
  }
  return { grid, cells, nrows: r };
}
