import { chromium } from "playwright-core";
import path from "node:path"; import os from "node:os";
const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.goto("http://localhost:4173/?datos=publicaciones", { waitUntil: "networkidle" });
await p.waitForTimeout(1500); // deja tiempo a que llegue /api/instagram
await p.screenshot({ path: "renders/panel-ig-real.png" });
console.log("errores:", errs.length ? errs : "ninguno");
await b.close();
