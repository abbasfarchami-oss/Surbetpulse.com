import { describe, expect, it } from "vitest";
import { bookName, buildOpportunities, sportLabel, type FeedEvent } from "./oddsfeed-core";

const in1h = new Date(Date.now() + 3_600_000).toISOString();

const book = (key: string, title: string, market: string, outcomes: { name: string; price: number; point?: number }[]) => ({
  key, title, markets: [{ key: market, outcomes }],
});

const event = (bookmakers: FeedEvent["bookmakers"], over: Partial<FeedEvent> = {}): FeedEvent => ({
  id: "e1", sport_key: "soccer_epl", sport_title: "Premier League", commence_time: in1h,
  home_team: "Arsenal", away_team: "Chelsea", bookmakers, ...over,
});

describe("odds feed mapping", () => {
  it("publishes a 3-way surebet from the best cross-book prices", () => {
    const ev = event([
      book("pinnacle", "Pinnacle", "h2h", [{ name: "Arsenal", price: 2.1 }, { name: "Draw", price: 3.4 }, { name: "Chelsea", price: 3.6 }]),
      book("williamhill", "William Hill", "h2h", [{ name: "Arsenal", price: 2.2 }, { name: "Draw", price: 3.6 }, { name: "Chelsea", price: 4 }]),
    ]);
    const opps = buildOpportunities(ev, new Map());
    expect(opps).toHaveLength(1);
    const o = opps[0]!;
    expect(o.type).toBe("surebet");
    expect(o.sport).toBe("Football");
    expect(o.market).toBe("1X2");
    expect(o.outcomes).toHaveLength(3);
    expect(o.outcomes.map((x) => x.odds)).toEqual([2.2, 3.6, 4]);
    expect(o.outcomes.some((x) => x.bookmaker === "William Hill")).toBe(true);
    expect(o.source).toBe("api");
    expect(o.live).toBe(false);
  });

  it("marks a price that fell against the previous snapshot as a dropping odd", () => {
    const mk = () => event([
      book("1xbet", "1xBet", "h2h", [{ name: "Arsenal", price: 2.2 }, { name: "Chelsea", price: 4 }]),
      book("pinnacle", "Pinnacle", "h2h", [{ name: "Arsenal", price: 2.2 }, { name: "Chelsea", price: 4 }]),
    ]);
    const prev = new Map<string, number>();
    buildOpportunities(mk(), prev);
    const dropped = event([
      book("1xbet", "1xBet", "h2h", [{ name: "Arsenal", price: 2.05 }, { name: "Chelsea", price: 4 }]),
      book("pinnacle", "Pinnacle", "h2h", [{ name: "Arsenal", price: 2.05 }, { name: "Chelsea", price: 4 }]),
    ]);
    const opps = buildOpportunities(dropped, prev);
    expect(opps).toHaveLength(1);
    const arsenal = opps[0]!.outcomes.find((x) => x.label === "Arsenal");
    expect(arsenal?.odds).toBe(2.05);
    expect(arsenal?.prevOdds).toBe(2.2);
  });

  it("publishes a 2-way value bet when a price beats the vig-free consensus", () => {
    const ev = event([
      book("1xbet", "1xBet", "h2h", [{ name: "Over", price: 2.3 }, { name: "Under", price: 1.6 }]),
      book("pinnacle", "Pinnacle", "h2h", [{ name: "Over", price: 1.8 }, { name: "Under", price: 1.7 }]),
      book("betway", "Betway", "h2h", [{ name: "Over", price: 1.82 }, { name: "Under", price: 1.68 }]),
    ]);
    const opps = buildOpportunities(ev, new Map());
    expect(opps).toHaveLength(1);
    expect(opps[0]!.type).toBe("value");
    expect(opps[0]!.market).toBe("Winner");
  });

  it("keeps the line in the label for totals markets", () => {
    const ev = event([
      book("pinnacle", "Pinnacle", "totals", [{ name: "Over", price: 2.1, point: 2.5 }, { name: "Under", price: 1.9, point: 2.5 }]),
      book("bet365", "Bet365", "totals", [{ name: "Over", price: 1.95, point: 2.5 }, { name: "Under", price: 2.05, point: 2.5 }]),
    ]);
    const opps = buildOpportunities(ev, new Map());
    expect(opps).toHaveLength(1);
    expect(opps[0]!.market).toBe("Total");
    expect(opps[0]!.outcomes.map((x) => x.label)).toEqual(["Over 2.5", "Under 2.5"]);
  });

  it("ignores sports without a dashboard tab and markets that are not 2 or 3 way", () => {
    const ev = event([
      book("pinnacle", "Pinnacle", "outrights", [
        { name: "Arsenal", price: 2 }, { name: "Chelsea", price: 3 }, { name: "Draw", price: 4 }, { name: "Other", price: 5 },
      ]),
    ], { sport_key: "cricket_t20" });
    expect(buildOpportunities(ev, new Map())).toEqual([]);
    const fourWay = event([
      book("pinnacle", "Pinnacle", "outrights", [
        { name: "Arsenal", price: 2 }, { name: "Chelsea", price: 3 }, { name: "Draw", price: 4 }, { name: "Other", price: 5 },
      ]),
    ]);
    expect(buildOpportunities(fourWay, new Map())).toEqual([]);
  });

  it("flags a live event from its start time", () => {
    const ev = event([
      book("pinnacle", "Pinnacle", "h2h", [{ name: "Arsenal", price: 2.2 }, { name: "Chelsea", price: 4 }]),
    ], { commence_time: new Date(Date.now() - 600_000).toISOString() });
    expect(buildOpportunities(ev, new Map())[0]!.live).toBe(true);
  });

  it("normalizes bookmaker keys and sport keys", () => {
    expect(bookName("1xbet", "1xBet")).toBe("1xBet");
    expect(bookName("williamhill", "William Hill")).toBe("William Hill");
    expect(bookName("some_new_book", "Some New Book")).toBe("Some New Book");
    expect(sportLabel("soccer_epl")).toBe("Football");
    expect(sportLabel("icehockey_nhl")).toBe("Ice Hockey");
    expect(sportLabel("cricket_t20")).toBeNull();
  });
});
