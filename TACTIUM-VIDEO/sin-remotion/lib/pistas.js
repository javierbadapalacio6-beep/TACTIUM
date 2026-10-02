// Pistas de pádel en línea (una por pareja de la liga por equipos: 5 parejas).
// Cada pista: 20 x 10 m con el largo en X, red de lado a lado en X=0, cristales
// en los fondos y 2 m de laterales, malla en el resto. La pareja del equipo
// ocupa el lado X>0. Tiempos de aparición: los decide la escena con animarJugadores().
import * as THREE from "../vendor/three.module.js";
import { eBack, eOut, eInOut, prog } from "./util.js";

export const COURT_Z = [-26, -13, 0, 13, 26];

export function crearPistas() {
  const group = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0xe8f3ef, transparent: true, opacity: 0.9 });
  const glassEdge = new THREE.LineBasicMaterial({ color: 0x5fa894, transparent: true, opacity: 0.55 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x8fe0c8, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x041613, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; group.add(ground);
  const seg = (pts, mat = lineMat) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))), mat);
  const glassPanel = (w, h, pos, rotY) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), glassEdge));
    g.position.set(...pos); g.rotation.y = rotY; return g;
  };

  const players = []; // { disc, beam, court, world }
  COURT_Z.forEach((z, ci) => {
    const c = new THREE.Group(); c.position.z = z; group.add(c);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), new THREE.MeshStandardMaterial({ color: 0x0a4a3c, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; c.add(floor);
    const y = 0.01;
    c.add(seg([
      [-10, y, -5], [10, y, -5], [10, y, -5], [10, y, 5], [10, y, 5], [-10, y, 5], [-10, y, 5], [-10, y, -5], // contorno
      [-6.95, y, -5], [-6.95, y, 5], [6.95, y, -5], [6.95, y, 5], // líneas de saque
      [-6.95, y, 0], [6.95, y, 0], // central
    ]));
    const net = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.88), new THREE.MeshBasicMaterial({ color: 0x0b1f1b, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    net.position.set(0, 0.44, 0); net.rotation.y = Math.PI / 2; c.add(net);
    c.add(seg([[0, 0.88, -5], [0, 0.88, 5]]));
    c.add(glassPanel(10, 3, [-10, 1.5, 0], Math.PI / 2), glassPanel(10, 3, [10, 1.5, 0], Math.PI / 2));
    for (const sx of [-9, 9]) for (const sz of [-5, 5]) c.add(glassPanel(2, 3, [sx, 1.5, sz], 0));
    const mesh = []; for (let x = -8; x <= 8; x += 2) for (const sz of [-5, 5]) mesh.push([x, 0, sz], [x, 3, sz]);
    for (const sz of [-5, 5]) mesh.push([-8, 3, sz], [8, 3, sz]);
    c.add(seg(mesh, glassEdge));
    for (const pz of [-2.5, 2.5]) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({ color: 0x00df82, transparent: true }));
      disc.rotation.x = -Math.PI / 2; disc.position.set(5, 0.03, pz); c.add(disc);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x00df82, transparent: true, opacity: 0.85 }));
      beam.position.set(5, 0, pz); c.add(beam);
      players.push({ disc, beam, court: ci, world: new THREE.Vector3(5, 0.05, z + pz) });
    }
  });
  // Red de equipo: une a los 10 jugadores en un solo trazo.
  const netPts = [0, 1, 3, 2, 4, 5, 7, 6, 8, 9].map((i) => players[i].world.clone().setY(0.08));
  const teamLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(netPts), new THREE.LineBasicMaterial({ color: 0x00df82, transparent: true, opacity: 0.9 }));
  group.add(teamLine);

  /**
   * Parejas que aparecen (discos), se alzan (haces), se recogen y se unen en red.
   * Todos los tiempos en segundos de la escena; `recoger` null = no se recogen.
   */
  function animarJugadores(t, { aparecen, alzan, recoger = null, red }) {
    players.forEach((pl, i) => {
      pl.disc.scale.setScalar(Math.max(0.0001, eBack(prog(t, aparecen + pl.court * 0.08 + (i % 2) * 0.04, 0.3))));
      const baja = recoger == null ? 1 : 1 - eInOut(prog(t, recoger, 0.4));
      const h = 3.2 * eOut(prog(t, alzan + pl.court * 0.06, 0.4)) * baja;
      pl.beam.scale.y = Math.max(0.0001, h); pl.beam.position.y = h / 2; pl.beam.visible = h > 0.01;
    });
    const k = eInOut(prog(t, red, 0.8)) * (netPts.length - 1);
    teamLine.geometry.setDrawRange(0, Math.max(0, Math.floor(k) + 1));
  }

  // Recorridos de cámara probados: desde la vista de jugador a la cenital, y
  // picado desde la cenital al fondo de la pista cercana (mismo ángulo que el clip 13).
  const subida = {
    pos: new THREE.CatmullRomCurve3([[-14, 1.6, 26], [-20, 9, 44], [-10, 34, 58], [-2, 62, 36], [0, 80, 14]].map((p) => new THREE.Vector3(...p))),
    mira: new THREE.CatmullRomCurve3([[6, 0.6, 26], [2, 0, 20], [0, 0, 8], [0, 0, 2], [0, 0, 0]].map((p) => new THREE.Vector3(...p))),
  };
  const picado = {
    pos: new THREE.CatmullRomCurve3([[0, 80, 14], [18, 30, 34], [13, 2.0, 21.8]].map((p) => new THREE.Vector3(...p))),
    mira: new THREE.CatmullRomCurve3([[0, 0, 0], [4, 0, 24], [-1, 0.9, 27]].map((p) => new THREE.Vector3(...p))),
  };
  const camara = (cam, ruta, u) => { cam.position.copy(ruta.pos.getPoint(u)); cam.up.set(0, 1, 0); cam.lookAt(ruta.mira.getPoint(u)); };

  return { group, players, animarJugadores, rutas: { subida, picado }, camara };
}
