// Refresco MANUAL de la plantilla de un equipo en la liga que aún no ha empezado.
//
// El volcado automático pasa dos veces por semana. Esto es para cuando el club
// sabe que acaba de dar de alta a alguien y no quiere esperar: pulsa un botón y
// se lee su ficha en la Federación al momento.
//
// Autorización: se consulta el equipo con el JWT de quien llama, así que manda
// la RLS que ya existe. Si puede ver el equipo, puede refrescar su plantilla.
// La escritura va con service role porque las tablas `fcp_*` son de solo
// lectura para todo el mundo.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const FCP = 'https://federacioncantabradepadel.com';
// Un refresco por equipo y minuto: el botón es para un alta concreta, no para
// machacar a la Federación.
const COOLDOWN_MS = 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const decode = (s: string) =>
  s.replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
   .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
   .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/<[^>]*>/g, ' ')
   .replace(/\s+/g, ' ').trim();

/** Mismo formato de id que usa el agente: fcp_{id_equipo}_{slug del nombre}. */
const playerId = (idEquipo: number, nombreCompleto: string) =>
  `fcp_${idEquipo}_${nombreCompleto.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

interface Jugador {
  id_jugador: string; nombre: string; apellido1: string; apellido2: string | null;
  nombre_pila: string | null; categoria: string | null; puntos: number;
  id_equipo: number; nombre_equipo: string; id_liga: number; updated_at: string;
}

/** Filas <tr class="lineas">: Num | Apellido 1 | Apellido 2 | Nombre | Cat | Puntos */
function parseRoster(html: string, idEquipo: number, idLiga: number, equipo: string): Jugador[] {
  const out: Jugador[] = [];
  const ahora = new Date().toISOString();
  for (const fila of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const celdas = (fila.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(decode);
    if (celdas.length < 6) continue;
    const [, apellido1, apellido2, nombre, categoria, puntos] = celdas;
    if (!apellido1 || apellido1.length < 2 || /apellido/i.test(apellido1)) continue;
    const nombreCompleto =
      [apellido1, apellido2].filter(Boolean).join(' ') + (nombre ? `, ${nombre}` : '');
    out.push({
      id_jugador: playerId(idEquipo, nombreCompleto),
      nombre: nombreCompleto,
      apellido1,
      apellido2: apellido2 || null,
      nombre_pila: nombre || null,
      categoria: categoria || null,
      puntos: parseInt(puntos, 10) || 0,
      id_equipo: idEquipo,
      nombre_equipo: equipo,
      id_liga: idLiga,
      updated_at: ahora,
    });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'misconfigured' }, 500);

  let body: { team_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body.team_id) return json({ error: 'team_id_required' }, 400);

  // 1) ¿Puede quien llama ver ese equipo? Lo decide la RLS, no nosotros.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: team } = await asUser
    .from('teams')
    .select('id, name, gender')
    .eq('id', body.team_id)
    .maybeSingle();
  if (!team) return json({ error: 'forbidden' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 2) El equipo en la liga que viene. Se busca por NOMBRE y género: el
  //    id_equipo de la Federación cambia cada temporada, así que el vínculo
  //    guardado apunta a la liga en curso y aquí no sirve.
  const { data: insc } = await admin
    .from('fcp_inscripciones')
    .select('id_liga, id_grupo, id_equipo, equipo, genero, plantilla_updated_at')
    .ilike('equipo', team.name)
    .eq('genero', team.gender === 'femenino' ? 'F' : 'M')
    .order('id_liga', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!insc) return json({ ok: true, found: false, reason: 'no_inscrito' });

  if (insc.plantilla_updated_at &&
      Date.now() - new Date(insc.plantilla_updated_at).getTime() < COOLDOWN_MS) {
    return json({ ok: true, found: true, skipped: 'cooldown', players: null });
  }

  // 3) Su ficha en la Federación.
  const res = await fetch(
    `${FCP}/Liga_DetalleEquipo?IdEquipo=${insc.id_equipo}&Id=${insc.id_liga}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 TACTIUM' } },
  );
  if (!res.ok) return json({ error: 'fcp_unavailable', status: res.status }, 502);
  const html = await res.text();

  const jugadores = parseRoster(html, insc.id_equipo, insc.id_liga, insc.equipo ?? team.name);
  const sede = (html.match(/Sede:\s*([^<]+)</i) ?? [])[1];
  const ahora = new Date().toISOString();

  if (jugadores.length > 0) {
    const { error } = await admin
      .from('fcp_jugadores')
      .upsert(jugadores, { onConflict: 'id_jugador' });
    if (error) return json({ error: 'db_error', details: error.message }, 500);
  }

  await admin.from('fcp_inscripciones').update({
    sede: sede ? decode(sede) : null,
    plantilla_updated_at: ahora,
  }).eq('id_liga', insc.id_liga).eq('id_grupo', insc.id_grupo).eq('id_equipo', insc.id_equipo);

  return json({ ok: true, found: true, players: jugadores.length, updated_at: ahora });
});
