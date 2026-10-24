import { persistSetting, useCatalog } from "./cloud-state";
import { getAdminSettings } from "./cloud.functions";

/** Display mode never places bets automatically. */
export type BetMode = "odds" | "slip";
export async function setBetMode(mode: BetMode) { await persistSetting({ key: "bet_mode", value: mode }); }
export function useBetMode(): BetMode {
  const catalog = useCatalog();
  return catalog.data?.settings["bet_mode"] === "slip" ? "slip" : "odds";
}
export type CustomBook = { name: string; domain: string };
export async function loadCustomBooks(): Promise<CustomBook[]> { return await getAdminSettings() as CustomBook[]; }
export async function saveCustomBooks(books: CustomBook[]) { await persistSetting({ key: "custom_books", value: books }); }
