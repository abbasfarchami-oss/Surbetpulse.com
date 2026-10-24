import { describe, expect, it } from "vitest";
import {
  DEFAULT_ERROR_THRESHOLD, HIGH_EDGE_THRESHOLD, familyOf, isErrorRow,
  isHighEdge, isSameFamilyArb,
} from "@/lib/filters";
import type { Opportunity } from "@/lib/arb";

const opp = (outcomes: { label: string; bookmaker: string; odds: number }[]): Opportunity => ({
  id: "t1", type: "surebet", sport: "Football", league: "Test League", event: "Alpha – Beta", market: "1X2",
  startsAt: new Date(0).toISOString(), outcomes, source: "api", updatedAt: 1000,
});

// 2-way odds 10/10 -> 400% profit; 5/5 -> 150%; 2.5/2.5 -> 25%
const huge = opp([{ label: "1", bookmaker: "1xBet", odds: 10 }, { label: "2", bookmaker: "Pinnacle", odds: 10 }]);
const mid = opp([{ label: "1", bookmaker: "1xBet", odds: 5 }, { label: "2", bookmaker: "Pinnacle", odds: 5 }]);
const low = opp([{ label: "1", bookmaker: "1xBet", odds: 2.5 }, { label: "2", bookmaker: "Pinnacle", odds: 2.5 }]);

describe("error threshold rule", () => {
  it("default threshold is exactly 200", () => {
    expect(DEFAULT_ERROR_THRESHOLD).toBe(200);
  });
  it("arbs above 200% are treated as data errors and discarded", () => {
    expect(isErrorRow(huge)).toBe(true); // 400% > 200
  });
  it("arbs at 150% are kept and shown normally", () => {
    expect(isErrorRow(mid)).toBe(false); // 150% <= 200
    expect(isSameFamilyArb(mid)).toBe(false); // mixed families -> stays in the list
  });
  it("threshold is editable: a lower threshold discards 150% too", () => {
    expect(isErrorRow(mid, 100)).toBe(true); // 150% > 100
    expect(isErrorRow(mid, 200)).toBe(false);
    expect(isErrorRow(huge, 500)).toBe(false); // raising the threshold keeps 400%
  });
  it("boundary: exactly at the threshold is kept (only ABOVE is an error)", () => {
    const exact = opp([{ label: "1", bookmaker: "1xBet", odds: 6 }, { label: "2", bookmaker: "Pinnacle", odds: 6 }]); // 200.0%? margin=1/3 -> 200%
    expect(isErrorRow(exact, 200)).toBe(false);
  });
});

describe("high edge tag (>20%)", () => {
  it("tags arbs above 20% but never hides them", () => {
    expect(isHighEdge(low)).toBe(true); // 25% > 20
    expect(isErrorRow(low)).toBe(false); // still shown
  });
  it("does not tag arbs at or below 20%", () => {
    const flat = opp([{ label: "1", bookmaker: "1xBet", odds: 2.4 }, { label: "2", bookmaker: "Pinnacle", odds: 2.4 }]); // 20%
    expect(isHighEdge(flat)).toBe(false);
  });
  it("threshold constant is exactly 20", () => {
    expect(HIGH_EDGE_THRESHOLD).toBe(20);
  });
});

describe("same-family rule", () => {
  it("rejects surebets whose legs are all from the 1xBet family", () => {
    const clones = opp([{ label: "1", bookmaker: "1xBet", odds: 2.5 }, { label: "2", bookmaker: "Linebet", odds: 2.5 }]);
    expect(isSameFamilyArb(clones)).toBe(true);
  });
  it("matches bookmaker names case-insensitively", () => {
    const clones = opp([{ label: "1", bookmaker: "1xbet", odds: 2.5 }, { label: "2", bookmaker: "helabet", odds: 2.5 }]);
    expect(isSameFamilyArb(clones)).toBe(true);
  });
  it("keeps mixed-family surebets", () => {
    expect(isSameFamilyArb(opp([{ label: "1", bookmaker: "1xBet", odds: 2.5 }, { label: "2", bookmaker: "Pinnacle", odds: 2.5 }]))).toBe(false);
  });
  it("treats unknown bookmakers as their own family", () => {
    expect(familyOf("MysteryBook")).toBe("MysteryBook");
    expect(isSameFamilyArb(opp([{ label: "1", bookmaker: "MysteryBook", odds: 2.5 }, { label: "2", bookmaker: "1xBet", odds: 2.5 }]))).toBe(false);
    expect(isSameFamilyArb(opp([{ label: "1", bookmaker: "MysteryBook", odds: 2.5 }, { label: "2", bookmaker: "mysterybook", odds: 2.5 }]))).toBe(true);
  });
});
