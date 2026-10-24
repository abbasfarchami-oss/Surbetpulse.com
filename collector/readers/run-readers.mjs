// LOG-ONLY runner: opens enabled readers (GoLogin / local Chrome page), reads, writes rows to reader-state/rows.json. NEVER sends to the site.
import fs from "node:fs";
import { loadReaders } from "./registry.mjs";
const rs = (await loadReaders({ onlyEnabled: true, only: process.env.ONLY?.split(",") })).filter((r) => !r.loadError);
const openPage = async (url) => { const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.GOLOGIN_PROFILE_WS) { const b = await puppeteer.connect({ browserWSEndpoint: process.env.GOLOGIN_PROFILE_WS, defaultViewport: null }); return (await b.pages())[0]; }
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  const p = await b.newPage(); await p.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}); return p; };
const all = [];
for (const r of rs) {
  if (r.key === "sbobet") { console.log("sbobet: skipped here (needs manual login flow in collector.mjs)"); continue; }
  try { const page = await openPage(`https://${r.mod.CONFIG.domain}`); if (r.mod.attach) r.mod.attach(page);
    const rows = r.mod.attach ? await r.mod.readInPage() : [...await r.mod.readInPage(page, { live: true }), ...await r.mod.readInPage(page, { live: false })];
    console.log(r.key, rows.length, "rows"); all.push({ book: r.mod.meta.name, rows }); } catch (e) { console.log(r.key, "error", e.message); }
}
fs.writeFileSync(new URL("../reader-state/rows.json", import.meta.url), JSON.stringify(all, null, 1));
console.log("LOG-ONLY: wrote reader-state/rows.json (nothing sent)");
