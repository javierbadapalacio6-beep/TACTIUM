// Cruce de jugadores → licencia.
//
// Fuentes:
//  - Licencias (/Asignacion-Categorias): «APELLIDO1 APELLIDO2, NOMBRE» + licencia + género.
//  - Inscritos del torneo: «APELLIDO1, NOMBRE» (separa bien nombre y primer apellido).
//  - Cuadro: «NOMBRE APELLIDO1 I.» (I = inicial del segundo apellido).
//
// Confianza (columna *_cruce):
//  - 'alta'    : nombre + primer apellido (+ inicial del 2º si se conoce) dan UNA sola licencia,
//                con nombre y apellido separados con certeza (vía inscritos).
//  - 'media'   : una sola licencia, pero sin inscrito (separación nombre/apellido deducida)
//                o sin poder usar la inicial del segundo apellido.
//  - 'ambiguo' : varias licencias posibles (hermanos, homónimos) → licencia null.
//  - 'sin_cruce': ninguna licencia.
import { norm } from './html.mjs';
import { splitAbrev } from './parsers.mjs';

export class LicenciaIndex {
  /**
   * lics: [{licencia, nombre, apellidos, genero}]
   * extra: [{licencia, nombreCompleto:'NOMBRE APELLIDO1 APELLIDO2', genero}] — jugadores que no salen en
   *        /Asignacion-Categorias pero sí en el ranking absoluto (con licencia). Como no se sabe dónde
   *        acaba el nombre, se indexan todos los cortes posibles (resolve deduplica por licencia).
   */
  constructor(lics, extra = []) {
    this.byNombre = new Map();
    const known = new Set(lics.map(l => l.licencia));
    for (const x of extra) {
      if (!x.licencia || known.has(x.licencia)) continue;
      known.add(x.licencia);
      const w = norm(x.nombreCompleto).split(' ');
      for (let k = 1; k < w.length; k++) lics = lics.concat([{ licencia: x.licencia, nombre: w.slice(0, k).join(' '), apellidos: w.slice(k).join(' '), genero: x.genero, extra: true }]);
    }
    // «NOMBRE APELLIDO1 APELLIDO2» → licencias (para cruzar los rankings por nombre completo)
    this.byFull = new Map();
    for (const l of lics) {
      if (l.extra) continue;
      const k = `${l.genero || ''}|${norm(l.nombre + ' ' + l.apellidos)}`;
      if (!this.byFull.has(k)) this.byFull.set(k, new Set());
      this.byFull.get(k).add(l.licencia);
    }
    for (const l of lics) {
      const k = norm(l.nombre);
      const e = { ...l, apN: norm(l.apellidos) };
      if (!this.byNombre.has(k)) this.byNombre.set(k, []);
      this.byNombre.get(k).push(e);
    }
    this.size = lics.length;
  }

  /** nombre y apellido1 separados con certeza. */
  resolve({ nombre, apellido1, inicial = null, genero = null }, certain = true) {
    const a1 = norm(apellido1);
    if (!a1 || !nombre) return { licencia: null, cruce: 'sin_cruce' };
    let cand = (this.byNombre.get(norm(nombre)) || [])
      .filter(l => l.apN === a1 || l.apN.startsWith(a1 + ' '));
    if (genero === 'M' || genero === 'F') {
      const g = cand.filter(l => !l.genero || l.genero === genero);
      if (g.length) cand = g;
    }
    if (!cand.length) return { licencia: null, cruce: 'sin_cruce' };
    const dedup = arr => [...new Map(arr.map(l => [l.licencia, l])).values()];
    cand = dedup(cand);
    let fine = cand;
    if (inicial) {
      fine = cand.filter(l => l.apN.length > a1.length + 1 && l.apN[a1.length + 1] === inicial);
    } else if (inicial === null) {
      // Sin segundo apellido conocido: preferir quien tampoco lo tiene.
      const exact = cand.filter(l => l.apN === a1);
      if (exact.length === 1) fine = exact;
    }
    if (fine.length === 1) return { licencia: fine[0].licencia, cruce: certain && inicial !== undefined ? 'alta' : 'media' };
    if (fine.length > 1) return { licencia: null, cruce: 'ambiguo', n: fine.length };
    if (cand.length === 1) return { licencia: cand[0].licencia, cruce: 'media' };
    return { licencia: null, cruce: 'ambiguo', n: cand.length };
  }

  /** Nombre abreviado del cuadro sin inscrito: prueba todos los cortes nombre|apellido. */
  resolveLoose(base, inicial, genero) {
    const w = norm(base).split(' ');
    const found = new Map();
    let ambiguous = false;
    for (let k = 1; k < w.length; k++) {
      const r = this.resolve({ nombre: w.slice(0, k).join(' '), apellido1: w.slice(k).join(' '), inicial, genero }, false);
      if (r.licencia) found.set(r.licencia, r);
      else if (r.cruce === 'ambiguo') ambiguous = true;
    }
    if (found.size === 1 && !ambiguous) return { licencia: [...found.keys()][0], cruce: 'media' };
    if (found.size > 1 || ambiguous) return { licencia: null, cruce: 'ambiguo' };
    return { licencia: null, cruce: 'sin_cruce' };
  }
}

/**
 * Prepara el cruce de un torneo: inscritos → jugadores (nombre/apellido1 ciertos).
 * Devuelve una función que resuelve un jugador abreviado del cuadro.
 */
export function makeTorneoResolver(idx, inscritos) {
  // jugadores inscritos por género: clave norm(nombre + ' ' + apellido1)
  const players = new Map();
  for (const i of inscritos) {
    for (const j of [{ nombre: i.j1_nombre, apellido1: i.j1_apellido }, { nombre: i.j2_nombre, apellido1: i.j2_apellido }]) {
      if (!j.nombre) continue;
      const k = `${i.genero}|${norm(j.nombre + ' ' + j.apellido1)}`;
      if (!players.has(k)) players.set(k, { ...j, genero: i.genero, niveles: new Set() });
      players.get(k).niveles.add(i.nivel);
    }
  }
  const cache = new Map();
  return function resolvePlayer(abrev, genero) {
    if (!abrev || /^BYE$/i.test(abrev)) return { nombre: abrev || null, licencia: null, cruce: null };
    const { base, inicial } = splitAbrev(abrev);
    const ck = `${genero}|${base}|${inicial}`;
    if (cache.has(ck)) return cache.get(ck);
    const p = players.get(`${genero}|${norm(base)}`);
    let r;
    if (p) {
      r = idx.resolve({ nombre: p.nombre, apellido1: p.apellido1, inicial: inicial ?? null, genero }, true);
      r.inscrito = true;
    } else {
      r = idx.resolveLoose(base, inicial ?? null, genero);
      r.inscrito = false;
    }
    const out = { nombre: abrev, licencia: r.licencia, cruce: r.cruce, inscrito: r.inscrito, base, inicial };
    cache.set(ck, out);
    return out;
  };
}
