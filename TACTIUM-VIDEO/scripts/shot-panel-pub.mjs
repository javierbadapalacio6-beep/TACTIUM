// Recorre el panel de publicaciones y hace una captura de cada vista y de las
// fichas, pulsando los botones de verdad. Informa de errores de consola.
//   node scripts/shot-panel-pub.mjs
import { chromium } from "playwright-core";
import path from "node:path"; import os from "node:os";
const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errs.push(m.text()); });
p.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errs.push(`${r.status()} ${r.url()}`); });

const foto = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: `renders/pub-${n}.png` }); console.log("·", n); };

await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.waitForSelector(".pz", { timeout: 20000 });
await p.waitForFunction(() => !document.body.innerText.includes("Cargando Instagram"), null, { timeout: 30000 });
await foto("1-semana");

await p.getByRole("button", { name: "Semana siguiente" }).click();
await foto("2-semana2");

await p.getByRole("tab", { name: "Mes" }).click();
await foto("3-mes");

await p.getByRole("tab", { name: "Horas" }).click();
await foto("4-horas");

await p.getByRole("tab", { name: "Publicado" }).click();
await foto("5-publicado");

await p.getByRole("tab", { name: "Repuesto" }).click();
await foto("6-repuesto");

await p.getByRole("button", { name: "Volver a hoy" }).click();
await p.getByRole("button", { name: /Abrir la ficha de V1:/ }).click();
await foto("7-ficha-V1");
await p.keyboard.press("Escape");

await p.getByRole("button", { name: /Abrir la ficha de C1:/ }).click();
await foto("8-ficha-C1");
await p.getByRole("button", { name: "Cerrar la ficha" }).click();

// Filtro: solo «Por grabar», desde la cifra de arriba.
await p.getByRole("button", { name: /Por grabar/ }).first().click();
await foto("9-por-grabar");

console.log("errores:", errs.length ? errs : "ninguno");
await b.close();
