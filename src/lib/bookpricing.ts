import { useEffect, useMemo, useState } from "react";
import { BOOKMAKERS } from "@/lib/arb";
import { persistSetting, useCatalog } from "./cloud-state";

export type BookPricing = { base: number; included: string[]; prices: Record<string, number> };
/** ArbMate-style monthly add-on prices (USD); unlisted mirrors/clones cost $2. */
const PRICE_TIERS: Record<string, number> = {
  Pinnacle: 0, Bet365: 0, "1xBet": 0,
  "William Hill": 4, Unibet: 4, SBOBet: 4,
  Marathonbet: 3, Betway: 3, bwin: 3,
};
export const DEFAULT_PRICING: BookPricing = {
  base: 20,
  included: ["1xBet", "Pinnacle", "Bet365"],
  prices: Object.fromEntries(BOOKMAKERS.map((b) => [b, PRICE_TIERS[b] ?? 2])),
};
const SEL = "book_selection_v1", EVT = "book-pricing-changed";

/** Monthly total: base + price of each selected bookmaker not already included. */
export function monthlyTotal(p: BookPricing, selected: string[]) {
  return p.base + selected.filter((b) => !p.included.includes(b)).reduce((s, b) => s + (p.prices[b] ?? 0), 0);
}
function read<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } }
export async function savePricing(p: BookPricing) { await persistSetting({ key: "book_pricing", value: p }); }
export function saveSelection(s: string[]) { localStorage.setItem(SEL, JSON.stringify(s)); window.dispatchEvent(new Event(EVT)); }
export function useBookPricing() {
  const catalog = useCatalog();
  const stored = catalog.data?.settings["book_pricing"] as BookPricing | undefined;
  const pricing = useMemo(() => stored ? { ...DEFAULT_PRICING, ...stored, prices: { ...DEFAULT_PRICING.prices, ...stored.prices } } : DEFAULT_PRICING, [stored]);
  const [selected, setS] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => { setS(read(SEL, [])); };
    sync(); window.addEventListener(EVT, sync); return () => window.removeEventListener(EVT, sync);
  }, []);
  return { pricing, selected };
}
