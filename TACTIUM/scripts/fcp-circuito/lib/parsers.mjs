// Parsers de las páginas de circuitos de la FCP. Todos reciben HTML (latin1 ya decodificado
// a string JS) y devuelven objetos planos; no tocan red ni BD.
import { decode, rows, links, attr, norm } from './html.mjs';
import { extractTable, buildGrid } from './grid.mjs';

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const MES_CORTO = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const pad = n => String(n).padStart(2, '0');
export const toInt = s => { const t = String(s ?? '').replace(/\./g, '').replace(/[^\d-]/g, ''); return t && t !== '-' ? parseInt(t, 10) : null; };
const ddmmyyyy = s => { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : null; };

// ─── Listado /Torneos ────────────────────────────────────────────────────────
export function parseListado(html, anio) {
  const out = [];
  for (const art of html.split(/<article\b/i).slice(1)) {
    const a = /<h4>\s*<a[^>]*href=["']Torneo_previo\?id=(\d+)["'][^>]*>([^<]+)</i.exec(art)
      || /href=["']Torneo_previo\?id=(\d+)["'][^>]*>\s*([^<\s][^<]*)</i.exec(art);
    if (!a) continue;
    const tags = [...art.matchAll(/class=["']cat-tag[^"']*["'][^>]*>([^<]*)</gi)].map(m => decode(m[1])).filter(Boolean);
    const fechas = /Del\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+al\s+(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(art);
    const img = /<img[^>]*src=["']([^"']+)["']/i.exec(art);
    const nombre = decode(a[2]);
    out.push({
      id_torneo: parseInt(a[1], 10),
      anio,
      nombre,
      modalidad: /MASTER/i.test(nombre) ? 'MASTER' : 'ABSOLUTO',
      // Algunas fichas llevan dos etiquetas («En Juego» y «Torneo Finalizado»); manda la última.
      estado: tags.length ? tags[tags.length - 1] : null,
      fecha_inicio: fechas ? ddmmyyyy(fechas[1]) : null,
      fecha_fin: fechas ? ddmmyyyy(fechas[2]) : null,
      cartel_url: img ? img[1] : null,
    });
  }
  return out;
}

// ─── /Calendario (sedes) ─────────────────────────────────────────────────────
export function parseCalendario(html, anio) {
  const out = [];
  for (const r of rows(html)) {
    if (r.cells.length !== 5) continue;
    const [ini, fin, prueba, cat, sede] = r.cells.map(c => c.text);
    const mi = /^(\d{1,2})\s+([a-záéíóú]{3})/i.exec(ini);
    if (!mi || !prueba) continue;
    const mesIni = MES_CORTO[mi[2].toLowerCase().slice(0, 3)];
    out.push({ inicio: mesIni ? `${anio}-${pad(mesIni)}-${pad(mi[1])}` : null, fin, prueba, categoria: cat, sede });
  }
  return out;
}

// ─── Página de cuadros del torneo ────────────────────────────────────────────
export function parseCuadrosIndex(html) {
  const out = [];
  const seen = new Set();
  for (const l of links(html)) {
    if (!/^Torneo-Previo\?/i.test(l.href)) continue;
    const q = new URLSearchParams(l.href.split('?')[1]);
    const g = q.get('Genero'), n = parseInt(q.get('Nivel'), 10), cu = q.get('Cuadro');
    const key = `${g}_${n}_${cu}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ genero: g, nivel: n, cuadro_param: cu, cat: q.get('Cat') || 'ABSOLUTO', etiqueta: l.text, href: '/' + l.href });
  }
  return out;
}

// ─── Inscritos ───────────────────────────────────────────────────────────────
export function splitApNom(s) {
  const t = decode(s);
  const i = t.indexOf(',');
  if (i < 0) return { apellido: t.trim(), nombre: '' };
  return { apellido: t.slice(0, i).trim(), nombre: t.slice(i + 1).trim() };
}
export function parseInscritos(html) {
  const out = [];
  let cat = null, genero = null, nivel = null;
  for (const r of rows(html)) {
    const c = r.cells;
    if (c.length === 1 && /CATEGOR/i.test(c[0].text)) {
      cat = c[0].text;
      genero = /FEMEN/i.test(cat) ? 'F' : /MIXT/i.test(cat) ? 'X' : 'M';
      nivel = toInt((/^(\d+)/.exec(cat) || [])[1]);
      continue;
    }
    if (c.length < 4 || !cat || !/^\d+$/.test(c[0].text)) continue;
    const pareja = c[2].text;
    const [p1, p2] = pareja.split(/\s+-\s+/);
    const a = splitApNom(p1 || ''), b = splitApNom(p2 || '');
    out.push({
      genero, nivel, num: parseInt(c[0].text, 10), categoria: cat,
      fecha_inscripcion: ddmmyyyy(c[1].text), pareja, puntos: toInt(c[3].text),
      j1_nombre: a.nombre, j1_apellido: a.apellido, j2_nombre: b.nombre, j2_apellido: b.apellido,
    });
  }
  return out;
}

// ─── Resultados ──────────────────────────────────────────────────────────────
/** «6/7-7/6-6/3» → [[6,7],[7,6],[6,3]] (en el orden en que viene escrito). */
export function parseScore(res) {
  const s = String(res || '').trim();
  const walkover = /W\.?\s*O\.?/i.test(s);
  const retirada = /les|retir|abandon/i.test(s);
  const sets = [...s.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map(m => [parseInt(m[1], 10), parseInt(m[2], 10)]);
  return { walkover, retirada, sets };
}
export function setsWonBy(sets) {
  let a = 0, b = 0;
  for (const [x, y] of sets) { if (x > y) a++; else if (y > x) b++; }
  return [a, b];
}

/** Nombre abreviado del cuadro «MARCO REMOLINA P.» → { base:'MARCO REMOLINA', inicial:'P' } */
export function splitAbrev(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)\s+([A-ZÑÇÁÉÍÓÚÜ])?\.$/i.exec(t);
  if (m) return { base: m[1].trim(), inicial: m[2] ? norm(m[2]) : null };
  return { base: t, inicial: null };
}
export function splitPareja(s, sep = /\s+-\s+/) {
  const t = String(s || '').trim();
  if (!t) return [];
  return t.split(sep).map(x => x.trim()).filter(Boolean);
}

// ─── Cuadro eliminatorio (genérico por posición de columna) ──────────────────
const isSlot = c => /abajo/i.test(c.cls);
const isChampionHeader = h => /^camp/i.test(h);   // «Campeones», «Campeón C.», «Camp. C.»
const isConsHeader = h => /\sC\.?$/i.test(String(h || '').trim());   // «Cuartos C.», «16s C», «Campeón C.»

export function parseEliminatoria(html) {
  const t = extractTable(html, /<table[^>]*class=["'][^"']*tablaCuadros[^"']*["'][^>]*>/i);
  if (!t) return null;
  const { grid, cells } = buildGrid(t.inner);
  const headers = [];
  for (const c of cells.filter(x => x.r === 0)) for (let k = 0; k < c.cs; k++) headers[c.c + k] = c.text;
  const ncols = headers.length;
  const colCells = Array.from({ length: ncols }, () => []);
  // Una celda con colspan (p.ej. el resultado de la final en Cuadro64c) cuenta en todas sus columnas.
  for (const c of cells) if (c.r > 0) for (let k = 0; k < c.cs; k++) if (colCells[c.c + k]) colCells[c.c + k].push(c);

  const skip = h => !h || /^Lin$/i.test(h) || /^C\.?S\.?$/i.test(h);
  const mainCols = [], consCols = [];
  for (let c = 0; c < ncols; c++) {
    const h = headers[c];
    if (skip(h)) continue;
    (isConsHeader(h) ? consCols : mainCols).push(c);
  }
  // Rondas: principal de izquierda a derecha; consolación de derecha a izquierda.
  consCols.sort((a, b) => b - a);

  const partidos = [];
  let campeon = null, campeonCons = null, finalista = null;
  const process = (cols, fase) => {
    let rondaIdx = 0;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (isChampionHeader(headers[c])) {
        const s = colCells[c].find(isSlot);
        if (s && s.text) { if (fase === 'principal') campeon = s.text; else campeonCons = s.text; }
        continue;
      }
      const next = fase === 'principal' ? c + 1 : c - 1;
      const slots = colCells[c].filter(isSlot).sort((a, b) => a.r - b.r);
      if (slots.length < 2) continue;
      rondaIdx++;
      let orden = 0;
      for (let k = 0; k + 1 < slots.length; k += 2) {
        const top = slots[k], bot = slots[k + 1];
        const between = x => x.r > top.r && x.r <= bot.r;
        const inCol = colCells[c].filter(x => !isSlot(x) && between(x));
        const inNext = (colCells[next] || []).filter(x => between(x) || x.r === top.r);
        const resCell = inCol.find(x => x.resultado != null) || inNext.find(x => !isSlot(x) && x.resultado != null);
        const linkCell = [...inCol, ...inNext.filter(x => !isSlot(x))].find(x => /der|sinnada/i.test(x.cls) || x.resultado != null);
        const winnerCell = inNext.find(x => isSlot(x) && x.r >= top.r && x.r <= bot.r);
        if (!resCell && !linkCell && !winnerCell) continue;   // no hay partido (p.ej. clasificados de una previa)
        const p1 = top.text, p2 = bot.text;
        if (!p1 && !p2 && !resCell) continue;                 // ronda futura sin nadie todavía
        const resultado = resCell ? resCell.resultado : null;
        if (!resultado && ((/^BYE$/i.test(p1) && !p2) || (/^BYE$/i.test(p2) && !p1))) continue; // bye contra hueco vacío
        orden++;
        const prog = !resultado ? inCol.concat(inNext.filter(x => !isSlot(x))).map(x => x.text).find(x => x && /\d/.test(x)) || null : null;
        let ganador = null;
        const w = winnerCell && winnerCell.text ? norm(winnerCell.text) : null;
        if (w && p1 && w === norm(p1)) ganador = 1;
        else if (w && p2 && w === norm(p2)) ganador = 2;
        const bye = /^BYE$/i.test(p1) || /^BYE$/i.test(p2);
        const sc = parseScore(resultado);
        // En los cuadros el marcador viene desde el punto de vista del GANADOR.
        const sets = sc.sets.length ? (ganador === 2 ? sc.sets.map(([a, b]) => [b, a]) : sc.sets) : null;
        partidos.push({
          fase, ronda: headers[c], ronda_idx: rondaIdx, orden,
          pareja1: p1 || null, pareja2: p2 || null, ganador, resultado,
          sets: ganador ? sets : (sc.sets.length ? sc.sets : null),
          walkover: sc.walkover, retirada: sc.retirada, programado: prog,
          estado: bye ? 'bye' : (resultado || ganador ? 'jugado' : 'pendiente'),
          _orientado: !!ganador,
        });
      }
    }
  };
  process(mainCols, 'principal');
  process(consCols, 'consolacion');

  // Finalista = perdedor del último partido de la fase principal (si la última columna es la de campeones).
  const finales = partidos.filter(p => p.fase === 'principal');
  const maxR = Math.max(0, ...finales.map(p => p.ronda_idx));
  const fin = finales.filter(p => p.ronda_idx === maxR);
  if (campeon && fin.length === 1 && fin[0].ganador) finalista = fin[0].ganador === 1 ? fin[0].pareja2 : fin[0].pareja1;
  return { headers, partidos, campeon, finalista, campeon_consolacion: campeonCons };
}

// ─── Liguilla (Liguilla3 / Liguilla3p / Liguilla4) ───────────────────────────
export function parseLiguilla(html) {
  const partidos = [];
  const parts = html.split(/<div[^>]*class=["']grupoliguilla["'][^>]*>/i).slice(1);
  let orden = 0;
  for (const part of parts) {
    const t = extractTable(part, /<table\b[^>]*>/i);
    if (!t) continue;
    const { cells } = buildGrid(t.inner);
    const jornada = (cells.find(c => c.r === 0) || {}).text || null;
    const cols = new Map();
    for (const c of cells) {
      if (c.r === 0) continue;
      if (!cols.has(c.c)) cols.set(c.c, []);
      cols.get(c.c).push(c);
    }
    for (const [, list] of [...cols.entries()].sort((a, b) => a[0] - b[0])) {
      const names = list.filter(c => c.resultado == null && c.text).sort((a, b) => a.r - b.r);
      for (let k = 0; k + 1 < names.length; k += 2) {
        const top = names[k], bot = names[k + 1];
        const res = list.find(c => c.resultado != null && c.r > top.r && c.r < bot.r);
        const resultado = res && res.resultado ? res.resultado : null;
        const sc = parseScore(resultado);
        // En las liguillas el marcador viene desde el punto de vista de la pareja de ARRIBA.
        let ganador = null;
        if (sc.sets.length && !sc.retirada) {
          const [a, b] = setsWonBy(sc.sets);
          ganador = a > b ? 1 : b > a ? 2 : null;
        }
        orden++;
        partidos.push({
          fase: 'liguilla', ronda: jornada, ronda_idx: toInt((/(\d+)/.exec(jornada || '') || [])[1]), orden,
          pareja1: top.text, pareja2: bot.text, ganador, resultado,
          sets: sc.sets.length ? sc.sets : null, walkover: sc.walkover, retirada: sc.retirada, programado: null,
          estado: resultado ? 'jugado' : 'pendiente', _orientado: true,
        });
      }
    }
  }
  // Clasificación del grupo
  const clasif = [];
  const iCl = html.search(/Clasificaci(ó|&oacute;|o)n:/i);
  if (iCl >= 0) {
    const t = extractTable(html.slice(iCl), /<table\b[^>]*>/i);
    if (t) for (const r of rows(t.inner)) {
      const c = r.cells.map(x => x.text);
      if (c.length < 11 || !/^\d+$/.test(c[0])) continue;
      clasif.push({ posicion: clasif.length + 1, pos_mostrada: +c[0], pareja: c[1], puntos: toInt(c[2]), pg: toInt(c[3]), pp: toInt(c[4]), sg: toInt(c[5]), sp: toInt(c[6]), dif_sets: toInt(c[7]), jg: toInt(c[8]), jp: toInt(c[9]), dif_juegos: toInt(c[10]) });
    }
  }
  const campeon = clasif.length && partidos.length && partidos.every(p => p.estado === 'jugado') ? clasif[0].pareja : null;
  return { partidos, clasif, campeon };
}

// ─── Orden de juego ──────────────────────────────────────────────────────────
function fechaLarga(s) {
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i.exec(s || '');
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')];
  return mes ? `${m[3]}-${pad(mes)}-${pad(m[1])}` : null;
}
export function parseOrdenJuego(html) {
  const out = [];
  let seq = 0;
  for (const chunk of html.split(/class=["']panel-heading["']/i).slice(1)) {
    const h = /<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(chunk);
    const fecha = fechaLarga(decode(h ? h[1] : ''));
    for (const r of rows(chunk)) {
      const c = r.cells.map(x => x.text);
      if (c.length < 7 || /^Lugar$/i.test(c[0])) continue;
      const [p1, p2] = c[5].split(/\s+vs\.?\s+/i);
      seq++;
      out.push({ seq, fecha, lugar: c[0] || null, hora: c[1] || null, categoria: c[2] || null, cuadro: c[3] || null, genero: c[4] || null, pareja1: (p1 || '').trim() || null, pareja2: (p2 || '').trim() || null, resultado: c[6] || null });
    }
  }
  return out;
}

// ─── Rankings ────────────────────────────────────────────────────────────────
export function parseRankingOptions(html) {
  const sel = /<select[^>]*name=["']rnk["'][\s\S]*?<\/select>/i.exec(html);
  if (!sel) return [];
  return [...sel[0].matchAll(/<option\s+value=["'](\d+)["'][^>]*>\s*([^<]+?)\s*<\/option>/gi)]
    .map(m => ({ rnk: parseInt(m[1], 10), nombre: decode(m[2]) })).filter(o => o.rnk > 0);
}
export function parseRanking(html) {
  const t = extractTable(html, /<table[^>]*class=["']standard-table["'][^>]*>/i);
  if (!t) return { pruebas: [], filas: [] };
  const rs = rows(t.inner);
  if (!rs.length) return { pruebas: [], filas: [] };
  const header = rs[0].cells.map(c => c.text);
  const iPts = header.findIndex(h => /^puntos?$/i.test(h));
  const pruebas = header.slice(2, iPts).map((p, i) => ({ col: i + 1, prueba: p })).filter(p => p.prueba);
  const filas = [];
  for (const r of rs.slice(1)) {
    const c = r.cells;
    if (c.length < 3 || !/^\d+$/.test(c[0].text)) continue;
    const link = /Historico_Liga\?Id=(\d+)/i.exec(c[1].html);
    filas.push({
      posicion: +c[0].text,
      nombre: c[1].text,
      licencia: link ? parseInt(link[1], 10) : null,
      puntos: toInt(c[iPts >= 0 ? iPts : c.length - 1].text),
      detalle: pruebas.map(p => ({ col: p.col, prueba: p.prueba, puntos: toInt(c[1 + p.col].text) })),
    });
  }
  return { pruebas, filas };
}

// ─── Asignación de categorías (licencias) ────────────────────────────────────
export function parseLicencias(html) {
  const out = [];
  const t = extractTable(html, /<table[^>]*class=["']standard-table["'][^>]*>/i);
  if (!t) return out;
  for (const r of rows(t.inner)) {
    const c = r.cells.map(x => x.text);
    if (c.length < 3) continue;
    const lic = toInt(c[0]);
    if (!lic) continue;
    const { apellido, nombre } = splitApNom(c[1]);
    out.push({ licencia: lic, nombre_completo: c[1].trim(), apellidos: apellido, nombre, categoria: c[2] || null, nivel: toInt((/^(\d+)/.exec(c[2] || '') || [])[1]) });
  }
  return out;
}

export { attr };
