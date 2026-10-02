// Capturas del panel con la nube: semana, ficha del V1 programado, modal de la
// semana y pestaña de avisos. No pulsa ningún botón que programe o publique.
import { chromium } from "playwright-core";
import path from "node:path"; import os from "node:os";
const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
p.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errs.push(`${r.status()} ${r.url()}`); });
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.waitForSelector(".pz");
await p.waitForTimeout(1500);
await p.screenshot({ path: "renders/nube-1-semana.png" });
await p.getByRole("button", { name: /Abrir la ficha de V1:/ }).click();
await p.waitForTimeout(600);
await p.screenshot({ path: "renders/nube-2-ficha-V1.png" });
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Programar semana" }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: "renders/nube-3-programar-semana.png" });
await p.getByRole("dialog", { name: "Programar la semana" }).getByRole("button", { name: "Cancelar" }).click();
await p.getByRole("tab", { name: "Avisos" }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: "renders/nube-4-avisos.png" });
console.log("errores:", errs.length ? errs : "ninguno");
await b.close();
