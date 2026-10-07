#!/usr/bin/env node
// Recopilador de los CIRCUITOS de la Federación Cántabra de Pádel → tablas fcp_circuito_* (TACTIUM).
//
// PRIVADO: los datos no se enseñan hasta que la FCP lo autorice (las tablas no tienen
// políticas RLS; solo el service_role las lee). Fuera de alcance: circuito de MENORES.
//
// Uso (desde TACTIUM/scripts/fcp-circuito):
//   node recopilar.mjs --todo                    licencias + rankings + torneos 2026 y 2025
//   node recopilar.mjs --anio 2026[,2025]        torneos de esos años (absoluto + Master)
//   node recopilar.mjs --torneo 30155            un torneo
//   node recopilar.mjs --rankings                ranking del circuito (114–129) y absoluto (125/126)
//   node recopilar.mjs --licencias               /Asignacion-Categorias (licencia + nombre + categoría)
//   node recopilar.mjs --reparse [modos]         sin red: vuelve a parsear lo que hay en cache/ (sin modos = --todo)
//   --cache    reutiliza la caché si existe (sin --cache se piden las páginas de nuevo)
//   --dry      no escribe en la BD
//   --estimar  cuenta torneos y cuadros (pocas peticiones) y calcula peticiones/tiempo totales
//
// Ritmo: una petición cada 1,6 s como mínimo, nunca en paralelo, reintentos con espera.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { fetchPage, stats, setOffline } from './lib/http.mjs';
import {
  parseListado, parseCalendario, parseCuadrosIndex, parseInscritos, parseEliminatoria, parseLiguilla,
  parseOrdenJuego, parseRankingOptions, parseRanking, parseLicencias, setsWonBy, splitPareja,
} from './lib/parsers.mjs';
import { norm } from './lib/html.mjs';
import { LicenciaIndex, makeTorneoResolver } from './lib/cruce.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(DIR, '../../package.json'));

// ─── Argumentos ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const opt = {
  anios: (val('--anio') || '').split(',').map(s => parseInt(s, 10)).filter(Boolean),
  torneo: val('--torneo') ? parseInt(val('--torneo'), 10) : null,
  rankings: has('--rankings'),
  licencias: has('--licencias'),
  reparse: has('--reparse'),
  cache: has('--cache') || has('--reparse'),
  dry: has('--dry'),
  estimar: has('--estimar'),
};
if (has('--todo') || (opt.reparse && !opt.anios.length && !opt.torneo && !opt.rankings && !opt.licencias)) {
  opt.anios = [2026, 2025]; opt.rankings = true; opt.licencias = true;
}
if (!opt.anios.length && !opt.torneo && !opt.rankings && !opt.licencias && !opt.estimar) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n'));
  process.exit(1);
}
if (opt.reparse) setOffline(true);
const get = (p, form) => fetchPage(p, form, { refresh: !opt.cache });
const log = (...a) => console.log(...a);

// ─── Supabase (service_role de tactium-web/.env.local; nunca se imprime) ─────
function loadEnv() {
  const f = path.resolve(DIR, '../../../tactium-web/.env.local');
  const env = {};
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
let sb = null;
function db() {
  if (sb) return sb;
  const env = loadEnv();
  const { createClient } = require('@supabase/supabase-js');
  sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return sb;
}
const written = {};
async function upsert(table, rowsIn, onConflict) {
  if (!rowsIn.length) return;
  written[table] = (written[table] || 0) + rowsIn.length;
  if (opt.dry) return;
  for (let i = 0; i < rowsIn.length; i += 500) {
    const { error } = await db().from(table).upsert(rowsIn.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
async function del(table, col, v) {
  if (opt.dry) return;
  const { error } = await db().from(table).delete().eq(col, v);
  if (error) throw new Error(`${table} delete: ${error.message}`);
}
async function selectAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// ─── Licencias ───────────────────────────────────────────────────────────────
async function recopilarLicencias() {
  log('\n═══ LICENCIAS (/Asignacion-Categorias) ═══');
  const all = new Map();
  for (const genero of ['M', 'F']) {
    const r = await get('/Asignacion-Categorias', { accion: 'buscar', dni: '', numlicencia: '', genero, nombre: '', categoria: 'T', equipo: 'T' });
    const lics = parseLicencias(r.html);
    log(`  ${genero}: ${lics.length} licencias (HTTP ${r.status})`);
    for (const l of lics) all.set(l.licencia, { ...l, genero });
  }
  const now = new Date().toISOString();
  await upsert('fcp_circuito_licencias', [...all.values()].map(l => ({ ...l, updated_at: now })), 'licencia');
  log(`  → ${all.size} licencias`);
  return [...all.values()];
}
let licIndex = null;
let rankingExtra = null; // jugadores del ranking absoluto (con licencia) para quien no sale en Asignación
async function getLicIndex() {
  if (licIndex) return licIndex;
  let lics;
  if (opt.dry || opt.reparse) {
    // Sin tocar la BD: sacarlas de la caché si están.
    lics = [];
    for (const genero of ['M', 'F']) {
      const r = await fetchPage('/Asignacion-Categorias', { accion: 'buscar', dni: '', numlicencia: '', genero, nombre: '', categoria: 'T', equipo: 'T' }, { refresh: false });
      for (const l of parseLicencias(r.html)) lics.push({ ...l, genero });
    }
    if (!lics.length && !opt.dry) lics = await selectAll('fcp_circuito_licencias', 'licencia,nombre,apellidos,genero');
  } else {
    lics = await selectAll('fcp_circuito_licencias', 'licencia,nombre,apellidos,genero');
  }
  if (!rankingExtra && !opt.dry && !opt.reparse) {
    const r = await selectAll('fcp_circuito_ranking', 'rnk,nombre,licencia,genero');
    rankingExtra = r.filter(x => (x.rnk === 125 || x.rnk === 126) && x.licencia).map(x => ({ licencia: x.licencia, nombreCompleto: x.nombre, genero: x.genero }));
  }
  licIndex = new LicenciaIndex(lics, rankingExtra || []);
  log(`  (índice de licencias: ${licIndex.size})`);
  return licIndex;
}

// ─── Rankings ────────────────────────────────────────────────────────────────
async function recopilarRankings(torneosConocidos) {
  log('\n═══ RANKINGS (modalidad ABSOLUTO) ═══');
  const g = await get('/Rankings');
  // Liga (112/113) ya la trae el agente FCP; aquí solo circuito por categoría + absoluto.
  const opciones = parseRankingOptions(g.html).filter(o => !/LIGA/i.test(o.nombre));
  const fecha = new Date().toISOString().slice(0, 10);
  const idx = await getLicIndex();
  const datos = [];
  for (const o of opciones) {
    const r = await get('/Rankings', { modalidad: 'ABSOLUTO', rnk: o.rnk, nombre: '' });
    const p = parseRanking(r.html);
    datos.push({ ...o, ...p, genero: /FEMEN/i.test(o.nombre) ? 'F' : 'M' });
    log(`  [${o.rnk}] ${o.nombre}: ${p.filas.length} jugadores, ${p.pruebas.length} pruebas`);
  }
  // Licencia por nombre exacto en el ranking absoluto del mismo género.
  const absByName = { M: new Map(), F: new Map() };
  for (const d of datos.filter(d => /ABSOLUTO/i.test(d.nombre))) {
    for (const f of d.filas) {
      const k = norm(f.nombre);
      const m = absByName[d.genero];
      if (!m.has(k)) m.set(k, new Set());
      if (f.licencia) m.get(k).add(f.licencia);
    }
  }
  // Prueba (cabecera) → id_torneo. Mismo nombre en dos años: el más reciente ya empezado.
  const torneoPorNombre = new Map();
  for (const t of [...torneosConocidos].sort((a, b) => (a.fecha_inicio || '').localeCompare(b.fecha_inicio || ''))) {
    if (t.fecha_inicio && t.fecha_inicio > fecha) continue;
    torneoPorNombre.set(norm(t.nombre), t.id_torneo);
  }
  const filas = [], detalle = [];
  let sinTorneo = new Set();
  for (const d of datos) {
    for (const f of d.filas) {
      let licencia = f.licencia, cruce = licencia ? 'enlace' : null;
      if (!licencia) {
        const s = absByName[d.genero].get(norm(f.nombre));
        if (s && s.size === 1) { licencia = [...s][0]; cruce = 'nombre_unico'; }
        else if (s && s.size > 1) cruce = 'ambiguo';
        else {
          // No sale en el absoluto: probar el nombre completo en /Asignacion-Categorias.
          const l = idx.byFull.get(`${d.genero}|${norm(f.nombre)}`);
          if (l && l.size === 1) { licencia = [...l][0]; cruce = 'licencias'; }
          else cruce = l && l.size > 1 ? 'ambiguo' : 'sin_cruce';
        }
      }
      filas.push({ fecha, rnk: d.rnk, ranking: d.nombre, genero: d.genero, posicion: f.posicion, nombre: f.nombre, licencia, cruce, puntos: f.puntos });
      for (const x of f.detalle) {
        const id = torneoPorNombre.get(norm(x.prueba)) ?? null;
        if (!id) sinTorneo.add(x.prueba);
        detalle.push({ fecha, rnk: d.rnk, posicion: f.posicion, nombre: f.nombre, col: x.col, prueba: x.prueba, id_torneo: id, puntos: x.puntos });
      }
    }
  }
  // Duplicados exactos (mismo nombre y posición) no caben en la PK: quedarse con el primero.
  const uniq = (arr, key) => [...new Map(arr.map(r => [key(r), r])).values()];
  await upsert('fcp_circuito_ranking', uniq(filas, r => `${r.rnk}|${r.posicion}|${r.nombre}`), 'fecha,rnk,posicion,nombre');
  await upsert('fcp_circuito_ranking_detalle', uniq(detalle, r => `${r.rnk}|${r.posicion}|${r.nombre}|${r.col}`), 'fecha,rnk,posicion,nombre,col');
  const conLic = filas.filter(f => f.licencia).length;
  log(`  → ${filas.length} filas de ranking (${conLic} con licencia), ${detalle.length} celdas de desglose`);
  if (sinTorneo.size) log(`  ! pruebas sin torneo cruzado: ${[...sinTorneo].join(' | ')}`);
  void idx;
  // A partir de aquí el índice de licencias incluye también a los del ranking absoluto.
  rankingExtra = filas.filter(f => (f.rnk === 125 || f.rnk === 126) && f.licencia && f.cruce === 'enlace')
    .map(f => ({ licencia: f.licencia, nombreCompleto: f.nombre, genero: f.genero }));
  licIndex = null;
}

// ─── Torneos ─────────────────────────────────────────────────────────────────
async function listarTorneos(anio) {
  const r = await get('/Torneos', { ano: anio, tipo: '-', categoria: 'Absoluto' });
  const list = parseListado(r.html, anio);
  // El Master sale también en /Masters; se añade por si algún año no aparece en el listado absoluto.
  const m = await get('/Masters', { ano: anio });
  for (const t of parseListado(m.html, anio)) if (!list.some(x => x.id_torneo === t.id_torneo)) list.push({ ...t, modalidad: 'MASTER' });
  // Sedes desde /Calendario (categoría 1 = absoluta), cruzando por fecha de inicio.
  const c = await get('/Calendario', { ano: anio, categoria: 1 });
  const cal = parseCalendario(c.html, anio);
  for (const t of list) {
    const hit = cal.filter(x => x.inicio === t.fecha_inicio);
    t.sede = hit.length === 1 ? hit[0].sede : (hit.find(x => /MASTER/i.test(x.prueba) === (t.modalidad === 'MASTER')) || {}).sede || null;
  }
  return list;
}

const resumenTorneos = [];
const problemas = [];
const orientCheck = { ok: 0, ko: 0, ejemplos: [] };

async function recopilarTorneo(t) {
  log(`\n─── ${t.id_torneo} · ${t.nombre} (${t.anio}, ${t.estado || '?'})`);
  const idx = await getLicIndex();
  const prev = await get(`/Torneo_previo?id=${t.id_torneo}`);
  const destino = (prev.finalPath || '').replace(/^\//, '').split('?')[0];
  t.pagina_destino = destino || null;
  let cuadrosIdx = [];
  if (/Cuadros/i.test(destino)) cuadrosIdx = parseCuadrosIndex(prev.html);
  else {
    // Torneo-Info (solo cartel): probar la página de cuadros por si existe.
    const c = await get(`/Torneo-Cuadros-Absoluto?id=${t.id_torneo}`);
    if (c.status === 200) cuadrosIdx = parseCuadrosIndex(c.html);
  }
  t.n_cuadros = cuadrosIdx.length;

  // Inscritos
  const ins = await get(`/Torneo-Inscritos?id=${t.id_torneo}`);
  const inscritos = parseInscritos(ins.html);
  const resolve = makeTorneoResolver(idx, inscritos);

  // Cuadros
  const cuadros = [], partidos = [], clasifs = [];
  for (const q of cuadrosIdx) {
    const id_cuadro = `${t.id_torneo}_${q.genero}_${q.nivel}_${q.cuadro_param}`;
    const r = await get(q.href);
    const tpl = /\/Cuadros\/([^?]*)/.exec(r.finalPath || '');
    const plantilla = tpl && tpl[1] ? tpl[1] : null;
    const cu = {
      id_cuadro, id_torneo: t.id_torneo, genero: q.genero, nivel: q.nivel, cuadro_param: q.cuadro_param, etiqueta: q.etiqueta,
      plantilla, http_status: r.status, url: r.finalPath || q.href, campeon: null, finalista: null, campeon_consolacion: null,
      n_partidos: 0, estado: 'ok',
      tipo: /Liguilla/i.test(plantilla || '') ? 'liguilla' : (q.nivel === 21 || /Previa/i.test(plantilla || '')) ? 'previa' : 'eliminatoria',
    };
    if (r.status !== 200 || !plantilla) {
      cu.estado = r.status === 403 ? 'sin_plantilla_403' : r.status === -1 ? 'error' : `http_${r.status}`;
      problemas.push(`${id_cuadro} «${q.etiqueta}»: ${cu.estado} (${r.finalPath})`);
      cuadros.push(cu);
      continue;
    }
    const parsed = cu.tipo === 'liguilla' ? parseLiguilla(r.html) : parseEliminatoria(r.html);
    if (!parsed || !parsed.partidos.length) {
      cu.estado = 'vacio';
      problemas.push(`${id_cuadro} «${q.etiqueta}» (${plantilla}): sin partidos legibles`);
    }
    if (parsed) {
      cu.campeon = parsed.campeon || null;
      cu.finalista = parsed.finalista || null;
      cu.campeon_consolacion = parsed.campeon_consolacion || null;
      cu.n_partidos = parsed.partidos.length;
      for (const p of parsed.partidos) {
        // Control: en los cuadros el marcador va desde el punto de vista del ganador.
        if (p.fase !== 'liguilla' && p.ganador && p.resultado && !p.walkover && !p.retirada) {
          const raw = p.ganador === 2 ? p.sets.map(([a, b]) => [b, a]) : p.sets;
          const [a, b] = setsWonBy(raw);
          if (a > b) orientCheck.ok++; else { orientCheck.ko++; if (orientCheck.ejemplos.length < 8) orientCheck.ejemplos.push(`${id_cuadro} ${p.ronda} ${p.resultado}`); }
        }
        const j = [...splitPareja(p.pareja1), ...[undefined, undefined]].slice(0, 2);
        const k = [...splitPareja(p.pareja2), ...[undefined, undefined]].slice(0, 2);
        const R = s => (s ? resolve(s, q.genero) : { nombre: null, licencia: null, cruce: null });
        const [a1, a2, b1, b2] = [R(j[0]), R(j[1]), R(k[0]), R(k[1])];
        const { _orientado, ...rest } = p;
        partidos.push({
          id_partido: `${id_cuadro}_${p.fase}_${p.ronda_idx ?? 0}_${p.orden}`, id_cuadro, id_torneo: t.id_torneo, ...rest,
          p1_j1: a1.nombre, p1_j1_licencia: a1.licencia, p1_j1_cruce: a1.cruce,
          p1_j2: a2.nombre, p1_j2_licencia: a2.licencia, p1_j2_cruce: a2.cruce,
          p2_j1: b1.nombre, p2_j1_licencia: b1.licencia, p2_j1_cruce: b1.cruce,
          p2_j2: b2.nombre, p2_j2_licencia: b2.licencia, p2_j2_cruce: b2.cruce,
        });
      }
      for (const c of parsed.clasif || []) clasifs.push({ id_cuadro, ...c });
    }
    cuadros.push(cu);
  }

  // Licencias de los inscritos: con la inicial del 2º apellido si el jugador aparece en algún cuadro.
  const inicialDe = new Map();
  for (const p of partidos) for (const s of [p.p1_j1, p.p1_j2, p.p2_j1, p.p2_j2]) {
    if (!s) continue;
    const m = /^(.*?)\s+([A-ZÑ])?\.$/.exec(s.trim());
    if (m) inicialDe.set(norm(m[1]), m[2] ? norm(m[2]) : null);
  }
  const insRows = inscritos.map(i => {
    const out = { id_torneo: t.id_torneo, ...i };
    for (const n of ['j1', 'j2']) {
      const nombre = i[`${n}_nombre`], apellido1 = i[`${n}_apellido`];
      const k = norm(`${nombre} ${apellido1}`);
      const r = inicialDe.has(k)
        ? idx.resolve({ nombre, apellido1, inicial: inicialDe.get(k), genero: i.genero }, true)
        : idx.resolve({ nombre, apellido1, inicial: undefined, genero: i.genero }, true);
      out[`${n}_licencia`] = r.licencia; out[`${n}_cruce`] = r.cruce;
    }
    return out;
  });
  // Duplicados de número en la misma categoría (no debería): conservar el primero.
  const insUniq = [...new Map(insRows.map(r => [`${r.genero}|${r.nivel}|${r.num}`, r])).values()];

  // Orden de juego
  const o = await get(`/Torneo-OrdenDeJuego?id=${t.id_torneo}`);
  const orden = parseOrdenJuego(o.html).map(x => ({ id_torneo: t.id_torneo, ...x }));
  t.sedes_orden = [...new Set(orden.map(x => x.lugar).filter(Boolean))].sort();

  if (process.env.DUMP) fs.writeFileSync(path.join(DIR, 'cache', `dump-${t.id_torneo}.json`), JSON.stringify({ cuadros, partidos, insRows }, null, 1));
  // Escritura: se rehace el torneo entero (borrar hijos y volver a insertar).
  const now = new Date().toISOString();
  await upsert('fcp_circuito_torneos', [{ ...t, updated_at: now }], 'id_torneo');
  await del('fcp_circuito_cuadros', 'id_torneo', t.id_torneo);   // cascada: partidos y clasificaciones
  await del('fcp_circuito_inscritos', 'id_torneo', t.id_torneo);
  await del('fcp_circuito_orden_juego', 'id_torneo', t.id_torneo);
  await upsert('fcp_circuito_cuadros', cuadros.map(c => ({ ...c, updated_at: now })), 'id_cuadro');
  await upsert('fcp_circuito_partidos', partidos.map(p => ({ ...p, updated_at: now })), 'id_partido');
  await upsert('fcp_circuito_grupos_clasif', clasifs.map(c => ({ ...c, updated_at: now })), 'id_cuadro,posicion');
  await upsert('fcp_circuito_inscritos', insUniq.map(c => ({ ...c, updated_at: now })), 'id_torneo,genero,nivel,num');
  await upsert('fcp_circuito_orden_juego', orden.map(c => ({ ...c, updated_at: now })), 'id_torneo,seq');

  const slots = partidos.flatMap(p => [p.p1_j1_cruce, p.p1_j2_cruce, p.p2_j1_cruce, p.p2_j2_cruce]).filter(Boolean);
  const res = {
    id: t.id_torneo, nombre: t.nombre, cuadros: cuadros.length, cuadros_ok: cuadros.filter(c => c.estado === 'ok').length,
    partidos: partidos.length, inscritos: insUniq.length, orden: orden.length,
    cruce_alta: slots.filter(s => s === 'alta').length, cruce_media: slots.filter(s => s === 'media').length,
    cruce_ambiguo: slots.filter(s => s === 'ambiguo').length, sin_cruce: slots.filter(s => s === 'sin_cruce').length,
  };
  resumenTorneos.push(res);
  log(`    cuadros ${res.cuadros_ok}/${res.cuadros} · partidos ${res.partidos} · inscritos ${res.inscritos} · orden ${res.orden} · cruce alta ${res.cruce_alta} media ${res.cruce_media} ambiguo ${res.cruce_ambiguo} sin ${res.sin_cruce}`);
}

// ─── Estimación ──────────────────────────────────────────────────────────────
async function estimar(anios) {
  let torneos = 0, cuadros = 0;
  for (const a of anios) {
    for (const t of await listarTorneos(a)) {
      torneos++;
      const prev = await get(`/Torneo_previo?id=${t.id_torneo}`);
      const n = /Cuadros/i.test(prev.finalPath || '') ? parseCuadrosIndex(prev.html).length : 0;
      cuadros += n;
      log(`  ${a} ${t.id_torneo} ${t.nombre}: ${n} cuadros`);
    }
  }
  // por torneo: previo(+redirección)=2, inscritos(+redir)=2, orden=1 · por cuadro: 2 (redirección a la plantilla)
  const peticiones = anios.length * 3 + torneos * 5 + cuadros * 2 + 20 + 2;
  log(`\nEstimación: ${torneos} torneos, ${cuadros} cuadros → ~${peticiones} peticiones ≈ ${Math.round(peticiones * 1.9 / 60)} min`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  try {
    if (opt.estimar) { await estimar(opt.anios.length ? opt.anios : [2026, 2025]); }
    else {
      if (opt.licencias) await recopilarLicencias();
      let torneos = [];
      for (const a of opt.anios) {
        const l = await listarTorneos(a);
        log(`\n═══ ${a}: ${l.length} torneos (absoluto + Master) ═══`);
        torneos.push(...l);
      }
      if (opt.torneo && !torneos.some(t => t.id_torneo === opt.torneo)) {
        let found = null;
        for (const a of [2026, 2025, 2024]) { found = (await listarTorneos(a)).find(t => t.id_torneo === opt.torneo); if (found) break; }
        if (!found) throw new Error(`torneo ${opt.torneo} no está en los listados absolutos 2024–2026`);
        torneos = [found];
      } else if (opt.torneo) torneos = torneos.filter(t => t.id_torneo === opt.torneo);
      // Rankings antes que los torneos: el ranking absoluto amplía el índice de licencias.
      if (opt.rankings) {
        let conocidos = [...torneos];
        if (!opt.dry && !opt.reparse) for (const t of await selectAll('fcp_circuito_torneos', 'id_torneo,nombre,fecha_inicio')) if (!conocidos.some(x => x.id_torneo === t.id_torneo)) conocidos.push(t);
        await recopilarRankings(conocidos);
      }
      for (const t of torneos) {
        try { await recopilarTorneo(t); }
        catch (e) { console.error(`  ✗ torneo ${t.id_torneo}: ${e.message}`); problemas.push(`torneo ${t.id_torneo}: ${e.message}`); process.exitCode = 1; }
      }
    }
  } catch (e) {
    console.error('\n✗', e.message);
    process.exitCode = 1;
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  log('\n═══ RESUMEN ═══');
  log(`Peticiones a la FCP: ${stats.net} (caché: ${stats.cache}) · 403: ${stats.s403} · 404: ${stats.s404} · errores: ${stats.errors} · ${Math.floor(secs / 60)} min ${secs % 60} s`);
  if (Object.keys(written).length) log('Filas escritas' + (opt.dry ? ' (DRY, no se escribió nada)' : '') + ':', written);
  if (orientCheck.ok + orientCheck.ko) log(`Control marcador = punto de vista del ganador: ${orientCheck.ok} OK, ${orientCheck.ko} no cuadran`, orientCheck.ejemplos);
  if (problemas.length) { log(`Cuadros no leídos (${problemas.length}):`); for (const p of problemas) log('  - ' + p); }
  fs.writeFileSync(path.join(DIR, 'cache', `resumen-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify({ opt, stats, secs, written, orientCheck, problemas, resumenTorneos }, null, 2));
})();
