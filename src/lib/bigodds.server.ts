// Best-effort in-memory "Big Odds of the Day" store (per server instance),
// same lifecycle as the feed store. Replace with a database for durability.
import { createBigOddsStore, recordBigOdds, sortBigOdds, type BigOddsEntry, type BigOddsStore } from "./bigodds-core";
import type { Opportunity } from "./arb";

const g = globalThis as unknown as { __bigOdds?: BigOddsStore };
const store = (): BigOddsStore => (g.__bigOdds ??= createBigOddsStore());

export function ingestBigOdds(opps: Opportunity[]) {
  recordBigOdds(store(), opps, Date.now());
}

export function listBigOdds(): BigOddsEntry[] {
  // Recording with an empty batch also applies the midnight (UTC) reset.
  recordBigOdds(store(), [], Date.now());
  return sortBigOdds(store().entries.values());
}
