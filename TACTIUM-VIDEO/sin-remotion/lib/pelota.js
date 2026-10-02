// Pelota de pádel con polvo en suspensión alrededor.
import * as THREE from "../vendor/three.module.js";
import { rnd } from "./util.js";

function textura() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
  g.fillStyle = "#D6E636"; g.fillRect(0, 0, 1024, 512);
  // Fieltro: motas claras y oscuras.
  const r = rnd(7); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? "255,255,210" : "120,130,20"},${0.08 + r() * 0.1})`; g.fillRect(r() * 1024, r() * 512, 2, 2); }
  // Costura: en equirectangular es una sinusoide de dos periodos.
  g.strokeStyle = "#F4F7E8"; g.lineWidth = 16; g.lineCap = "round"; g.beginPath();
  for (let x = 0; x <= 1024; x += 4) { const y = 256 + Math.sin((x / 1024) * Math.PI * 4) * 150; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}

export function crearPelota() {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: textura(), roughness: 0.85 }));
  group.add(ball);
  const r = rnd(3), n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 14; pos[i * 3 + 1] = (r() - 0.5) * 22; pos[i * 3 + 2] = -r() * 12 + 2; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fd8c0, size: 0.035, transparent: true, opacity: 0.55 }));
  group.add(dust);
  return { group, ball, dust };
}
