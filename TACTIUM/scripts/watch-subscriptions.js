/**
 * Mira EN DIRECTO las suscripciones de una cuenta mientras se prueba un cambio
 * de plan en la tienda.
 *
 * Para qué: al cambiar de plan de club a capitán (o al revés) lo que hay que
 * comprobar es que Google/Apple REEMPLAZAN la suscripción en vez de dejar dos
 * cobrando. Eso se ve aquí: durante el periodo ya pagado conviven la vieja
 * (activa) y la nueva (programada), y al renovar debe quedar UNA sola.
 *
 * Uso, desde TACTIUM/:
 *   node scripts/watch-subscriptions.js correo@ejemplo.com
 *   node scripts/watch-subscriptions.js correo@ejemplo.com --once
 *
 * Lee la service_role de tactium-web/.env.local. Solo lectura.
 */
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(
  __dirname,
  '../../tactium-web/.env.local',
);

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv(ENV_PATH);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const email = process.argv[2];
const once = process.argv.includes('--once');
if (!email) {
  console.error('Falta el correo. Ej: node scripts/watch-subscriptions.js demo.club@tactium.io');
  process.exit(1);
}

const get = async (p) => {
  const r = await fetch(`${URL}/rest/v1/${p}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('es-ES') : '—');
const ACTIVAS = ['trialing', 'active', 'grace_period'];

async function snapshot() {
  const users = await get(
    `profiles?select=id,email&email=eq.${encodeURIComponent(email)}`,
  );
  if (!users.length) return `No hay ninguna cuenta con ${email}`;
  const userId = users[0].id;

  const subs = await get(
    `subscriptions?select=*&payer_user_id=eq.${userId}&order=current_period_end.desc`,
  );
  if (!subs.length) return `${email}: sin suscripciones`;

  const clubIds = subs
    .filter((s) => s.subject_type === 'club')
    .map((s) => s.subject_id);
  const clubs = clubIds.length
    ? await get(`clubs?select=id,name&id=in.(${clubIds.join(',')})`)
    : [];
  const clubName = (id) => clubs.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  const lines = subs.map((s) => {
    const viva = ACTIVAS.includes(s.status) && new Date(s.current_period_end) > new Date();
    const quien =
      s.subject_type === 'club' ? `club ${clubName(s.subject_id)}` : 'esta persona';
    const programado = s.scheduled_plan_tier
      ? ` → pasará a ${s.scheduled_plan_tier} al renovar`
      : '';
    return [
      `  ${viva ? '●' : '○'} ${s.plan_tier} ${s.billing_period}`.padEnd(34),
      `${s.status}`.padEnd(14),
      `cubre ${quien}`.padEnd(30),
      `hasta ${fmt(s.current_period_end)}${programado}`,
    ].join(' ');
  });

  const vivas = subs.filter(
    (s) => ACTIVAS.includes(s.status) && new Date(s.current_period_end) > new Date(),
  );
  // Lo que de verdad se vigila: más de una viva a la vez tras un cambio de
  // plan significa que la tienda NO reemplazó y se está cobrando dos veces.
  const aviso =
    vivas.length > 1
      ? `\n  ⚠ ${vivas.length} suscripciones vivas a la vez — revisa que el cambio de plan reemplazase la anterior`
      : '';

  const ev = await get(
    `subscription_events?select=event_type,received_at&subscription_id=in.(${subs
      .map((s) => s.id)
      .join(',')})&order=received_at.desc&limit=3`,
  );
  const eventos = ev.length
    ? `\n  últimos eventos: ${ev.map((e) => `${e.event_type} (${fmt(e.received_at)})`).join(' · ')}`
    : '';

  return `${email}\n${lines.join('\n')}${aviso}${eventos}`;
}

(async () => {
  let previo = '';
  for (;;) {
    let texto;
    try {
      texto = await snapshot();
    } catch (e) {
      texto = `error: ${e.message}`;
    }
    if (texto !== previo) {
      console.log(`\n[${new Date().toLocaleTimeString('es-ES')}]`);
      console.log(texto);
      previo = texto;
    }
    if (once) return;
    await new Promise((r) => setTimeout(r, 15000));
  }
})();
