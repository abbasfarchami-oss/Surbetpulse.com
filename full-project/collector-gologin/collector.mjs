// ArbRadar collector: opens GoLogin cloud-browser profiles, reads public odds, sends to the site. Never places bets.
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { openSbobet, readSbobet } from "./sbobet.mjs";
import { parse1xLines, parse1xV3, normLine } from "./lines.mjs";
const PARSEV3_SRC = `function(g){ const normLine = ${normLine.toString()}; const AH_T = { 7: "h", 8: "a", 3829: "h", 3830: "a" }, OU_T = { 9: "o", 10: "u", 3827: "o", 3828: "u" }; return (${parse1xV3.toString()})(g); }`;
const PARSE1X_SRC = `function(E, GE){ const normLine = ${normLine.toString()}; return (${parse1xLines.toString()})(E, GE); }`;
const arguments_sbo = (pages, book) => pages.find((x) => x.book === book).sbo;
const C = JSON.parse(fs.readFileSync(new URL("./config.json", import.meta.url)));
const TOKEN = (process.env.GOLOGIN_TOKEN || (process.env.GOLOGIN_TOKEN_FILE ? fs.readFileSync(process.env.GOLOGIN_TOKEN_FILE, "utf8") : "")).trim();
const SECRET = process.env.WEBHOOK_SECRET || (process.env.WEBHOOK_SECRET_FILE ? (await import("node:fs")).readFileSync(process.env.WEBHOOK_SECRET_FILE,"utf8").trim() : "");
if ((!TOKEN && !process.env.DRY_RUN && !process.env.LOCAL_CHROME) || (!SECRET && !process.env.DRY_RUN)) { console.error("Set GOLOGIN_TOKEN (or GOLOGIN_TOKEN_FILE) and WEBHOOK_SECRET env vars"); process.exit(1); }
const FAMILY = Object.fromEntries(Object.values(C.BOOKS).map((v) => [v.name, v.family || v.name]));
const NAME = Object.fromEntries(Object.entries(C.BOOKS).map(([k, v]) => [k, v.name]));
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);
const GH = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

function profiles() {
  return Object.entries(C.BOOKS).filter(([, b]) => b.enabled !== false && (b.type === "sbobet" || /^[0-9a-f]{24}$/.test(b.gologinProfileId || "")))
    .map(([key, b]) => ({ key, id: b.gologinProfileId, ...b }));
}
// Optional: push the per-book proxy from config onto the profile (only if proxy is set in config).
async function applyProxy(p) {
  if (!p.proxy) return;
  const { type = "http", host, port, username = "", password = "" } = p.proxy;
  const r = await fetch(`https://api.gologin.com/browser/${p.id}/proxy`, { method: "PATCH", headers: GH,
    body: JSON.stringify({ mode: type, host, port: +port, username, password }) });
  if (!r.ok) log(`proxy update for ${p.key} failed: ${r.status}`);
}
// GoLogin Cloud Browser: Orbita runs in GoLogin's cloud, Puppeteer connects over wss. Works on a headless Linux server.
async function open(p) {
  if (process.env.LOCAL_CHROME) { // test mode: local headless Chrome instead of GoLogin
    const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
    const page = await b.newPage(); await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {}); return page; }
  await applyProxy(p);
  const ws = `wss://cloudbrowser.gologin.com/connect?token=${encodeURIComponent(TOKEN)}&profile=${p.id}`;
  const b = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: null });
  const page = (await b.pages())[0] || (await b.newPage());
  await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  return page;
}
// Pinnacle: not 1xBet-family. Its site's frontend reads JSON from guest.api.arcadia.pinnacle.com/0.1
// (matchups + markets/straight). Read it from inside the page (same origin cookies/x-api-key the site uses).
async function readPinnacle(page) {
  return page.evaluate(async () => {
    try {
      const key = (window.__API_KEY__ || localStorage.getItem("api-key") || "");
      const h = key ? { "x-api-key": key } : {};
      const base = "https://guest.api.arcadia.pinnacle.com/0.1/sports/29";
      const [m, k] = await Promise.all([fetch(`${base}/matchups`, { headers: h }).then((r) => r.json()),
                                        fetch(`${base}/markets/straight?primaryOnly=true`, { headers: h }).then((r) => r.json())]);
      const am = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
      const px = new Map(); for (const x of k) if (x.type === "moneyline" && x.period === 0) px.set(x.matchupId, x.prices);
      return m.filter((e) => e.participants?.length === 2 && px.has(e.id)).map((e) => {
        const o = {}; for (const p of px.get(e.id)) o[{ home: 1, draw: 2, away: 3 }[p.designation]] = +am(p.price).toFixed(3);
        const ph = e.participants.find((p) => p.alignment === "home"), pa = e.participants.find((p) => p.alignment === "away");
        return { sport: "Football", league: e.league?.name || "", home: ph?.name, away: pa?.name,
          start: Date.parse(e.startTime) / 1000, live: !!e.isLive, o };
      }).filter((e) => e.home && e.away && e.o[1] && e.o[3]);
    } catch { return []; }
  });
}
// 1xBet-family JSON feed, read from inside the real browser page (same cookies, no login).
// Since Oct 2026 1xbet.fi answers the old LineFeed/Get1x2_VZip with 406; the site uses main-line-feed|main-live-feed/v3/games1x2.
// We read v3 (main lines + Asian quarter lines), and for priority-league games also the legacy GetGameZip (still works) for all lines.
async function read1x(page, live, prefix = "", kws = [], zipMax = 40, feedQuery = "") {
  return page.evaluate(async (live, prefix, kws, zipMax, q, v3Src, zipSrc) => {
    const parseV3 = new Function("return " + v3Src)(), parseZip = new Function("return " + zipSrc)();
    const pri = (l) => kws.some((k) => k === "II" ? /\bII\b/.test(l || "") : String(l || "").toLowerCase().includes(k.toLowerCase()));
    const err = [];
    let games = null;
    for (const count of [50, 40]) { // v3 max count is 50 (60+ -> 400)
      try { const sp = new URLSearchParams(q); sp.set("count", count); const qs = [...sp].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&"); // v3 API rejects unsorted params
        const r = await fetch(`/${prefix}main-${live ? "live" : "line"}-feed/v3/games1x2?${qs}`);
        if (r.ok) { games = await r.json(); break; } err.push(`games1x2 count=${count} -> ${r.status}`); } catch (e) { err.push(e.message); }
    }
    if (!Array.isArray(games)) return { rows: [], err, zips: 0, zipOk: 0 };
    const rows = []; let zips = 0, zipOk = 0;
    for (const g of games) {
      if (g.sport?.id !== 1) continue;
      const r = parseV3(g); r.live = live;
      if (pri(r.league) && zips < zipMax && r.id) { zips++;
        try { const z = await (await fetch(`/${prefix}${live ? "LiveFeed" : "LineFeed"}/GetGameZip?id=${r.id}&lng=en&isSubGames=true&GroupEvents=true&countevents=250&partner=1`)).json();
          if (z.Success && z.Value) { zipOk++; for (const [k, v] of Object.entries(parseZip([], z.Value.GE || []))) { const m = (r.mk[k] ||= {}); for (const [s, c] of Object.entries(v)) m[s] = Math.max(m[s] || 0, c); } } } catch (e) { err.push("zip " + e.message); } }
      if (r.home && r.away && ((r.o[1] && r.o[3]) || Object.keys(r.mk).length)) rows.push(r);
    }
    return { rows, err, zips, zipOk };
  }, live, prefix, kws, zipMax, feedQuery, PARSEV3_SRC, PARSE1X_SRC).then((x) => { if (x.err.length) log("1x feed errors:", x.err.slice(0, 3).join("; "));
    log(`1x ${live ? "live" : "line"}: ${x.rows.length} games, GetGameZip ${x.zipOk}/${x.zips} ok`); return x.rows; });
}
const norm = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(fc|cf|sc|afc|club|women|u\d\d)\b/g, "").replace(/[^a-z0-9]/g, "");
// Markets: "1X2" (keys 1,2,3), "AH:<home line>" (h,a), "OU:<line>" (o,u). Event key = home|away|live so the site's matcher pairs SBOBet with 1xBet.
const MK_LABEL = { "1X2": { 1: "1", 2: "X", 3: "2" } };
function build(all) {
  const ev = new Map();
  for (const { book, rows } of all) for (const r of rows) {
    const k = `${norm(r.home)}|${norm(r.away)}|${r.live}`;
    const e = ev.get(k) || { ...r, best: {} }; ev.set(k, e);
    const markets = { ...(r.mk || {}) }; if (r.o && Object.keys(r.o).length) markets["1X2"] = r.o;
    for (const [m, sel] of Object.entries(markets)) for (const [t, v] of Object.entries(sel)) {
      const b = (e.best[m] ||= {}); if (v > 1 && (!b[t] || v > b[t].odds)) b[t] = { odds: +v, bookmaker: book };
    }
  }
  const out = [];
  for (const [k, e] of ev) for (const [m, b] of Object.entries(e.best)) {
    let ts, label, mname;
    if (m === "1X2") { ts = b[2] ? ["1", "2", "3"] : ["1", "3"]; label = (t) => MK_LABEL["1X2"][t]; mname = b[2] ? "1X2" : "Winner"; }
    else if (m.startsWith("AH:")) { const l = +m.slice(3); ts = ["h", "a"]; mname = `Asian Handicap ${l > 0 ? "+" : ""}${l}`;
      label = (t) => t === "h" ? `${e.home} ${l > 0 ? "+" : ""}${l}` : `${e.away} ${-l > 0 ? "+" : ""}${-l}`; }
    else if (m.startsWith("OU:")) { const l = +m.slice(3); ts = ["o", "u"]; mname = `Over/Under ${l}`; label = (t) => (t === "o" ? "Over " : "Under ") + l; }
    else continue;
    if (!ts.every((t) => b[t])) continue;
    if (new Set(ts.map((t) => b[t].bookmaker)).size < 2) continue;
    // Never pair a platform with its own clones (e.g. 1xBet + Melbet): need >= 2 families among the legs.
    if (new Set(ts.map((t) => FAMILY[b[t].bookmaker] || b[t].bookmaker)).size < 2) continue;
    const inv = ts.reduce((s, t) => s + 1 / b[t].odds, 0), edge = (1 / inv - 1) * 100;
    if (edge > (C.maxEdgePct ?? 200)) continue; // data error
    const high = edge > (C.highEdgePct ?? 20);
    if (high && C.highEdgeAs === "label") mname += " [HIGH EDGE]";
    out.push({ ...(high && C.highEdgeAs !== "label" ? { highEdge: true } : {}), id: `${k}|${m}`.slice(0, 80), sport: String(e.sport).slice(0, 40), league: String(e.league).slice(0, 80),
      event: `${e.home} vs ${e.away}`.slice(0, 160), market: mname, live: e.live,
      startsAt: new Date((e.start || 0) * 1000).toISOString(), source: "collector",
      outcomes: ts.map((t) => ({ label: String(label(t)).slice(0, 80), bookmaker: b[t].bookmaker, odds: b[t].odds })) });
  }
  return out.slice(0, 500);
}
async function send(opps) {
  if (process.env.DRY_RUN) { fs.writeFileSync("dry-run-output.json", JSON.stringify({ opportunities: opps }, null, 2)); return log("DRY_RUN: wrote", opps.length, "opportunities to dry-run-output.json (not sent)"); }
  if (!opps.length) return log("no cross-book opportunities this round");
  const r = await fetch(C.WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-webhook-secret": SECRET }, body: JSON.stringify({ opportunities: opps }) });
  log("sent", opps.length, "→", r.status);
}
const ps = profiles().filter((p) => !process.env.ONLY || process.env.ONLY.split(",").includes(p.key));
log("profiles found:", ps.map((p) => p.key).join(", ") || "NONE (check profile names)");
const pages = [];
for (const p of ps) { try {
  if (p.type === "sbobet") { pages.push({ book: p.name || "SBOBet", type: "sbobet", sbo: await openSbobet(p, p.gologinProfileId ? open : null) }); log("opened", p.key); continue; }
  pages.push({ book: NAME[p.key] || p.key, type: p.type, prefix: p.feedPrefix || "", page: await open(p) }); log("opened", p.key); } catch (e) { log(p.key, e.message); } }
import { openStore, writeRound } from "./store.mjs";
await openStore(C);
let round = 0;
const DELAY = Number(C.delaySec ?? C.INTERVAL_SECONDS ?? 5);
for (;;) {
  const all = [];
  for (const { book, type, prefix, page } of pages) {
    const rows = type === "sbobet" ? await readSbobet(arguments_sbo(pages, book), C.priorityLeagueKeywords || [])
      : type === "pinnacle" ? await readPinnacle(page) : [...(await read1x(page, true, prefix, C.priorityLeagueKeywords || [], C.BOOKS["1xbet"]?.gameZipPriorityMax ?? 40, C.BOOKS["1xbet"]?.feedQuery || "")), ...(await read1x(page, false, prefix, C.priorityLeagueKeywords || [], C.BOOKS["1xbet"]?.gameZipPriorityMax ?? 40, C.BOOKS["1xbet"]?.feedQuery || ""))];
    log(book, rows.length, "events"); all.push({ book, rows });
  }
  if (process.env.DRY_RUN) fs.writeFileSync("dry-run-rows.json", JSON.stringify(all, null, 1));
  const opps = build(all); writeRound(all, opps, C);
  await send(opps).catch((e) => log("send error", e.message));
  if (process.env.ROUNDS && ++round >= +process.env.ROUNDS) process.exit(0);
  await new Promise((r) => setTimeout(r, DELAY * 1000));
}
