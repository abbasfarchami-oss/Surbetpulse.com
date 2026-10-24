import { describe, expect, it } from "vitest";
import {
  BIG_ODDS_CAP,
  createBigOddsStore,
  formatReturnPct,
  recordBigOdds,
  sortBigOdds,
  utcDayKey,
} from "@/lib/bigodds-core";
import type { Opportunity } from "@/lib/arb";

const opp = (event: string, market: string, label: string, bookmaker: string, odds: number): Opportunity => ({
  id: Math.random().toString(36).slice(2),
  type: "value",
  sport: "Football",
  league: "Test League",
  event,
  market,
  startsAt: new Date().toISOString(),
  outcomes: [
    { label, bookmaker, odds },
    { label: "Other", bookmaker: "OtherBook", odds: 1.5 },
  ],
  source: "api",
  updatedAt: Date.now(),
});

// UTC day boundary: 2026-10-23 23:59:59 UTC is still Oct 23,
// 00:00:00 UTC is Oct 24.
const BEFORE_MIDNIGHT = Date.parse("2026-10-23T23:59:59Z");
const AFTER_MIDNIGHT = Date.parse("2026-10-24T00:00:00Z");

describe("big odds aggregation", () => {
  it("tracks peak odds while current odds move", () => {
    const s = createBigOddsStore();
    recordBigOdds(s, [opp("A – B", "Total", "Over 2.5", "1xBet", 2.4)], BEFORE_MIDNIGHT - 60000);
    recordBigOdds(s, [opp("A – B", "Total", "Over 2.5", "1xBet", 2.1)], BEFORE_MIDNIGHT);
    const [e] = sortBigOdds(s.entries.values());
    expect(e!.odds).toBe(2.1);
    expect(e!.peakOdds).toBe(2.4);
    expect(e!.foundAt).toBe(BEFORE_MIDNIGHT - 60000);
    expect(e!.updatedAt).toBe(BEFORE_MIDNIGHT);
  });

  it("resets at midnight UTC", () => {
    const s = createBigOddsStore();
    recordBigOdds(s, [opp("A – B", "Total", "Over 2.5", "1xBet", 2.4)], BEFORE_MIDNIGHT);
    expect(utcDayKey(BEFORE_MIDNIGHT)).toBe("2026-10-23");
    expect(utcDayKey(AFTER_MIDNIGHT)).toBe("2026-10-24");
    recordBigOdds(s, [opp("C – D", "Winner", "1", "SBOBet", 3.1)], AFTER_MIDNIGHT);
    const entries = sortBigOdds(s.entries.values());
    expect(entries).toHaveLength(2); // new opp has 2 outcomes; yesterday's rows are gone
    expect(entries.every((e) => e.match === "C – D")).toBe(true);
    expect(entries[0]!.foundAt).toBe(AFTER_MIDNIGHT);
  });

  it("keeps only the top N by odds", () => {
    const s = createBigOddsStore();
    const batch: Opportunity[] = [];
    for (let i = 0; i < BIG_ODDS_CAP + 50; i++) {
      batch.push(opp(`Match ${i}`, "Winner", "1", "1xBet", 1.5 + i * 0.01));
    }
    recordBigOdds(s, batch, BEFORE_MIDNIGHT);
    expect(s.entries.size).toBe(BIG_ODDS_CAP * 2 > batch.length * 2 ? BIG_ODDS_CAP : BIG_ODDS_CAP);
    // 2 outcomes per opp -> cap applies to the ranking; lowest odds dropped.
    const entries = sortBigOdds(s.entries.values());
    expect(entries.length).toBe(BIG_ODDS_CAP);
    const minKept = Math.min(...entries.map((e) => e.odds));
    expect(minKept).toBeGreaterThan(1.5);
  });

  it("ranks by odds desc, ties by earlier foundAt", () => {
    const s = createBigOddsStore();
    recordBigOdds(s, [opp("Late – Tie", "Winner", "1", "1xBet", 5)], BEFORE_MIDNIGHT - 1000);
    recordBigOdds(s, [opp("Early – Tie", "Winner", "1", "SBOBet", 5)], BEFORE_MIDNIGHT - 5000);
    recordBigOdds(s, [opp("Best – One", "Winner", "1", "Pinnacle", 6)], BEFORE_MIDNIGHT - 60000);
    const entries = sortBigOdds(s.entries.values());
    expect(entries[0]!.match).toBe("Best – One");
    expect(entries[1]!.match).toBe("Early – Tie");
    expect(entries[2]!.match).toBe("Late – Tie");
  });

  it("matches keys case-insensitively across books and labels", () => {
    const s = createBigOddsStore();
    recordBigOdds(s, [opp("A – B", "Total", "Over 2.5", "1xBet", 2.4)], BEFORE_MIDNIGHT - 1000);
    recordBigOdds(s, [opp("a – b", "total", "over 2.5", "1XBET", 2.6)], BEFORE_MIDNIGHT);
    const entries = sortBigOdds(s.entries.values());
    expect(entries.filter((e) => e.bookmaker.toLowerCase() === "1xbet")).toHaveLength(1);
    expect(entries.find((e) => e.bookmaker.toLowerCase() === "1xbet")!.peakOdds).toBe(2.6);
  });

  it("formats return % with Latin digits", () => {
    expect(formatReturnPct(1.5)).toBe("50%");
    expect(formatReturnPct(1.505)).toBe("50.5%");
    expect(formatReturnPct(2)).toBe("100%");
  });
});
