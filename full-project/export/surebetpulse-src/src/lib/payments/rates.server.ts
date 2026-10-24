// Server-only rate provider: CoinGecko simple/price (no API key needed for basic use).
// Cached for 60s per server instance to stay well inside the free rate limit.
import { COINS } from "./coins";
import type { RateProvider, UsdRates } from "./rates";

const g = globalThis as unknown as { __coinRates?: { at: number; rates: UsdRates } };

export const coinGeckoProvider: RateProvider = {
  async getUsdRates(): Promise<UsdRates | null> {
    const cached = g.__coinRates;
    if (cached && Date.now() - cached.at < 60_000) return cached.rates;
    try {
      const ids = COINS.map((c) => c.geckoId).join(",");
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as Record<string, { usd?: number }>;
      const rates: UsdRates = {};
      for (const c of COINS) {
        const usd = json[c.geckoId]?.usd;
        if (typeof usd === "number" && usd > 0) rates[c.code] = usd;
      }
      if (!Object.keys(rates).length) return null;
      g.__coinRates = { at: Date.now(), rates };
      return rates;
    } catch {
      return null;
    }
  },
};
