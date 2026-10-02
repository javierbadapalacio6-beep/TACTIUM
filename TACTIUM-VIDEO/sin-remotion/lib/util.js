// Utilidades deterministas: todo depende solo del tiempo, nunca de Date/Math.random,
// para que cada fotograma salga igual se renderice cuantas veces se renderice.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** Progreso 0→1 de un tramo que empieza en `a` y dura `d` segundos. */
export const prog = (t, a, d) => clamp((t - a) / d);
export const eOut = (p) => 1 - Math.pow(1 - p, 3);
export const eInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const eBack = (p) => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
export const lerp = (a, b, p) => a + (b - a) * p;
export function rnd(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6d2b79f5; let r = Math.imul(s ^ (s >>> 15), 1 | s); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
/** Texto que se descifra: los caracteres ya resueltos se fijan de izquierda a derecha. */
export function decode(target, p, frame, pool = "0123456789") {
  const r = rnd(frame * 977 + 13); const n = Math.floor(p * target.length);
  return [...target].map((ch, i) => (i < n || ch === " " || ch === "–") ? ch : pool[Math.floor(r() * pool.length)]).join("");
}
export const $ = (s) => document.querySelector(s);
