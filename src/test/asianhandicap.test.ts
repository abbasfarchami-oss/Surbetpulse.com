import { describe, expect, it } from "vitest";
import {
  ahMarketName, ahPairKey, ahSide, groupMatchedPairs, isAsianHandicapMarket, parseAhLine, parseLineToken,
} from "@/lib/asianhandicap";
import { matchPairs, type MatchedPair } from "@/lib/matcher";
import type { Opportunity } from "@/lib/arb";

const opp = (id: string, event: string, market: string, outcomes: { label: string; bookmaker: string; odds: number }[], updatedAt = 1000): Opportunity => ({
  id, type: "surebet", sport: "Football", league: "Test League", event, market,
  startsAt: new Date(0).toISOString(), outcomes, source: "api", updatedAt,
});

describe("line normalization", () => {
  it("parses plain signed lines", () => {
    expect(parseAhLine("Asian Handicap -0.25")).toBe(-0.25);
    expect(parseAhLine("Asian Handicap +1.25")).toBe(1.25);
    expect(parseAhLine("Asian Handicap -0.75")).toBe(-0.75);
    expect(parseAhLine("Asian Handicap 2")).toBe(2);
  });
  it("parses the AH prefix and comma decimals", () => {
    expect(parseAhLine("AH -0.25")).toBe(-0.25);
    expect(parseAhLine("Handicap -0,25")).toBe(-0.25);
  });
  it("averages split/quarter tokens like 0/-0.5", () => {
    expect(parseLineToken("0/-0.5")).toBe(-0.25);
    expect(parseLineToken("-0.5/-1")).toBe(-0.75);
    expect(parseAhLine("Asian Handicap 0/-0.5")).toBe(-0.25);
  });
  it("reads the point from the outcome label for SBOBET-style 'Handicap' markets", () => {
    expect(parseAhLine("Handicap", "Home -0.25")).toBe(-0.25);
    expect(parseAhLine("Handicap", "Away +1.25")).toBe(1.25);
  });
  it("returns null for non-handicap markets", () => {
    expect(parseAhLine("1X2")).toBeNull();
    expect(parseAhLine("Total Over 2.5")).toBeNull();
    expect(isAsianHandicapMarket("1X2")).toBe(false);
    expect(isAsianHandicapMarket("Asian Handicap -0.25")).toBe(true);
  });
  it("detects the side from the label", () => {
    expect(ahSide("Home")).toBe("home");
    expect(ahSide("Away +0.25")).toBe("away");
    expect(ahSide("1")).toBe("home");
    expect(ahSide("2")).toBe("away");
  });
  it("formats canonical market names", () => {
    expect(ahMarketName(-0.25)).toBe("Asian Handicap -0.25");
    expect(ahMarketName(1.25)).toBe("Asian Handicap +1.25");
  });
});

describe("pairing by event + line + side", () => {
  it("pairs the same line and side across different market spellings", () => {
    const feed = [
      opp("a", "Arsenal – Chelsea", "Asian Handicap -0.25", [{ label: "Home", bookmaker: "SBOBet", odds: 1.95 }]),
      opp("b", "Arsenal – Chelsea", "AH -0,25", [{ label: "Home", bookmaker: "1xBet", odds: 2.05 }]),
    ];
    const pairs = matchPairs(feed);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.line).toBe(-0.25);
    expect(pairs[0]!.market).toBe("Asian Handicap -0.25");
    expect(pairs[0]!.diffAbs).toBeCloseTo(0.1, 5);
  });
  it("keeps opposite-sign away lines consistent: away +0.25 pairs with away +0.25, not with home -0.25", () => {
    const feed = [
      opp("a", "Arsenal – Chelsea", "Asian Handicap -0.25", [{ label: "Home", bookmaker: "SBOBet", odds: 1.95 }]),
      opp("b", "Arsenal – Chelsea", "Asian Handicap +0.25", [{ label: "Away", bookmaker: "1xBet", odds: 1.95 }]),
    ];
    expect(matchPairs(feed)).toHaveLength(0); // different sides -> no pair
    const feed2 = [
      opp("a", "Arsenal – Chelsea", "Asian Handicap +0.25", [{ label: "Away", bookmaker: "SBOBet", odds: 1.9 }]),
      opp("b", "Arsenal – Chelsea", "Handicap", [{ label: "Away +0.25", bookmaker: "1xBet", odds: 2.0 }]),
    ];
    const pairs = matchPairs(feed2);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.line).toBe(0.25);
  });
  it("does not pair different lines of the same event", () => {
    const feed = [
      opp("a", "Arsenal – Chelsea", "Asian Handicap -0.25", [{ label: "Home", bookmaker: "SBOBet", odds: 1.95 }]),
      opp("b", "Arsenal – Chelsea", "Asian Handicap -0.75", [{ label: "Home", bookmaker: "1xBet", odds: 2.05 }]),
    ];
    expect(matchPairs(feed)).toHaveLength(0);
  });
  it("shows all lines: multiple lines of one event all produce pairs", () => {
    const feed = [
      opp("a", "Arsenal – Chelsea", "Asian Handicap -0.25", [{ label: "Home", bookmaker: "SBOBet", odds: 1.95 }]),
      opp("b", "Arsenal – Chelsea", "Asian Handicap -0.25", [{ label: "Home", bookmaker: "1xBet", odds: 2.05 }]),
      opp("c", "Arsenal – Chelsea", "Asian Handicap -0.75", [{ label: "Home", bookmaker: "SBOBet", odds: 2.2 }]),
      opp("d", "Arsenal – Chelsea", "Asian Handicap -0.75", [{ label: "Home", bookmaker: "1xBet", odds: 2.3 }]),
    ];
    const pairs = matchPairs(feed);
    expect(pairs).toHaveLength(2);
    expect(pairs.map((p) => p.line).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([-0.75, -0.25]);
  });
  it("pair key uses absolute line plus side", () => {
    expect(ahPairKey("Asian Handicap -0.25", "Home")).toBe("ah|0.25|home");
    expect(ahPairKey("Asian Handicap +0.25", "Away")).toBe("ah|0.25|away");
  });
});

describe("grouping by event then line", () => {
  const pair = (event: string, line: number, updatedAt: number): MatchedPair => ({
    key: `${event}|${line}`, event, market: ahMarketName(line), label: "Home", sport: "Football", league: "L",
    live: false, line, side: "home",
    a: { label: "Home", bookmaker: "SBOBet", odds: 1.9 }, b: { label: "Home", bookmaker: "1xBet", odds: 2 },
    diffAbs: 0.1, diffPct: 5, surebet: false, updatedAt,
  });
  it("groups pairs under their event and line", () => {
    const groups = groupMatchedPairs([pair("A – B", -0.25, 100), pair("A – B", -0.75, 200), pair("C – D", 0, 300)]);
    expect(groups.map((g) => g.event)).toEqual(["C – D", "A – B"]); // latest event first
    const ab = groups[1]!;
    expect(ab.lines.map((l) => l.line)).toEqual(["Asian Handicap -0.75", "Asian Handicap -0.25"]); // latest line first
    expect(ab.lines[0]!.pairs).toHaveLength(1);
  });
  it("non-AH pairs group under their market name", () => {
    const p = { ...pair("X – Y", 0, 100), line: undefined, market: "1X2" };
    const groups = groupMatchedPairs([p]);
    expect(groups[0]!.lines[0]!.line).toBe("1X2");
  });
});
