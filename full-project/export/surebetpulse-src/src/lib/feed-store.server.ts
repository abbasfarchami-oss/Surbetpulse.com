import { isRemovedBook, type Opportunity } from "./arb";
import { ingestBigOdds } from "./bigodds.server";
import { isErrorRow, isSameFamilyArb } from "./filters";

// Best-effort in-memory buffer (per server instance). Replace with a database for durable, shared storage.
const g = globalThis as unknown as { __feed?: Opportunity[] };
export const feed = (): Opportunity[] => (g.__feed ??= []);
export function pushOpps(items: Opportunity[]) {
  // Reject data errors (profit above the 200% error threshold) and same-family surebets, and rows quoting removed bookmakers.
  const clean = items.filter((it) => !isErrorRow(it) && !isSameFamilyArb(it) && !it.outcomes.some((o) => isRemovedBook(o.bookmaker)));
  const f = feed();
  for (const it of clean) {
    const i = f.findIndex((x) => x.id === it.id);
    if (i >= 0) f[i] = it;
    else f.unshift(it);
  }
  f.splice(300);
  // Every ingestion path (webhook + server collector) also feeds Big Odds of the Day.
  ingestBigOdds(clean);
}
