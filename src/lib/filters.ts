import { persistSetting, useCatalog } from "./cloud-state";
import { BOOKS, profitPct, valueEdge, type Opportunity } from "./arb";

/**
 * Filtering rules shared by the scanner UI and the server feed ingestion:
 * - Error threshold (default 200% profit, editable in admin): arbs ABOVE it are
 *   treated as data errors — discarded at ingestion and hidden in the UI.
 *   Everything up to the threshold is shown normally.
 * - High edge (>20%): shown normally, with an optional neutral "High edge" tag.
 * - Same-family: surebets whose legs all come from one bookmaker family (e.g. 1xBet
 *   clones) are rejected at ingestion and hidden in the UI.
 */

export const HIGH_EDGE_THRESHOLD = 20;

export const edgePct = (o: Opportunity) => (o.type === "surebet" ? profitPct(o.outcomes) : valueEdge(o));
export const isHighEdge = (o: Opportunity) => edgePct(o) > HIGH_EDGE_THRESHOLD;

// ---- Error threshold (editable in admin, persisted in Lovable Cloud) ----

export const DEFAULT_ERROR_THRESHOLD = 200;

export async function saveErrorThreshold(n: number) { await persistSetting({ key: "error_threshold", value: n }); }
export function useErrorThreshold() {
  const catalog = useCatalog();
  return Number(catalog.data?.settings["error_threshold"] ?? DEFAULT_ERROR_THRESHOLD);
}

/** True when profit is ABOVE the error threshold — a data error, never shown. */
export const isErrorRow = (o: Opportunity, threshold = DEFAULT_ERROR_THRESHOLD) => edgePct(o) > threshold;

// ---- Same-family rule ----

/** Bookmaker family from BOOKS (case-insensitive); unknown bookmakers count as their own family. */
export function familyOf(bookmaker: string): string {
  const b = BOOKS.find((x) => x.name.toLowerCase() === bookmaker.trim().toLowerCase());
  return b?.family ?? bookmaker;
}

/** True when every leg of a surebet comes from the same bookmaker family. */
export function isSameFamilyArb(o: Opportunity): boolean {
  if (o.type !== "surebet" || o.outcomes.length < 2) return false;
  const fams = o.outcomes.map((x) => familyOf(x.bookmaker).toLowerCase());
  return fams.every((f) => f === fams[0]);
}

// ---- Regional / Asian leagues priority (editable in admin, persisted in Lovable Cloud) ----

export const DEFAULT_REGIONAL_KEYWORDS = [
  "Bangladesh", "Vietnam", "Indonesia", "Thailand", "Malaysia", "India", "Myanmar", "Cambodia",
  "Singapore", "Hong Kong", "China", "Korea", "Japan", "Australia", "Russia", "Belarus",
  "Kazakhstan", "Uzbekistan", "Armenia",
  "U21", "U23", "Reserves", "II", "2nd Division", "Division 2", "Liga 2", "Youth",
];

export async function saveRegionalKeywords(list: string[]) { await persistSetting({ key: "regional_keywords", value: list }); }
export function useRegionalKeywords() {
  const catalog = useCatalog();
  return (catalog.data?.settings["regional_keywords"] as string[] | undefined) ?? DEFAULT_REGIONAL_KEYWORDS;
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * True when the league or a team name contains one of the keywords (case-insensitive).
 * Short keywords (<=3 chars, e.g. "II", "U21") match whole words only, so "II" does
 * not match "Ittihad".
 */
export function isRegionalMatch(o: Opportunity, keywords: string[]): boolean {
  const hay = `${o.league} ${o.event}`.toLowerCase();
  return keywords.some((k) => {
    const kw = k.trim().toLowerCase();
    if (!kw) return false;
    if (kw.length <= 3) return new RegExp(`\\b${escRe(kw)}\\b`, "i").test(hay);
    return hay.includes(kw);
  });
}

/** Regional matches first, then the normal recency sort. */
export function sortRegionalFirst(list: Opportunity[], keywords: string[]): Opportunity[] {
  return [...list].sort((a, b) => {
    const ra = isRegionalMatch(a, keywords) ? 0 : 1;
    const rb = isRegionalMatch(b, keywords) ? 0 : 1;
    return ra - rb || b.updatedAt - a.updatedAt;
  });
}
