// Cliente HTTP respetuoso con la web de la FCP + caché en disco (gzip).
// - Una petición cada >= 1,6 s, nunca en paralelo (las redirecciones también esperan).
// - Reintento con espera creciente en errores de red / 5xx; 403/404 se devuelven tal cual.
// - Cada respuesta se guarda en cache/<hash>.json.gz (url, fetched_at, status, html) con un
//   índice en cache/index.jsonl, para poder re-parsear (--reparse) sin volver a pedir nada.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const BASE = 'https://federacioncantabradepadel.com';
const HOST = 'federacioncantabradepadel.com';
const DIR = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.resolve(DIR, '..', 'cache');
const MIN_GAP_MS = 1600;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

fs.mkdirSync(CACHE_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const stats = { net: 0, cache: 0, s403: 0, s404: 0, errors: 0, started: Date.now() };
let last = 0;
let offline = false;
/** En modo offline (--reparse) nunca se sale a la red: lo que no esté en caché vuelve vacío. */
export function setOffline(v) { offline = v; }

function keyOf(method, pth, body) {
  return crypto.createHash('sha1').update(`${method} ${pth} ${body || ''}`).digest('hex').slice(0, 20);
}

/** Form-urlencoded en ISO-8859-1 (la web es ASP latin1). */
export function encodeForm(params) {
  const enc = v => [...Buffer.from(String(v), 'latin1')]
    .map(c => (/[A-Za-z0-9_.~-]/.test(String.fromCharCode(c)) ? String.fromCharCode(c) : '%' + c.toString(16).toUpperCase().padStart(2, '0')))
    .join('');
  return Object.entries(params).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
}

async function throttle() {
  const wait = last + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  stats.net++;
}

async function raw(method, pth, body, redirects = 0) {
  await throttle();
  const r = await new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Accept-Encoding': 'identity',
      'Referer': BASE + '/',
    };
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(body);
      headers['Origin'] = BASE;
    }
    const req = https.request({ hostname: HOST, path: pth, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, html: Buffer.concat(chunks).toString('latin1') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('Timeout')));
    if (body) req.write(body);
    req.end();
  });
  last = Date.now();
  if ([301, 302, 303, 307, 308].includes(r.status) && r.location && redirects < 5) {
    let loc = r.location;
    if (loc.startsWith('http')) { const u = new URL(loc); loc = u.pathname + u.search; }
    else if (!loc.startsWith('/')) loc = '/' + loc;
    return raw('GET', loc, null, redirects + 1);
  }
  return { status: r.status, html: r.html, finalPath: pth };
}

/**
 * fetchPage('/Torneo-Inscritos?id=1')  o  fetchPage('/Torneos', { ano: 2026, ... })  (POST)
 * Devuelve { url, status, html, finalPath, fetched_at, fromCache }
 */
export async function fetchPage(pth, form = null, { refresh = false } = {}) {
  const method = form ? 'POST' : 'GET';
  const body = form ? encodeForm(form) : null;
  const key = keyOf(method, pth, body);
  const file = path.join(CACHE_DIR, key + '.json.gz');
  if (!refresh && fs.existsSync(file)) {
    stats.cache++;
    return { ...JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')), fromCache: true };
  }
  if (offline) return { url: pth, status: 0, html: '', finalPath: pth, fromCache: true, missing: true };
  let attempt = 0;
  for (;;) {
    try {
      const r = await raw(method, pth, body);
      if (r.status >= 500) throw new Error('HTTP ' + r.status);
      if (r.status === 403) stats.s403++;
      if (r.status === 404) stats.s404++;
      const rec = { url: pth, method, form, status: r.status, finalPath: r.finalPath, fetched_at: new Date().toISOString(), html: r.html };
      fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rec)));
      fs.appendFileSync(path.join(CACHE_DIR, 'index.jsonl'),
        JSON.stringify({ key, url: pth, method, form, status: r.status, finalPath: r.finalPath, fetched_at: rec.fetched_at }) + '\n');
      return { ...rec, fromCache: false };
    } catch (e) {
      attempt++;
      if (attempt > 4) { stats.errors++; return { url: pth, status: -1, html: '', finalPath: pth, error: e.message }; }
      const backoff = 5000 * attempt;
      console.warn(`  ! ${method} ${pth}: ${e.message} — reintento ${attempt}/4 en ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }
}
