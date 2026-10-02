// Captura del modal «Generar» tras lanzar el post P1, para comprobar la API.
import { chromium } from "playwright-core";
import path from "node:path"; import os from "node:os";
const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
await p.goto("http://localhost:4173/?datos=publicaciones", { waitUntil: "networkidle" });
await p.getByRole("button", { name: "Añadir" }).click();
await p.getByRole("combobox").selectOption("P1");
await p.getByRole("button", { name: "Generar", exact: true }).click();
await p.waitForSelector(".modal__result img", { timeout: 60000 });
await p.waitForTimeout(500);
await p.screenshot({ path: "renders/panel-generar.png" });
console.log("ok"); await b.close();
