// Servidor local del panel. Sirve la página, los renders y una API que lanza
// los scripts de producción (carruseles, reels, vídeos 16:9, fotos con Gemini)
// y va contando el progreso por SSE.
//
//   node panel/server.mjs          → http://localhost:4173
//
// Solo escucha en localhost: no hay autenticación porque no sale de tu máquina.
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as instagram from "./instagram.mjs";
import * as calendario from "./calendario.mjs";
import * as nube from "./nube.mjs";

const PANEL = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(PANEL, "..");           // TACTIUM-VIDEO
const RENDERS = path.join(ROOT, "renders");
const PORT = Number(process.env.PORT || 4173);
const PORT_HTTPS = PORT + 1; // 4174: solo para el vaivén de OAuth con Instagram

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".zip": "application/zip" };

const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
const safe = (base, rel) => { const p = path.resolve(base, "." + rel); return p.startsWith(base) ? p : null; };

function serveFile(res, file) {
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "No está", "text/plain");
  res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

/** Lee el cuerpo JSON de una petición (máx. 64 KB). */
function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let t = "";
    req.on("data", (c) => { t += c; if (t.length > 65536) { mal(new Error("Cuerpo demasiado grande")); req.destroy(); } });
    req.on("end", () => { try { ok(JSON.parse(t || "{}")); } catch { mal(new Error("JSON no válido")); } });
  });
}

/** Qué se puede generar: lee los ids reales del proyecto. */
function catalogo() {
  const specs = fs.readdirSync(path.join(ROOT, "carruseles")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  const piezas = [...fs.readFileSync(path.join(ROOT, "src/reel/piezas.ts"), "utf8").matchAll(/^\s+id: "([^"]+)"/gm)].map((m) => m[1]);
  const fotos = fs.existsSync(path.join(ROOT, "public/gen")) ? fs.readdirSync(path.join(ROOT, "public/gen")).filter((f) => f.endsWith(".png")) : [];
  return { carruseles: specs, piezas, fotos };
}

/** Los archivos que produce cada acción, para enseñarlos al acabar. */
function resultados(tipo, id) {
  if (tipo === "carrusel") {
    const dir = path.join(RENDERS, "carruseles", id);
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => `/renders/carruseles/${id}/${f}`) : [];
  }
  if (tipo === "reel") return [`/renders/${id}.mp4`];
  if (tipo === "video16x9") return [`/renders/${id}-16x9.mp4`];
  if (tipo === "foto") return [`/public/gen/${id}.png`];
  return [];
}

/** Traduce la petición al comando real. Todo corre con cwd = TACTIUM-VIDEO. */
function comando({ tipo, id, prompt, aspecto }) {
  const idOk = /^[A-Za-z0-9_-]+$/.test(id || "");
  if (tipo === "carrusel" && idOk) return ["node", ["scripts/carruseles.mjs", id]];
  if (tipo === "reel" && idOk) return ["npx", ["remotion", "render", "src/index.ts", `reel-${id}`, `renders/${id}.mp4`]];
  if (tipo === "video16x9" && idOk) return ["npx", ["remotion", "render", "src/index.ts", `ancho-${id}`, `renders/${id}-16x9.mp4`]];
  if (tipo === "foto" && idOk && prompt) return ["node", ["scripts/gen-foto.mjs", `public/gen/${id}.png`, prompt, aspecto || "4:5"]];
  return null;
}

const handler = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/catalogo") return send(res, 200, catalogo());


  if (url.pathname === "/api/calendario" && req.method === "GET") {
    try { return send(res, 200, calendario.completo()); }
    catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (url.pathname === "/api/calendario/pieza" && req.method === "POST") {
    return leerCuerpo(req)
      .then(({ id, cambios }) => send(res, 200, calendario.actualizar(String(id), cambios || {})))
      .catch((e) => send(res, 400, { error: e.message }));
  }

  if (url.pathname === "/api/instagram") {
    return instagram.metricas({ fresco: url.searchParams.get("fresco") === "1" })
      .then((m) => { const vinculadas = calendario.autoVincular(m.media); send(res, 200, { ...m, vinculadas }); })
      .catch((e) => send(res, 502, { error: e.message }));
  }

  // ── Publicación automática en la nube ────────────────────────────────────
  if (url.pathname === "/api/nube" && req.method === "GET") {
    if (!nube.configurada()) return send(res, 200, { configurada: false, filas: [], avisos: [] });
    return nube.estado().then((e) => send(res, 200, { configurada: true, ...e })).catch((e) => send(res, 502, { error: e.message }));
  }

  if (url.pathname.startsWith("/api/nube/") && req.method === "POST") {
    const accion = url.pathname.slice("/api/nube/".length);
    const acciones = { programar: (id) => nube.programar(id), cancelar: nube.cancelar, probar: nube.probar, publicar: nube.publicarAhora, grabar: nube.programarGrabacion };
    if (!acciones[accion]) return send(res, 404, { error: "Acción desconocida" });
    return leerCuerpo(req)
      .then(async ({ id, ids }) => {
        if (Array.isArray(ids)) {
          // Programar varias (la semana): se hacen de una en una y se cuenta qué salió.
          const hechas = [], fallos = [];
          for (const x of ids) { try { await acciones[accion](String(x)); hechas.push(x); } catch (e) { fallos.push({ id: x, error: e.message }); } }
          return send(res, 200, { hechas, fallos });
        }
        return send(res, 200, await acciones[accion](String(id)));
      })
      .catch((e) => send(res, 400, { error: e.message }));
  }

  // Miniaturas de Instagram servidas desde aquí, con copia en disco: las URLs de su
  // CDN caducan a los pocos días y así el panel sigue enseñándolas.
  if (url.pathname === "/api/miniatura") {
    const id = url.searchParams.get("id") || "";
    if (!/^\d+$/.test(id)) return send(res, 400, "id no válido", "text/plain");
    const dir = path.join(RENDERS, "ig-miniaturas");
    const jpg = path.join(dir, id + ".jpg");
    if (fs.existsSync(jpg)) return serveFile(res, jpg);
    const origen = instagram.urlMiniatura(id);
    if (!origen) return send(res, 404, "Sin miniatura", "text/plain");
    return fetch(origen).then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(jpg, Buffer.from(await r.arrayBuffer()));
      serveFile(res, jpg);
    }).catch(() => send(res, 404, "Miniatura caducada: actualiza Instagram", "text/plain"));
  }

  // Un fotograma de cada reel, para usarlo de miniatura. Se saca una vez con ffmpeg.
  if (url.pathname === "/api/poster") {
    const id = url.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return send(res, 400, "id no válido", "text/plain");
    // Del vídeo 16:9 si lo hay (es el que se publica); si no, del vertical más reciente.
    const nuevo = (xs) => xs.map((s) => path.join(RENDERS, id + s)).filter((f) => fs.existsSync(f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const video = nuevo(["-16x9.mp4", "-16x9-web.mp4"]) || nuevo(["-ig.mp4", ".mp4"]);
    if (!video) return send(res, 404, "Sin vídeo", "text/plain");
    const dir = path.join(RENDERS, "posters");
    const jpg = path.join(dir, `${id}${video.includes("-16x9") ? "-16x9" : ""}.jpg`);
    if (fs.existsSync(jpg) && fs.statSync(jpg).mtimeMs >= fs.statSync(video).mtimeMs) return serveFile(res, jpg);
    fs.mkdirSync(dir, { recursive: true });
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-ss", "2", "-i", video, "-frames:v", "1", "-vf", "scale=360:-1", jpg]);
    ff.on("close", (code) => (code === 0 ? serveFile(res, jpg) : send(res, 500, "ffmpeg falló", "text/plain")));
    return;
  }

  if (url.pathname === "/oauth/iniciar") {
    try { res.writeHead(302, { location: instagram.urlAutorizar() }); res.end(); }
    catch (e) { send(res, 400, { error: e.message }); }
    return;
  }

  if (url.pathname === "/oauth/callback") {
    const code = url.searchParams.get("code");
    if (!code) return send(res, 400, "Falta el código que debía mandar Instagram", "text/plain");
    return instagram.terminarAutorizacion(code)
      .then(({ dias }) => { res.writeHead(302, { location: `/?datos=publicaciones&token=ok&dias=${dias}` }); res.end(); })
      .catch((e) => send(res, 400, `No se pudo completar: ${e.message}`, "text/plain"));
  }

  if (url.pathname === "/api/instagram/token/canjear") {
    return instagram.canjearTokenLargo().then((r) => send(res, 200, r)).catch((e) => send(res, 400, { error: e.message }));
  }

  if (url.pathname === "/api/instagram/token/renovar") {
    return instagram.renovarTokenLargo().then((r) => send(res, 200, r)).catch((e) => send(res, 400, { error: e.message }));
  }

  if (url.pathname === "/api/generar") {
    const params = Object.fromEntries(url.searchParams);
    const cmd = comando(params);
    if (!cmd) return send(res, 400, { error: "Petición no válida" });
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    const evento = (tipo, datos) => res.write(`event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`);
    evento("inicio", { comando: [cmd[0], ...cmd[1]].join(" ") });
    const hijo = spawn(cmd[0], cmd[1], { cwd: ROOT, shell: process.platform === "win32", env: process.env });
    const linea = (chunk) => chunk.toString().replace(/\x1b\[[0-9;]*m/g, "").split(/\r?\n|\r/).filter(Boolean).forEach((l) => evento("linea", { l }));
    hijo.stdout.on("data", linea);
    hijo.stderr.on("data", linea);
    hijo.on("close", (code) => { evento("fin", { code, archivos: code === 0 ? resultados(params.tipo, params.id) : [] }); res.end(); });
    req.on("close", () => hijo.kill());
    return;
  }

  if (url.pathname.startsWith("/renders/")) return serveFile(res, safe(RENDERS, url.pathname.slice("/renders".length)));
  if (url.pathname.startsWith("/public/")) return serveFile(res, safe(path.join(ROOT, "public"), url.pathname.slice("/public".length)));
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  return serveFile(res, safe(PANEL, rel));
};

http.createServer(handler).listen(PORT, "127.0.0.1", () => console.log(`Panel en http://localhost:${PORT}`));

// Un segundo servidor, idéntico, pero por HTTPS con certificado local: Meta exige
// https:// hasta para la URL de redirección de OAuth. Solo se usa para ese vaivén
// con Instagram; el resto del panel se sigue usando por http normal.
const CERT_KEY = path.join(PANEL, "certs/dev-key.pem");
const CERT_CRT = path.join(PANEL, "certs/dev-cert.pem");
if (fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT)) {
  https
    .createServer({ key: fs.readFileSync(CERT_KEY), cert: fs.readFileSync(CERT_CRT) }, handler)
    .listen(PORT_HTTPS, "127.0.0.1", () => console.log(`Panel también en https://127.0.0.1:${PORT_HTTPS} (para OAuth)`));
}
