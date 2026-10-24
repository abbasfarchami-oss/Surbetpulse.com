/**
 * Rate provider abstraction. The UI only knows this interface; the concrete
 * provider (CoinGecko today) lives in rates.server.ts behind a server function.
 * Returns null when rates are unavailable — the UI must show its
 * "rate unavailable" state, never a made-up number.
 */
export type UsdRates = Record<string, number>;

export interface RateProvider {
  /** USD price per coin code (e.g. { BTC: 67000, USDT: 1 }), or null when unavailable. */
  getUsdRates(): Promise<UsdRates | null>;
}
