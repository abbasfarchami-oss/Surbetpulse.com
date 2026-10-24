import { describe, expect, it } from "vitest";
import { ADMIN_ACCESS, FREE_ACCESS, allowsOpportunity, assertAdminRole, subscriptionAccess } from "@/lib/access";
import { DEFAULT_PLANS } from "@/lib/plans";
import type { Opportunity } from "@/lib/arb";

const row: Opportunity = { id: "access", type: "surebet", sport: "Football", league: "Vietnam U23", event: "A — B", market: "Total 2.5", live: true, startsAt: "2026-10-24T10:00:00Z", updatedAt: 0, source: "collector", outcomes: [{ label: "Over", bookmaker: "1xBet", odds: 3 }, { label: "Under", bookmaker: "SBOBet", odds: 3 }] };
describe("server-owned access", () => {
  it("admin has free unlimited access even without a subscription", () => {
    const current = subscriptionAccess(true, null);
    expect(current.price).toBe(0);
    expect(current.maxProfit).toBeNull();
    expect([current.live, current.prematch, current.api, current.dropping]).toEqual([true, true, true, true]);
    expect(allowsOpportunity(current, row)).toBe(true);
  });
  it("rejects non-admin authorization", () => {
    expect(() => assertAdminRole(false)).toThrow("Forbidden");
    expect(() => assertAdminRole(true)).not.toThrow();
  });
  it("a plan without a server active subscription grants no paid access", () => {
    expect(subscriptionAccess(false, DEFAULT_PLANS[1] ?? null)).toEqual(FREE_ACCESS);
  });
  it("inactive and expired subscriptions grant only Free", () => {
    expect(subscriptionAccess(false, DEFAULT_PLANS[1] ?? null, "inactive")).toEqual(FREE_ACCESS);
    expect(subscriptionAccess(false, DEFAULT_PLANS[1] ?? null, "active", "2026-10-23T00:00:00Z", Date.parse("2026-10-24T00:00:00Z"))).toEqual(FREE_ACCESS);
  });
  it("a trusted active subscription grants its stored plan", () => {
    expect(subscriptionAccess(false, DEFAULT_PLANS[1] ?? null, "active").id).toBe("p2");
  });
  it("Free cannot fetch live or over-1-percent rows", () => {
    expect(allowsOpportunity(FREE_ACCESS, row)).toBe(false);
    expect(allowsOpportunity(FREE_ACCESS, { ...row, live: false })).toBe(false);
    expect(allowsOpportunity(ADMIN_ACCESS, row)).toBe(true);
  });
});