import type { Opportunity } from "./arb";

/**
 * "Big Odds of the Day" aggregation — pure, testable logic.
 * The server store (bigodds.server.ts) is a thin globalThis wrapper around this.
 */

export type BigOddsEntry = {
  /** Stable identity: event + market + outcome label + bookmaker (normalized). */
  key: string;
  sport: string;
  match: string;
  market: string;
  outcome: string;
  bookmaker: string;
  /** Current odds (last seen). */
  odds: number;
  /** Highest odds seen today for this key. */
  peakOdds: number;
  /** First time seen today (ms epoch). */
  foundAt: number;
  /** Last update (ms epoch). */
  updatedAt: number;
};

export type BigOddsStore = {
  /** UTC calendar day the entries belong to (YYYY-MM-DD). */
  day: string;
  entries: Map<string, BigOddsEntry>;
};

export const BIG_ODDS_CAP = 200;

export const createBigOddsStore = (): BigOddsStore => ({ day: "", entries: new Map() });

/** Calendar day in UTC, e.g. "2026-10-23". The table resets when this changes. */
export function utcDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Ranking: highest odds first; ties broken by earlier foundAt. */
export function sortBigOdds(entries: Iterable<BigOddsEntry>): BigOddsEntry[] {
  return [...entries].sort((a, b) => b.odds - a.odds || a.foundAt - b.foundAt);
}

/**
 * Records every outcome of the given opportunities. A new day (UTC)
 * resets the store. Existing keys keep their original foundAt and track the
 * peak odds; the store keeps only the top BIG_ODDS_CAP by ranking.
 */
export function recordBigOdds(store: BigOddsStore, opps: Opportunity[], now: number): BigOddsStore {
  const day = utcDayKey(now);
  if (store.day !== day) {
    store.day = day;
    store.entries.clear();
  }
  for (const opp of opps) {
    for (const o of opp.outcomes) {
      const key = `${norm(opp.event)}|${norm(opp.market)}|${norm(o.label)}|${norm(o.bookmaker)}`;
      const existing = store.entries.get(key);
      if (existing) {
        existing.odds = o.odds;
        existing.peakOdds = Math.max(existing.peakOdds, o.odds);
        existing.updatedAt = now;
      } else {
        store.entries.set(key, {
          key,
          sport: opp.sport,
          match: opp.event,
          market: opp.market,
          outcome: o.label,
          bookmaker: o.bookmaker,
          odds: o.odds,
          peakOdds: o.odds,
          foundAt: now,
          updatedAt: now,
        });
      }
    }
  }
  if (store.entries.size > BIG_ODDS_CAP) {
    const keep = new Set(sortBigOdds(store.entries.values()).slice(0, BIG_ODDS_CAP).map((e) => e.key));
    for (const k of store.entries.keys()) if (!keep.has(k)) store.entries.delete(k);
  }
  return store;
}

/** "Nov 22, 05:16 UTC" — always UTC, 24h, Latin digits. fa/ckb get Persian month labels. */
export function formatFoundAt(ts: number, lang: string): string {
  const locale = lang === "fa" || lang === "ckb" ? "fa-IR-u-nu-latn" : "en-US";
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ts);
  return `${formatted} UTC`;
}

/** Return % next to the odds: 1.50 -> "50%", 1.505 -> "50.5%". Always Latin digits. */
export function formatReturnPct(odds: number): string {
  const ret = (odds - 1) * 100;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(ret)}%`;
}
