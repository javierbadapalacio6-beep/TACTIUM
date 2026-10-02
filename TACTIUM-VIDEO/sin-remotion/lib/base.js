// Base de toda escena: renderer 1080x1920, fuentes, window.seek y previsualización.
//
// Cada escena declara su `meta` y render.mjs la lee para saber cómo renderizarla:
//   { dur, fps, salida, musica?: { src, desde } }
//   - salida en renders/...      → pieza completa (con música si la declara)
//   - salida en public/broll/... → plano 3D sin audio para usar desde Remotion
import * as THREE from "../vendor/three.module.js";

export function crearRenderer(canvas, { fondo = 0x030f0f } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1080, 1920, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(fondo, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(fondo, 40, 160);
  const cam = new THREE.PerspectiveCamera(50, 1080 / 1920, 0.05, 400);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x00df82, 1.4); rim.position.set(-6, -2, -4); scene.add(rim);
  return { renderer, scene, cam };
}

const FUENTES = ["900 10px Satoshi", "700 10px Satoshi", "500 10px Satoshi", "500 10px JBM", "700 10px JBM", "italic 10px ISerif"];

/** Registra la escena: espera fuentes, pinta t=0 y, fuera de render, la reproduce en bucle. */
export async function arrancar(meta, seek) {
  window.__meta = { fps: 30, ...meta };
  window.seek = seek;
  await Promise.all(FUENTES.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  await seek(0);
  window.__ready = true;
  if (new URLSearchParams(location.search).has("render")) return;
  document.body.classList.add("preview");
  const stage = document.getElementById("stage");
  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1080, innerHeight / 1920)})`; };
  addEventListener("resize", fit); fit();
  const t0 = performance.now();
  const loop = () => { seek(((performance.now() - t0) / 1000) % meta.dur); requestAnimationFrame(loop); };
  loop();
}
