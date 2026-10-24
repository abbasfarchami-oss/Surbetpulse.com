// Standalone Pinnacle reader. Public guest API the pinnacle.com frontend itself uses (matchups + markets/straight).
import { getJson } from "../_shared/http.mjs";
import { logError, writeStatus } from "../_shared/output.mjs";
export const CONFIG = { key: "pinnacle", name: "Pinnacle", family: "pinnacle", engine: "pinnacle", domain: "www.pinnacle.com",
  mirrors: ["ps3838.com", "pinnacle888.com"], api: "https://guest.api.arcadia.pinnacle.com/0.1/sports/29" };
export const meta = { ...CONFIG, mode: "gologin-page", experimental: false };
const am = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
export function parse(matchups = [], markets = []) {
  const px = new Map(); for (const x of markets) if (x.type === "moneyline" && x.period === 0) px.set(x.matchupId, x.prices);
  return matchups.filter((e) => e.participants?.length === 2 && px.has(e.id)).map((e) => {
    const o = {}; for (const p of px.get(e.id)) { const t = { home: 1, draw: 2, away: 3 }[p.designation]; if (t) o[t] = +am(p.price).toFixed(3); }
    const ph = e.participants.find((p) => p.alignment === "home"), pa = e.participants.find((p) => p.alignment === "away");
    return { sport: "Football", league: e.league?.name || "", home: ph?.name, away: pa?.name, start: Date.parse(e.startTime) / 1000, live: !!e.isLive, o, mk: {} };
  }).filter((e) => e.home && e.away && e.o[1] && e.o[3]);
}
export async function health() {
  const r = await getJson(`${CONFIG.api}/matchups`);
  const st = { feedResponds: r.status === 200, verifiedData: Array.isArray(r.json) && r.json.length > 0, tried: [`guest api matchups -> ${r.status || r.error} ${r.snippet.slice(0, 60)}`] };
  if (!st.verifiedData) { st.blocked = r.status === 0 ? "no response" : `HTTP ${r.status} (API key / geo: needs page context + non-Finland proxy)`; logError(CONFIG.key, st.tried[0]); }
  return writeStatus(CONFIG.key, st);
}
export async function readInPage(page) {
  try {
    const { m, k, err } = await page.evaluate(async (base) => {
      try { const key = window.__API_KEY__ || localStorage.getItem("api-key") || ""; const h = key ? { "x-api-key": key } : {};
        const [m, k] = await Promise.all([fetch(`${base}/matchups`, { headers: h }).then((r) => r.json()), fetch(`${base}/markets/straight?primaryOnly=true`, { headers: h }).then((r) => r.json())]);
        return { m, k }; } catch (e) { return { m: [], k: [], err: e.message }; } }, CONFIG.api);
    if (err) logError(CONFIG.key, err);
    const rows = parse(m, k); writeStatus(CONFIG.key, { lastRead: rows.length, error: err || null }); return rows;
  } catch (e) { logError(CONFIG.key, e.message); return []; }
}
