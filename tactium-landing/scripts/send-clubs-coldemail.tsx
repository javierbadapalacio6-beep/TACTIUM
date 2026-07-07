/**
 * Envío en frío B2B a clubs de pádel (prospección).
 * Personaliza el nombre del club. Plain text + HTML mínimo (mejor para cold).
 * Incluye identificación y opción de baja (obligatorio).
 *
 *   npx tsx scripts/send-clubs-coldemail.tsx --dry-run
 *   npx tsx scripts/send-clubs-coldemail.tsx --to javierbadapalacio6@gmail.com
 *   npx tsx scripts/send-clubs-coldemail.tsx            (envío real a todos)
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { getResend, getEmailFrom } from "../lib/email/client";

config({ path: resolve(process.cwd(), ".env.local") });

const APP_URL = "https://apps.apple.com/es/app/tactium/id6769825905";
const DELAY_MS = 1200;
const SENT_LOG = resolve(process.cwd(), "scripts/.clubs-coldemail.log");

const clubs = [
  { club: "Real Club de Campo Villa de Madrid", email: "deportes@ccvm.es" },
  { club: "Madrid Central Pádel", email: "recepcion@madridcentralpadel.com" },
  { club: "Mas Padel", email: "info@maspadel.com" },
  { club: "School Padel Center M30", email: "m30@lavidapadel.com" },
  { club: "Vim Pádel", email: "info@vimpadel.com" },
  { club: "Las Tablas Sports Club", email: "somos@lastablassports.club" },
  { club: "CD Match Padel", email: "info@cdmatchpadel.es" },
  { club: "Club Santa Clara", email: "padelyteniscsc@gmail.com" },
  { club: "Padel Sport Academy", email: "info@padelsportacademy.com" },
  { club: "Catalunya Padel Club", email: "info@catalunyapadelclub.com" },
  { club: "Oxygen Sports Club", email: "info@sportscluboxygen.com" },
  { club: "SUMA Pádel Club", email: "padelalfafar@sumafitnessclub.com" },
  { club: "ONE PADEL VALENCIA", email: "recepciononepadel@gmail.com" },
  { club: "Padel Club Alicante Indoor", email: "info@padelclubalicante.com" },
  { club: "Arenga", email: "info@arenga.es" },
  { club: "Real Club de Tenis Coruña", email: "martin.sanchez@teniscoruna.com" },
  { club: "Casino Ferrolano (pádel)", email: "info.casinoferrolano@gmail.com" },
];

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const toArg = args.indexOf("--to");
const singleTo = toArg !== -1 ? args[toArg + 1] : null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadSent(): Set<string> {
  if (!existsSync(SENT_LOG)) return new Set();
  return new Set(readFileSync(SENT_LOG, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean));
}
function markSent(e: string) { writeFileSync(SENT_LOG, `${e.toLowerCase()}\n`, { flag: "a" }); }

function text(club: string) {
  return `Hola:

Soy Javier, fundador de TACTIUM. Os escribo porque trabajáis con equipos de pádel federado y quizá os ahorre un dolor de cabeza recurrente.

TACTIUM es una app para capitanes y clubs: monta la alineación de cada jornada en menos de un minuto —equilibrando parejas por puntos y respetando el orden de fuerza de la federación— y avisa a los jugadores sin perseguir a nadie por WhatsApp.

Para un club con varios equipos, el admin lo ve todo desde un panel y los capitanes alinean en 90 segundos.

¿Te viene bien que te enseñe en 10 minutos cómo quedaría con los equipos de ${club}? Si lo prefieres, te paso el enlace y lo pruebas: 14 días gratis y los jugadores nunca pagan.

Un saludo,
Javier · TACTIUM
https://tactium.io · ${APP_URL}

Si no es de tu interés, responde "baja" y no te volveré a escribir.`;
}
function html(club: string) {
  return text(club)
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#1a1a1a">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function send(to: string, club: string) {
  const resend = getResend();
  if (!resend) return { ok: false, error: "sin RESEND_API_KEY" };
  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to,
    subject: `Alineaciones del club en 1 minuto, ${club}`,
    text: text(club),
    html: `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif">${html(club)}</div>`,
    headers: { "X-Entity-Ref-ID": `clubs-cold-${Date.now()}` },
    tags: [{ name: "template", value: "clubs-cold" }],
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

async function main() {
  console.log(`Remitente: ${getEmailFrom()}`);
  if (singleTo) {
    console.log(`TEST a ${singleTo}`);
    const r = await send(singleTo, "tu club");
    console.log(r.ok ? `✓ Enviado (${r.id})` : `✗ ${r.error}`);
    return;
  }
  const sent = loadSent();
  const target = clubs.filter((c) => !sent.has(c.email.toLowerCase()));
  console.log(`Clubs con email: ${clubs.length} · pendientes: ${target.length}`);
  if (isDryRun) { console.log("\n— DRY RUN —"); target.forEach((c) => console.log(`  · ${c.club} <${c.email}>`)); return; }
  console.log("\nEnviando…\n");
  let ok = 0, fail = 0;
  for (const c of target) {
    const r = await send(c.email, c.club);
    if (r.ok) { markSent(c.email); ok++; console.log(`  ✓ ${c.club} <${c.email}>`); }
    else { fail++; console.error(`  ✗ ${c.club} <${c.email}> — ${r.error}`); }
    await sleep(DELAY_MS);
  }
  console.log(`\nHecho. Enviados: ${ok} · Fallidos: ${fail}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
