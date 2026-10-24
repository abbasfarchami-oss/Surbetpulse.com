import { describe, expect, it } from "vitest";
import { DEFAULT_REGIONAL_KEYWORDS, isRegionalMatch, sortRegionalFirst } from "@/lib/filters";
import type { Opportunity } from "@/lib/arb";

const opp = (id: string, league: string, event: string, updatedAt = 1000): Opportunity => ({
  id, type: "surebet", sport: "Football", league, event, market: "1X2",
  startsAt: new Date(0).toISOString(),
  outcomes: [{ label: "1", bookmaker: "1xBet", odds: 2.5 }, { label: "2", bookmaker: "Pinnacle", odds: 2.5 }],
  source: "api", updatedAt,
});

describe("regional keyword matching", () => {
  it("defaults to the 19 countries plus the 8 lower-division keywords", () => {
    expect(DEFAULT_REGIONAL_KEYWORDS).toEqual([
      "Bangladesh", "Vietnam", "Indonesia", "Thailand", "Malaysia", "India", "Myanmar", "Cambodia",
      "Singapore", "Hong Kong", "China", "Korea", "Japan", "Australia", "Russia", "Belarus",
      "Kazakhstan", "Uzbekistan", "Armenia",
      "U21", "U23", "Reserves", "II", "2nd Division", "Division 2", "Liga 2", "Youth",
    ]);
  });
  it("matches league names case-insensitively", () => {
    expect(isRegionalMatch(opp("a", "vietnam v-league", "X – Y"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
    expect(isRegionalMatch(opp("b", "BANGLADESH Premier League", "X – Y"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
  });
  it("matches team names", () => {
    expect(isRegionalMatch(opp("c", "Super League", "Persija U23 – Arema U23"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
    expect(isRegionalMatch(opp("d", "Premier League", "Arsenal Youth – Chelsea Youth"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
  });
  it("matches lower-division keywords", () => {
    expect(isRegionalMatch(opp("e", "Liga 2", "X – Y"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
    expect(isRegionalMatch(opp("f", "2nd Division", "X – Y"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
    expect(isRegionalMatch(opp("g", "Reserves League", "X – Y"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
  });
  it("short keyword 'II' matches whole words only", () => {
    expect(isRegionalMatch(opp("h", "Liga 1", "Persik Kediri II – PSIM II"), DEFAULT_REGIONAL_KEYWORDS)).toBe(true);
    expect(isRegionalMatch(opp("i", "Saudi Pro League", "Al Ittihad – Al Hilal"), DEFAULT_REGIONAL_KEYWORDS)).toBe(false);
  });
  it("does not match unrelated leagues", () => {
    expect(isRegionalMatch(opp("j", "La Liga", "Real Madrid – Barcelona"), DEFAULT_REGIONAL_KEYWORDS)).toBe(false);
  });
  it("edited keyword lists take effect", () => {
    expect(isRegionalMatch(opp("k", "Premier League", "X – Y"), ["England"])).toBe(false);
    expect(isRegionalMatch(opp("l", "England Premier League", "X – Y"), ["England"])).toBe(true);
  });
});

describe("sort priority", () => {
  it("regional matches sort to the top, then normal recency order", () => {
    const list = [
      opp("old-regional", "Vietnam V-League", "A – B", 100),
      opp("new-normal", "La Liga", "C – D", 500),
      opp("new-regional", "Liga 2", "E – F", 400),
      opp("old-normal", "Serie A", "G – H", 50),
    ];
    const sorted = sortRegionalFirst(list, DEFAULT_REGIONAL_KEYWORDS);
    expect(sorted.map((o) => o.id)).toEqual(["new-regional", "old-regional", "new-normal", "old-normal"]);
  });
  it("does not reorder within the same regional status", () => {
    const list = [opp("a", "La Liga", "A – B", 100), opp("b", "Serie A", "C – D", 300)];
    expect(sortRegionalFirst(list, DEFAULT_REGIONAL_KEYWORDS).map((o) => o.id)).toEqual(["b", "a"]);
  });
});
