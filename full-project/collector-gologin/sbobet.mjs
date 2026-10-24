// SBOBet reader (read-only, never bets). Logs in with a real browser, then lets the sportsbook frontend
// do its own EventsQuery/OddsQuery calls to price-*.speedysurfcdn.net/api. We sniff those responses
// (page.on("response")), learn the persisted-query hashes + oddsToken from the request URLs, and then
// replay OddsQuery for each event from inside the page (same cookies/headers). Nothing secret is logged.
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { parseSboLines } from "./lines.mjs";
const log = (...a) => console.log(new Date().toLocaleTimeString(), "[sbobet]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openSbobet(cfg, gologinOpen) {
  const pass = (process.env.SBOBET_PASS || fs.readFileSync(cfg.passwordFile, "utf8")).trim();
  let page;
  if (gologinOpen) page = await gologinOpen({ ...cfg, id: cfg.gologinProfileId });
  else {
    const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      headless: process.env.SBO_HEADFUL ? false : "new", args: ["--no-sandbox", "--window-size=1366,900"] });
    page = await b.newPage(); await page.setViewport({ width: 1366, height: 900 });
  }
  const st = { page, cfg, api: null, hashes: {}, token: null, events: new Map(), odds: new Map(), seen: 0 };
  page.on("response", async (r) => {
    const u = r.url(); if (!/speedysurfcdn\.net\/api/.test(u)) return;
    try {
      const q = new URL(u), op = q.searchParams.get("operationName");
      st.api = q.origin + q.pathname;
      const ext = JSON.parse(q.searchParams.get("extensions") || "{}"), vars = JSON.parse(q.searchParams.get("variables") || "{}");
      if (op && ext.persistedQuery?.sha256Hash) st.hashes[op] = ext.persistedQuery.sha256Hash;
      if (vars.query?.oddsToken) st.token = vars.query.oddsToken;
      if (op === "OddsQuery") st.headers = pick(r.request().headers());
      const j = await r.json(); st.seen++;
      ingest(st, op, j, vars);
    } catch {}
  });
  for (const url of [cfg.url, cfg.mirrorUrl].filter(Boolean)) {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    if (await page.$("#username")) break;
  }
  if (await page.$("#username")) {
    await page.type("#username", cfg.username, { delay: 40 }); await page.type("#password", pass, { delay: 40 });
    await page.keyboard.press("Enter"); await sleep(12000);
  }
  await page.goto(cfg.sportsbookUrl, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
  await sleep(8000);
  const txt = (await page.content()).toLowerCase();
  if (/captcha|click to verify/.test(txt)) throw new Error("SBOBet shows a CAPTCHA after login — solve it once in the GoLogin profile/headful browser, then restart");
  log("logged in; api responses so far:", st.seen, "hashes:", Object.keys(st.hashes).join(",") || "none yet");
  return st;
}
const pick = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => /^(x-|accept|content-type)/i.test(k)));

// Defensive parsing: response shapes are only partly known.
function walk(o, f) { if (o && typeof o === "object") { f(o); for (const v of Object.values(o)) walk(v, f); } }
function ingest(st, op, j, vars) {
  walk(j, (o) => {
    const id = o.eventId ?? o.id;
    const home = o.homeTeamName ?? o.homeTeam?.name ?? o.homeTeam ?? o.home?.name ?? o.home;
    const away = o.awayTeamName ?? o.awayTeam?.name ?? o.awayTeam ?? o.away?.name ?? o.away;
    if (id && typeof home === "string" && typeof away === "string")
      st.events.set(+id, { id: +id, home, away, league: o.tournament?.name ?? o.tournamentName ?? o.leagueName ?? "",
        start: Date.parse(o.kickoffTime ?? o.startTime ?? o.eventDate ?? "") / 1000 || 0, live: !!(o.isLive ?? o.live) });
    if (o.marketType && Array.isArray(o.prices)) {
      const eid = +(o.eventResult?.eventId ?? vars?.query?.id); if (!eid) return;
      const m = st.odds.get(eid) || new Map(); st.odds.set(eid, m);
      m.set(`${o.marketType}|${o.point}|${o.id}`, { ...o, isLive: o.isLive ?? vars?.query?.filter === "Live", at: Date.now() });
    }
  });
}

async function replayOdds(st, ev) {
  if (!st.api || !st.hashes.OddsQuery || !st.token) return;
  const variables = { query: { id: ev.id, filter: ev.live ? "Live" : "NonLive", marketGroupIds: null, excludeMarketGroupIds: null,
    oddsCategory: "All", priceStyle: "Euro", oddsToken: st.token } };
  const url = `${st.api}?operationName=OddsQuery&variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&extensions=${encodeURIComponent(JSON.stringify({ persistedQuery: { version: 1, sha256Hash: st.hashes.OddsQuery } }))}`;
  const j = await st.page.evaluate(async (url, h) => { try { const r = await fetch(url, { headers: h, credentials: "include" }); return r.ok ? r.json() : null; } catch { return null; } }, url, st.headers || {});
  if (j) ingest(st, "OddsQuery", j, variables);
}

export const isPriority = (league, kws = []) => kws.some((k) => k === "II" ? /\bII\b/.test(league || "") : String(league || "").toLowerCase().includes(k.toLowerCase()));
// Priority leagues first (every round), then the rest fill the remaining capacity. Nothing is dropped from the output.
export function pickEvents(events, cap, kws) {
  const all = [...events], pr = all.filter((e) => isPriority(e.league, kws)), rest = all.filter((e) => !isPriority(e.league, kws));
  return [...pr, ...rest].slice(0, Math.max(cap, pr.length));
}
export async function readSbobet(st, kws = []) {
  const ids = pickEvents(st.events.values(), st.cfg.maxEventsPerRound || 80, kws);
  for (const ev of ids) await replayOdds(st, ev);
  const sign = st.cfg.handicapSign || 1, rows = [], fresh = Date.now() - 120000;
  for (const ev of st.events.values()) {
    const ms = st.odds.get(ev.id); if (!ms) continue;
    const recs = [...ms.values()].filter((x) => x.at >= fresh), o = {};
    const mk = parseSboLines(recs, sign); // all Handicap lines incl. quarter lines
    for (const x of recs) { const p = Object.fromEntries(x.prices.map((y) => [y.option, +y.price]));
      if (/^(OneXTwo|1X2|MoneyLine)$/i.test(x.marketType) && p.h && p.a) Object.assign(o, { 1: p.h, 3: p.a, ...(p.d ? { 2: p.d } : {}) }); }
    if (Object.keys(mk).length || o[1]) rows.push({ sport: "Football", league: ev.league, home: ev.home, away: ev.away, start: ev.start, live: ev.live, o, mk });
  }
  return rows;
}
