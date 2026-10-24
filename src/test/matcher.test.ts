import { describe, expect, it } from "vitest";
import {
  MATCHER_BOOK_A, MATCHER_BOOK_B, MATCHER_DEFAULTS, MATCHER_DELAY_MAX, MATCHER_DELAY_MIN,
  alertMessage, canonicalBook, clampDelay, exceedsThreshold, isSurebetPair,
  matchPairs, normalizeName, shouldAlert,
} from "@/lib/matcher";
import type { Opportunity } from "@/lib/arb";

const opp = (id: string, event: string, market: string, outcomes: { label: string; bookmaker: string; odds: number }[], updatedAt = 1000): Opportunity => ({
  id, type: "surebet", sport: "Football", league: "Test League", event, market,
  startsAt: new Date(0).toISOString(), outcomes, source: "api", updatedAt,
});

describe("name normalization", () => {
  it("lowercases, strips punctuation and collapses spaces", () => {
    expect(normalizeName("Arsenal  –  Chelsea!")).toBe("arsenal chelsea");
    expect(normalizeName("  Real   Madrid ")).toBe("real madrid");
  });
});

describe("canonical bookmaker matching", () => {
  it("accepts exact canonical names case-insensitively and aliases", () => {
    expect(canonicalBook("SBOBet")).toBe("SBOBet");
    expect(canonicalBook("sbobet")).toBe("SBOBet");
    expect(canonicalBook("SBOBET")).toBe("SBOBet");
    expect(canonicalBook("1xBet")).toBe("1xBet");
    expect(canonicalBook("1xbet")).toBe("1xBet");
    expect(canonicalBook("1XBET")).toBe("1xBet");
  });
  it("rejects other bookmakers", () => {
    expect(canonicalBook("Melbet")).toBeUndefined();
    expect(canonicalBook("Pinnacle")).toBeUndefined();
  });
  it("canonical constants are exactly SBOBet and 1xBet", () => {
    expect(MATCHER_BOOK_A).toBe("SBOBet");
    expect(MATCHER_BOOK_B).toBe("1xBet");
  });
});

describe("matchPairs", () => {
  it("pairs SBOBet and 1xBet quotes with the same event + market + label", () => {
    const feed = [
      opp("a", "Arsenal – Chelsea", "1X2", [{ label: "1", bookmaker: "SBOBet", odds: 2.1 }]),
      opp("b", "arsenal chelsea", "1X2", [{ label: "1", bookmaker: "1xbet", odds: 2.0 }], 2000),
    ];
    const pairs = matchPairs(feed);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.a.odds).toBe(2.1);
    expect(pairs[0]!.b.odds).toBe(2.0);
    expect(pairs[0]!.diffAbs).toBeCloseTo(0.1);
  });

  it("pairs within a single opportunity too", () => {
    const feed = [opp("a", "X vs Y", "Winner", [
      { label: "1", bookmaker: "SBOBet", odds: 1.95 },
      { label: "1", bookmaker: "1xBet", odds: 2.05 },
      { label: "2", bookmaker: "SBOBet", odds: 1.9 },
    ])];
    const pairs = matchPairs(feed);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.label).toBe("1");
  });

  it("ignores pairs without both books and other bookmakers", () => {
    const feed = [
      opp("a", "A – B", "1X2", [{ label: "1", bookmaker: "SBOBet", odds: 2.0 }]),
      opp("b", "A – B", "1X2", [{ label: "1", bookmaker: "Melbet", odds: 2.1 }]),
      opp("c", "C – D", "1X2", [{ label: "2", bookmaker: "1xBet", odds: 1.9 }]),
    ];
    expect(matchPairs(feed)).toHaveLength(0);
  });
});

describe("surebet and threshold", () => {
  it("detects a 2-way surebet between the two quotes", () => {
    expect(isSurebetPair(2.1, 2.1)).toBe(true);
    expect(isSurebetPair(1.9, 1.9)).toBe(false);
  });

  it("applies absolute and percent thresholds", () => {
    const [p] = matchPairs([opp("a", "A – B", "1X2", [
      { label: "1", bookmaker: "SBOBet", odds: 2.10 },
      { label: "1", bookmaker: "1xBet", odds: 2.00 },
    ])]);
    expect(exceedsThreshold(p!, 0.05, "abs")).toBe(true);
    expect(exceedsThreshold(p!, 0.2, "abs")).toBe(false);
    expect(exceedsThreshold(p!, 4, "pct")).toBe(true); // 5%
    expect(exceedsThreshold(p!, 6, "pct")).toBe(false);
  });
});

describe("alert debounce and message", () => {
  it("fires at most once per pair per 60 seconds", () => {
    const last = new Map<string, number>();
    expect(shouldAlert(last, "k", 0)).toBe(true);
    expect(shouldAlert(last, "k", 30_000)).toBe(false);
    expect(shouldAlert(last, "k", 60_000)).toBe(true);
    expect(shouldAlert(last, "other", 61_000)).toBe(true);
  });

  it("names the match, both odds and the difference in English", () => {
    const [p] = matchPairs([opp("a", "Arsenal – Chelsea", "1X2", [
      { label: "1", bookmaker: "SBOBet", odds: 2.10 },
      { label: "1", bookmaker: "1xBet", odds: 2.00 },
    ])]);
    const msg = alertMessage(p!);
    expect(msg).toContain("Arsenal – Chelsea");
    expect(msg).toContain("SBOBet 2.10");
    expect(msg).toContain("1xBet 2.00");
    expect(msg).toContain("difference 0.10");
  });
});

describe("settings defaults", () => {
  it("defaults to 5s delay, 0.05 absolute threshold", () => {
    expect(MATCHER_DEFAULTS).toEqual({ delaySec: 5, threshold: 0.05, mode: "abs" });
  });
  it("clamps delay to 1..60 seconds", () => {
    expect(clampDelay(0)).toBe(MATCHER_DELAY_MIN);
    expect(clampDelay(120)).toBe(MATCHER_DELAY_MAX);
    expect(clampDelay(7)).toBe(7);
    expect(clampDelay(Number.NaN)).toBe(5);
  });
});
