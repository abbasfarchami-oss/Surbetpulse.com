import { expect, test } from "vitest";
import { monthlyTotal } from "./bookpricing";
const p = { base: 20, included: ["Pinnacle"], prices: { Melbet: 2, Betway: 4, Pinnacle: 3 } };
test("base only", () => expect(monthlyTotal(p, [])).toBe(20));
test("adds per-site price", () => expect(monthlyTotal(p, ["Melbet", "Betway"])).toBe(26));
test("included sites are free", () => expect(monthlyTotal(p, ["Pinnacle"])).toBe(20));
import { DEFAULT_PRICING as D } from "./bookpricing";
test("default tiers", () => {
  expect(D.included).toEqual(["1xBet", "Pinnacle", "Bet365"]);
  expect([D.prices["William Hill"], D.prices["Unibet"], D.prices["SBOBet"]]).toEqual([4, 4, 4]);
  expect([D.prices["Marathonbet"], D.prices["Betway"], D.prices["bwin"]]).toEqual([3, 3, 3]);
  expect([D.prices["Melbet"], D.prices["BetForward"]]).toEqual([2, 2]);
});
