import { createServerFn } from "@tanstack/react-start";
import type { UsdRates } from "./rates";

/** USD rates for the supported coins, or null when the provider is unreachable. */
export const getCoinRates = createServerFn({ method: "GET" }).handler(async (): Promise<UsdRates | null> => {
  const { coinGeckoProvider } = await import("./rates.server");
  return coinGeckoProvider.getUsdRates();
});
