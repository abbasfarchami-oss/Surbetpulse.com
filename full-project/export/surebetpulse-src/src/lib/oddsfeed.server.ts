// Server-side odds collector. Reads a licensed odds provider over HTTPS and feeds
// the same in-memory buffer the browser collector uses. Runs inside the app, so no
// extra machine is needed. Skipped silently when no provider key is configured.
import { pushOpps } from "./feed-store.server";
import { buildOpportunities, type FeedEvent } from "./oddsfeed-core";

type State = {
  last: number;
  running: Promise<void> | null;
  prev: Map<string, number>;
  sports: string[];
  sportsAt: number;
  lastError: string;
  lastOk: number;
};

const g = globalThis as unknown as { __oddsFeed?: State };
const state = (): State =>
  (g.__oddsFeed ??= { last: 0, running: null, prev: new Map(), sports: [], sportsAt: 0, lastError: "", lastOk: 0 });

const HOST = "https://api.the-odds-api.com/v4";
/** Preferred order; the provider is asked which of these are actually in season. */
const PREFERRED = [
  "soccer_epl", "soccer_uefa_champs_league", "soccer_spain_la_liga", "soccer_germany_bundesliga",
  "soccer_italy_serie_a", "soccer_france_ligue_one",
];
/** Soccer only — keeps the free 500-requests/month quota in check. */
const SUPPORTED = /^soccer_/;

async function getJson(url: string, ms = 9000): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`odds provider responded ${r.status}`);
  return await r.json();
}

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Free call (no quota) that lists in-season sports; cached for an hour. */
async function loadSports(key: string): Promise<string[]> {
  const s = state();
  if (s.sports.length && Date.now() - s.sportsAt < 3_600_000) return s.sports;
  try {
    const all = (await getJson(`${HOST}/sports/?apiKey=${encodeURIComponent(key)}`)) as { key: string }[];
    const live = new Set(all.map((a) => a.key).filter((k) => SUPPORTED.test(k)));
    s.sports = [...PREFERRED.filter((k) => live.has(k)), ...[...live].filter((k) => !PREFERRED.includes(k))];
    s.sportsAt = Date.now();
    s.lastError = "";
  } catch (e) {
    s.lastError = e instanceof Error ? e.message : "sports unavailable";
  }
  return s.sports;
}

/**
 * Pulls one odds snapshot per selected sport. Cost per sweep is
 * sports × markets × regions, so every knob here is a quota decision.
 */
export async function refreshOddsFeed(): Promise<void> {
  const s = state();
  const key = process.env["ODDS_FEED_KEY"];
  if (!key) return;
  if (s.running) return s.running;
  // Default 90 min between sweeps ≈ 16 requests/day, under the 500/month free quota.
  const interval = Math.max(60, num(process.env["ODDS_FEED_INTERVAL"], 5400)) * 1000;
  if (Date.now() - s.last < interval) return;
  s.last = Date.now();
  s.running = (async () => {
    const limit = Math.max(1, Math.min(12, Math.round(num(process.env["ODDS_FEED_SPORTS"], 4))));
    const markets = (process.env["ODDS_FEED_MARKETS"] ?? "h2h").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(",") || "h2h";
    const regions = (process.env["ODDS_FEED_REGIONS"] ?? "eu").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3).join(",") || "eu";
    const sports = (await loadSports(key)).slice(0, limit);
    // The runtime allows 6 outbound calls at a time; keep one slot free.
    for (let i = 0; i < sports.length; i += 5) {
      const chunk = sports.slice(i, i + 5);
      const pages = await Promise.all(chunk.map(async (sp) => {
        try {
          const url = `${HOST}/sports/${sp}/odds?regions=${regions}&markets=${markets}&oddsFormat=decimal&apiKey=${encodeURIComponent(key)}`;
          return (await getJson(url)) as FeedEvent[];
        } catch (e) {
          s.lastError = e instanceof Error ? e.message : "odds fetch failed";
          return [] as FeedEvent[];
        }
      }));
      const opps = pages.flat().flatMap((ev) => buildOpportunities(ev, s.prev));
      if (opps.length) {
        pushOpps(opps);
        s.lastOk = Date.now();
        s.lastError = "";
      }
    }
    if (s.prev.size > 8000) s.prev.clear();
  })().finally(() => {
    s.running = null;
  });
  return s.running;
}

/** Small status object for the admin panel: whether the provider is reachable. */
export function oddsFeedStatus() {
  const s = state();
  return { configured: !!process.env["ODDS_FEED_KEY"], sports: s.sports.length, lastOk: s.lastOk, lastError: s.lastError };
}
