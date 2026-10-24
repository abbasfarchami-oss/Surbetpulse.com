import { describe, expect, it } from "vitest";
import { groupOpportunities, groupPairsByMatch, isOverUnderMarket } from "@/lib/grouping";
import type { Opportunity } from "@/lib/arb";
import type { MatchedPair } from "@/lib/matcher";

const opp = (id: string, event: string, market: string, odds: number[], updatedAt = 1000): Opportunity => ({
  id, type: "surebet", sport: "Football", league: "L", event, market,
  startsAt: new Date(0).toISOString(),
  outcomes: odds.map((v, i) => ({ label: String(i), bookmaker: i ? "Pinnacle" : "1xBet", odds: v })),
  source: "api", updatedAt,
});

const pair = (key: string, event: string, market: string, diffAbs: number, updatedAt = 1000): MatchedPair => ({
  key, event, league: "L", market, label: "Over", sport: "Football",
  a: { bookmaker: "SBOBet", odds: 2, label: "Over" },
  b: { bookmaker: "1xBet", odds: 2 + diffAbs, label: "Over" },
  diffAbs, diffPct: diffAbs * 50, surebet: false, live: false, updatedAt,
});

describe("isOverUnderMarket", () => {
  it("detects totals markets", () => {
    expect(isOverUnderMarket("Total 2.5")).toBe(true);
    expect(isOverUnderMarket("Over/Under 2.5")).toBe(true);
    expect(isOverUnderMarket("O/U 3")).toBe(true);
    expect(isOverUnderMarket("1X2")).toBe(false);
    expect(isOverUnderMarket("Asian Handicap -0.25")).toBe(false);
  });
});

describe("groupOpportunities", () => {
  it("groups all markets of one match into a single card", () => {
    const g = groupOpportunities([
      opp("a", "Arsenal – Chelsea", "Total 2.5", [2.1, 2.1]),
      opp("b", "Arsenal – Chelsea", "1X2", [2.5, 2.5, 3]),
      opp("c", "arsenal - chelsea", "Asian Handicap -0.25", [2.2, 2.2]), // normalized same event
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.others).toHaveLength(2);
  });
  it("picks the best OU line as primary", () => {
    const g = groupOpportunities([
      opp("a", "X – Y", "1X2", [3, 3, 3]),          // profit ~0
      opp("b", "X – Y", "Total 2.5", [2.5, 2.5]),   // profit 25%
      opp("c", "X – Y", "Total 3.5", [2.1, 2.1]),   // profit ~5%
    ]);
    expect(g[0]!.primary.id).toBe("b");
    expect(g[0]!.others.map((o) => o.id)).toEqual(["c", "a"]);
  });
  it("falls back to the best other market when a match has no OU", () => {
    const g = groupOpportunities([
      opp("a", "X – Y", "1X2", [3, 3, 4]),        // profit ~9.1%
      opp("b", "X – Y", "Asian Handicap -0.5", [2.1, 2.1]), // profit ~5%
    ]);
    expect(g[0]!.primary.id).toBe("a");
    expect(g[0]!.others.map((o) => o.id)).toEqual(["b"]);
  });
  it("keeps different matches in separate cards", () => {
    const g = groupOpportunities([opp("a", "A – B", "Total 2.5", [2.1, 2.1]), opp("c", "C – D", "Total 2.5", [2.1, 2.1])]);
    expect(g).toHaveLength(2);
  });
});

describe("groupPairsByMatch", () => {
  it("groups pairs per match with the best OU pair primary", () => {
    const g = groupPairsByMatch([
      pair("p1", "A – B", "1X2", 0.3),
      pair("p2", "A – B", "Total 2.5", 0.1),
      pair("p3", "A – B", "Total 3.5", 0.05),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.primary.key).toBe("p2");
    expect(g[0]!.others.map((p) => p.key)).toEqual(["p1", "p3"]);
  });
  it("uses the best non-OU pair when no OU exists", () => {
    const g = groupPairsByMatch([pair("p1", "A – B", "1X2", 0.2), pair("p2", "A – B", "Asian Handicap -0.25", 0.4)]);
    expect(g[0]!.primary.key).toBe("p2");
  });
});
