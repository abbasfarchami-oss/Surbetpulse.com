import { useEffect, useState } from "react";
import type { Opportunity, Outcome } from "./arb";
import { ahMarketName, ahPairKey, parseAhLine } from "./asianhandicap";

/** The two canonical bookmakers the matcher compares. Webhook must send exactly these names (case-insensitive). */
export const MATCHER_BOOK_A = "SBOBet";
export const MATCHER_BOOK_B = "1xBet";

/** Lowercase, strip punctuation, collapse whitespace — used to match event/market/label names. */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Resolve a feed bookmaker string to a canonical matcher book ("SBOBet" | "1xBet"), case-insensitive; aliases like "sbobet"/"1xbet" accepted. */
export function canonicalBook(name: string): string | undefined {
  const n = normalizeName(name);
  if (n === "sbobet") return MATCHER_BOOK_A;
  if (n === "1xbet") return MATCHER_BOOK_B;
  return undefined;
}

export type MatchedPair = {
  key: string;
  event: string;
  market: string;
  label: string;
  sport: string;
  league: string;
  live: boolean;
  a: Outcome; // SBOBet quote
  b: Outcome; // 1xBet quote
  line?: number | undefined; // canonical Asian handicap line when the pair is an AH market
  side?: string | undefined; // "home" | "away" for AH pairs
  diffAbs: number;
  diffPct: number; // relative to the lower odds
  surebet: boolean;
  updatedAt: number;
};

/** Two quotes form a 2-way surebet when the implied probabilities sum below 1. */
export const isSurebetPair = (a: number, b: number) => 1 / a + 1 / b < 1;

/** Pair SBOBet and 1xBet quotes sharing the same event + market + outcome label (normalized), across the whole feed. */
export function matchPairs(opps: Opportunity[]): MatchedPair[] {
  type Slot = { o: Outcome; at: number };
  const groups = new Map<string, { opp: Opportunity; a?: Slot; b?: Slot }>();
  for (const opp of opps) {
    for (const o of opp.outcomes) {
      const canon = canonicalBook(o.bookmaker);
      if (!canon) continue;
      // Asian handicap quotes pair by normalized event + absolute line + side; other markets by event + market + label.
      const ah = ahPairKey(opp.market, o.label);
      const key = ah
        ? [normalizeName(opp.event), ah].join("|")
        : [normalizeName(opp.event), normalizeName(opp.market), normalizeName(o.label)].join("|");
      let g = groups.get(key);
      if (!g) { g = { opp }; groups.set(key, g); }
      const slot: Slot = { o, at: opp.updatedAt };
      if (canon === MATCHER_BOOK_A) { if (!g.a || slot.at >= g.a.at) g.a = slot; }
      else { if (!g.b || slot.at >= g.b.at) g.b = slot; }
      if (opp.updatedAt > g.opp.updatedAt) g.opp = opp;
    }
  }
  const pairs: MatchedPair[] = [];
  for (const [key, g] of groups) {
    if (!g.a || !g.b) continue;
    const diffAbs = Math.abs(g.a.o.odds - g.b.o.odds);
    const diffPct = (diffAbs / Math.min(g.a.o.odds, g.b.o.odds)) * 100;
    const line = parseAhLine(g.opp.market, g.a.o.label) ?? undefined;
    pairs.push({
      key,
      event: g.opp.event,
      market: line != null ? ahMarketName(line) : g.opp.market,
      label: g.a.o.label,
      line,
      side: line != null ? (key.split("|")[3] ?? undefined) : undefined,
      sport: g.opp.sport,
      league: g.opp.league,
      live: g.opp.live ?? false,
      a: g.a.o,
      b: g.b.o,
      diffAbs,
      diffPct,
      surebet: isSurebetPair(g.a.o.odds, g.b.o.odds),
      updatedAt: Math.max(g.a.at, g.b.at),
    });
  }
  return pairs.sort((x, y) => y.updatedAt - x.updatedAt);
}

/** Whether a pair's difference meets the configured threshold (absolute odds points or percent). */
export function exceedsThreshold(p: MatchedPair, threshold: number, mode: "abs" | "pct"): boolean {
  return mode === "abs" ? p.diffAbs >= threshold : p.diffPct >= threshold;
}

/** Per-pair alert debounce: fires at most once per windowMs for the same key. */
export function shouldAlert(last: Map<string, number>, key: string, now: number, windowMs = 60_000): boolean {
  const prev = last.get(key);
  if (prev != null && now - prev < windowMs) return false;
  last.set(key, now);
  return true;
}

/** English spoken announcement naming the match, both odds and the difference. */
export function alertMessage(p: MatchedPair): string {
  const diff = p.diffAbs.toFixed(2);
  const odds = `SBOBet ${p.a.odds.toFixed(2)}, 1xBet ${p.b.odds.toFixed(2)}, difference ${diff}`;
  return p.surebet
    ? `Surebet between SBOBet and 1xBet on ${p.event}, ${p.market} ${p.label}. ${odds}.`
    : `Odds difference on ${p.event}, ${p.market} ${p.label}. ${odds}.`;
}

// ---- Settings (localStorage) ----

export type MatcherSettings = { delaySec: number; threshold: number; mode: "abs" | "pct" };
export const MATCHER_DELAY_MIN = 1;
export const MATCHER_DELAY_MAX = 60;
export const MATCHER_DEFAULTS: MatcherSettings = { delaySec: 5, threshold: 0.05, mode: "abs" };
const KEY = "arbradar_matcher_v1", EVT = "matcher-changed";

export const clampDelay = (n: number) =>
  Number.isFinite(n) ? Math.min(MATCHER_DELAY_MAX, Math.max(MATCHER_DELAY_MIN, Math.round(n))) : MATCHER_DEFAULTS.delaySec;

export function loadMatcherSettings(): MatcherSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MatcherSettings>;
      return {
        delaySec: clampDelay(Number(p.delaySec)),
        threshold: Number.isFinite(Number(p.threshold)) && Number(p.threshold) >= 0 ? Number(p.threshold) : MATCHER_DEFAULTS.threshold,
        mode: p.mode === "pct" ? "pct" : "abs",
      };
    }
  } catch { /* ignore */ }
  return MATCHER_DEFAULTS;
}

export function saveMatcherSettings(next: MatcherSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
}

export function useMatcherSettings(): [MatcherSettings, (patch: Partial<MatcherSettings>) => void] {
  const [s, setS] = useState<MatcherSettings>(MATCHER_DEFAULTS);
  useEffect(() => {
    const sync = () => setS(loadMatcherSettings());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return [s, (patch) => saveMatcherSettings({ ...loadMatcherSettings(), ...patch })];
}
