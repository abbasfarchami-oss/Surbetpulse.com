import { profitPct, valueEdge, type Opportunity } from "./arb";
import { normalizeName, type MatchedPair } from "./matcher";

/**
 * Per-match grouping: all opportunities/pairs of one match collapse into ONE card.
 * Over/Under is the primary market (best OU line first); everything else goes into
 * the collapsible "More markets" section. Matches without OU use their best other
 * market as primary.
 */

/** Over/Under (totals) market names: "Total 2.5", "Over/Under 2.5", "O/U 2.5", ... */
export const isOverUnderMarket = (market: string) => /^(total|over\s*\/\s*under|o\s*\/\s*u)\b/i.test(market.trim());

const score = (o: Opportunity) => (o.type === "surebet" ? profitPct(o.outcomes) : valueEdge(o));

export type MatchGroup = { event: string; primary: Opportunity; others: Opportunity[] };

/** Group opportunities by normalized event name; primary = best OU line, else best market. */
export function groupOpportunities(list: Opportunity[]): MatchGroup[] {
  const byEvent = new Map<string, Opportunity[]>();
  for (const o of list) {
    const k = normalizeName(o.event);
    const arr = byEvent.get(k);
    if (arr) arr.push(o); else byEvent.set(k, [o]);
  }
  return [...byEvent.values()].map((items) => {
    const sorted = [...items].sort((a, b) => score(b) - score(a) || b.updatedAt - a.updatedAt);
    const ou = sorted.filter((o) => isOverUnderMarket(o.market));
    const primary = ou[0] ?? sorted[0]!;
    return { event: primary.event, primary, others: sorted.filter((o) => o !== primary) };
  });
}

export type PairMatchGroup = { event: string; primary: MatchedPair; others: MatchedPair[] };

const pairScore = (p: MatchedPair) => (p.surebet ? 1_000_000 : 0) + p.diffAbs;

/** Group matched pairs by event; primary = best OU pair (surebet first, then biggest diff), else best other. */
export function groupPairsByMatch(pairs: MatchedPair[]): PairMatchGroup[] {
  const byEvent = new Map<string, MatchedPair[]>();
  for (const p of pairs) {
    const k = normalizeName(p.event);
    const arr = byEvent.get(k);
    if (arr) arr.push(p); else byEvent.set(k, [p]);
  }
  return [...byEvent.values()].map((items) => {
    const sorted = [...items].sort((a, b) => pairScore(b) - pairScore(a) || b.updatedAt - a.updatedAt);
    const ou = sorted.filter((p) => isOverUnderMarket(p.market));
    const primary = ou[0] ?? sorted[0]!;
    return { event: primary.event, primary, others: sorted.filter((p) => p !== primary) };
  });
}
