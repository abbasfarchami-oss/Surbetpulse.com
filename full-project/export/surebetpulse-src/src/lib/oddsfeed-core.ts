// Pure mapping from an odds-provider payload into dashboard opportunities.
// No network, no environment reads — safe for tests and for the browser graph.
import type { Opportunity, Outcome } from "./arb";

export type FeedOutcome = { name: string; price: number; point?: number | undefined };
export type FeedMarket = { key: string; outcomes?: FeedOutcome[] | undefined };
export type FeedBookmaker = { key?: string | undefined; title?: string | undefined; markets?: FeedMarket[] | undefined };
export type FeedEvent = {
  id: string;
  sport_key?: string | undefined;
  sport_title?: string | undefined;
  commence_time: string;
  home_team?: string | undefined;
  away_team?: string | undefined;
  bookmakers?: FeedBookmaker[] | undefined;
};

/** Provider bookmaker keys mapped onto the names the dashboard already knows. */
const KEY_BOOKS: [string, string][] = [
  ["1xbet", "1xBet"], ["pinnacle", "Pinnacle"], ["sbo", "SBOBet"],
  ["marathonbet", "Marathonbet"], ["unibet", "Unibet"], ["bwin", "bwin"],
  ["betway", "Betway"], ["williamhill", "William Hill"], ["bet365", "Bet365"], ["melbet", "Melbet"],
  ["betwinner", "Betwinner"], ["22bet", "22Bet"], ["betano", "Betano"], ["boyles", "Boyles"],
  ["sportingbet", "Sportingbet"], ["lsbet", "LSbet"], ["betfred", "Betfred"], ["coral", "Coral"],
  ["ladbrokes", "Ladbrokes"], ["williamhill_us", "Caesars"], ["sbs", "SBS"], ["bet365_it", "Bet365"],
];

export function bookName(key: string | undefined, title: string | undefined): string {
  const k = (key ?? "").toLowerCase();
  for (const [p, n] of KEY_BOOKS) if (k.startsWith(p)) return n;
  return (title ?? key ?? "Unknown").slice(0, 60);
}

/** Only sports the dashboard has tabs for; anything else is ignored. */
export function sportLabel(sportKey: string | undefined): string | null {
  const k = (sportKey ?? "").toLowerCase();
  if (k.startsWith("soccer")) return "Football";
  if (k.startsWith("basketball")) return "Basketball";
  if (k.startsWith("tennis")) return "Tennis";
  if (k.startsWith("volleyball")) return "Volleyball";
  if (k.startsWith("icehockey")) return "Ice Hockey";
  if (k.startsWith("esports")) return "Esports";
  return null;
}

const marketLabel = (marketKey: string, outcomes: number) =>
  marketKey === "h2h" ? (outcomes === 3 ? "1X2" : "Winner")
    : marketKey === "spreads" ? "Asian Handicap"
      : marketKey === "totals" ? "Total"
        : marketKey.slice(0, 60);

type Row = { market: string; book: string; name: string; price: number };

function opportunity(ev: FeedEvent, sport: string, marketKey: string, market: string, live: boolean, outcomes: Outcome[], type: "surebet" | "value"): Opportunity {
  const event = ev.home_team && ev.away_team ? `${ev.home_team} – ${ev.away_team}` : (ev.sport_title ?? ev.id);
  return {
    id: `feed-${ev.id}-${marketKey}`.slice(0, 80),
    type, sport,
    league: (ev.sport_title ?? "").slice(0, 80),
    event: event.slice(0, 160),
    market, live,
    startsAt: ev.commence_time.slice(0, 40),
    outcomes, source: "api", updatedAt: Date.now(),
  };
}

/**
 * Cross-book best price per outcome decides the opportunity:
 * margin below 1 is a surebet; otherwise a 2-way price that beats the vig-free
 * consensus by `minEdge` is published as a value bet. `prev` remembers the last
 * price of every outcome so a falling price is shown as a dropping odd.
 */
export function buildOpportunities(ev: FeedEvent, prev: Map<string, number>, minEdge = 1.05): Opportunity[] {
  const sport = sportLabel(ev.sport_key);
  if (!sport) return [];
  const rows: Row[] = [];
  for (const b of ev.bookmakers ?? []) {
    const book = bookName(b.key, b.title);
    for (const m of b.markets ?? []) {
      for (const o of m.outcomes ?? []) {
        if (!o.name || !(o.price > 1) || !Number.isFinite(o.price)) continue;
        rows.push({ market: m.key, book, name: o.point == null ? o.name : `${o.name} ${o.point}`, price: o.price });
      }
    }
  }
  const live = Date.parse(ev.commence_time) < Date.now();
  const out: Opportunity[] = [];
  for (const marketKey of [...new Set(rows.map((r) => r.market))]) {
    const list = rows.filter((r) => r.market === marketKey);
    const names = [...new Set(list.map((r) => r.name))];
    if (names.length < 2 || names.length > 3) continue;
    const best = names.map((n) => list.filter((r) => r.name === n).reduce((x, y) => (y.price > x.price ? y : x)));
    const margin = best.reduce((s, b) => s + 1 / b.price, 0);
    const stamp = `${ev.id}|${marketKey}`;
    const toOutcome = (r: Row): Outcome => {
      const k = `${stamp}|${r.name}`;
      const before = prev.get(k);
      prev.set(k, r.price);
      return {
        label: r.name.slice(0, 80), bookmaker: r.book.slice(0, 60), odds: r.price,
        prevOdds: before != null && before > r.price ? before : undefined,
      };
    };
    const market = marketLabel(marketKey, names.length);
    if (margin < 1) {
      out.push(opportunity(ev, sport, marketKey, market, live, best.map(toOutcome), "surebet"));
    } else if (names.length === 2) {
      const imp = names.map((n) => {
        const xs = list.filter((r) => r.name === n);
        return xs.reduce((s, r) => s + 1 / r.price, 0) / xs.length;
      });
      const sum = imp[0]! + imp[1]!;
      if (best.some((b, i) => b.price * (imp[i]! / sum) >= minEdge))
        out.push(opportunity(ev, sport, marketKey, market, live, best.map(toOutcome), "value"));
    }
  }
  return out;
}
