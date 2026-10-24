// Standalone reader (1xBet engine). Own config, own parser, own error log, own health status. Read-only; never bets, never logs in.
import { getJson, sortedQs } from "../_shared/http.mjs";
import { logError, writeStatus } from "../_shared/output.mjs";
export const CONFIG = {
  "key": "betforward",
  "name": "BetForward",
  "family": "1xbet",
  "engine": "1x",
  "domain": "betforward.com",
  "mirrors": ["www.betforward.com", "m.betforward.com"],
  "feedPrefix": "service-api/",
  "v3Query": "cfView=3&fcountry=197&gr=285&grMode=4&lng=en&ref=1&selectedMs=1.1,2.1,10.1",
  "legacyQuery": "sports=1&count=50&lng=en&mode=4&country=1",
  "gologinProfileId": null,
  "note": "engine NOT verified as 1x; 301 redirect from box"
};
export const meta = { ...CONFIG, mode: "gologin-page", experimental: false };

// --- own parser: v3 games1x2 game object -> row (1X2 + AH + OU) ---
export function parseV3(g) {
  const normLine = (x) => { const v = Math.round((+x || 0) * 4) / 4; return Object.is(v, -0) ? 0 : v; };
  const AH = { 7: "h", 8: "a", 3829: "h", 3830: "a" }, OU = { 9: "o", 10: "u", 3827: "o", 3828: "u" };
  const o = {}, mk = {};
  for (const grp of [...(g.eventGroups || []), ...(g.centralBlockEventGroups || [])])
    for (const x of (grp.events || []).flat()) {
      const p = +(x.parameter || 0), c = +x.cf; if (!(c > 1)) continue;
      if (grp.groupId === 1 && [1, 2, 3].includes(x.type)) o[x.type] = c;
      else if ((grp.groupId === 2 || grp.groupId === 2854) && AH[x.type]) { const s = AH[x.type], k = "AH:" + normLine(s === "h" ? p : -p); const m = (mk[k] ||= {}); m[s] = Math.max(m[s] || 0, c); }
      else if ((grp.groupId === 17 || grp.groupId === 99) && OU[x.type]) { const s = OU[x.type], k = "OU:" + normLine(p); const m = (mk[k] ||= {}); m[s] = Math.max(m[s] || 0, c); }
    }
  return { sport: g.sport?.name || "Football", league: g.liga?.name || "", home: g.opponent1?.fullName || g.opponent1?.opps?.[0]?.name,
    away: g.opponent2?.fullName || g.opponent2?.opps?.[0]?.name, start: g.startTs || 0, id: g.id, o, mk };
}
// --- own parser: legacy LineFeed/Get1x2_VZip Value item -> row (1X2 only from E list) ---
export function parseLegacy(v) {
  const o = {}; for (const e of v.E || []) if (e.G === 1 && [1, 2, 3].includes(e.T) && e.C > 1) o[e.T] = +e.C;
  return { sport: v.SE || "Football", league: v.L || "", home: v.O1, away: v.O2, start: v.S || 0, id: v.I, o, mk: {} };
}
export const parseFeed = (json) => Array.isArray(json) ? json.filter((g) => g.sport?.id === 1).map(parseV3)
  : Array.isArray(json?.Value) ? json.Value.map(parseLegacy) : [];
const valid = (r) => r.home && r.away && ((r.o[1] && r.o[3]) || Object.keys(r.mk).length);

// --- health: light read-only public GET from the box (no browser, no login) ---
export async function health() {
  const tried = [];
  for (const d of [CONFIG.domain, ...CONFIG.mirrors]) {
    for (const [kind, path] of [["v3", `main-line-feed/v3/games1x2?${sortedQs(CONFIG.v3Query + "&count=10")}`], ["legacy", `LineFeed/Get1x2_VZip?${CONFIG.legacyQuery}`]]) {
      const r = await getJson(`https://${d}/${CONFIG.feedPrefix}${path}`);
      const rows = r.json ? parseFeed(r.json).filter(valid) : [];
      tried.push(`${d} ${kind} -> ${r.status || r.error}${r.location ? " => " + r.location.slice(0, 60) : ""}${r.json ? ` rows=${rows.length}` : ""}`);
      if (rows.length) return writeStatus(CONFIG.key, { feedResponds: true, verifiedData: true, via: `${d} ${kind}`, sample: `${rows[0].home} vs ${rows[0].away} (${rows[0].league})`, rows: rows.length, tried });
    }
  }
  logError(CONFIG.key, "health: no working feed: " + tried.join(" | "));
  return writeStatus(CONFIG.key, { feedResponds: tried.some((t) => / -> 200 rows=/.test(t)), verifiedData: false, tried });
}

// --- in-browser read (inside the user's GoLogin page; same cookies, no login) ---
export async function readInPage(page, { live = false } = {}) {
  try {
    const res = await page.evaluate(async (prefix, q, live, v3Src, legSrc) => {
      const pV3 = new Function("return " + v3Src)(), pLeg = new Function("return " + legSrc)(), err = [];
      try { const r = await fetch(`/${prefix}main-${live ? "live" : "line"}-feed/v3/games1x2?${q}`); if (r.ok) return { rows: (await r.json()).filter((g) => g.sport?.id === 1).map(pV3), err }; err.push("v3 " + r.status); } catch (e) { err.push("v3 " + e.message); }
      try { const r = await fetch(`/${prefix}${live ? "LiveFeed" : "LineFeed"}/Get1x2_VZip?sports=1&count=50&lng=en&mode=4&country=1`); if (r.ok) return { rows: ((await r.json()).Value || []).map(pLeg), err }; err.push("legacy " + r.status); } catch (e) { err.push("legacy " + e.message); }
      return { rows: [], err };
    }, CONFIG.feedPrefix, sortedQs(CONFIG.v3Query + "&count=50"), live, parseV3.toString(), parseLegacy.toString());
    if (res.err.length) logError(CONFIG.key, res.err.join("; "));
    const rows = res.rows.filter(valid).map((r) => ({ ...r, live }));
    writeStatus(CONFIG.key, { lastRead: rows.length, live, errors: res.err });
    return rows;
  } catch (e) { logError(CONFIG.key, e.message); writeStatus(CONFIG.key, { lastRead: 0, error: e.message }); return []; }
}
