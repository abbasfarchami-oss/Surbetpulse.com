import { describe, expect, it } from "vitest";
import { BOOKS, BOOKMAKERS, BOOK_DOMAINS, BOOK_GROUPS, REMOVED_BOOKS, bookBySlug, bookSlug } from "@/lib/arb";
import { DEFAULT_ALERT_BOOKS } from "@/lib/alerts";

describe("bookmaker data list", () => {
  it("has 31 bookmakers with unique slugs, all with a real logo", () => {
    expect(BOOKMAKERS).toHaveLength(31);
    expect(new Set(BOOKS.map((b) => b.slug)).size).toBe(31);
    for (const b of BOOKS) expect(b.logo, b.name).toBeTruthy();
  });

  it("no longer lists the 8 logo-less bookmakers", () => {
    expect(REMOVED_BOOKS).toEqual(["Betfair", "Betfair Exchange", "Betongame", "ShahBet", "YekBet", "BerryBet", "Pin-Up", "Vbet"]);
    for (const n of REMOVED_BOOKS) expect(BOOKMAKERS).not.toContain(n);
  });

  it("does not include Polymarket or SSPOBet", () => {
    expect(BOOKMAKERS).not.toContain("Polymarket");
    expect(BOOKMAKERS).not.toContain("SSPOBet");
  });

  it("keeps the sharp group exactly Pinnacle, SBOBet", () => {
    expect([...(BOOK_GROUPS["sharp"] ?? [])].sort()).toEqual(["Pinnacle", "SBOBet"]);
  });

  it("gives every bookmaker a domain, brand color and family", () => {
    for (const b of BOOKS) {
      expect(b.domain).toMatch(/\./);
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(b.family.length).toBeGreaterThan(0);
      expect(BOOK_DOMAINS[b.name]).toBe(b.domain);
    }
    expect(BOOK_DOMAINS["Pinnacle"]).toBe("pinnacle.com");
  });

  it("resolves slugs both ways", () => {
    expect(bookSlug("William Hill")).toBe("william-hill");
    expect(bookBySlug("pinnacle")).toBe("Pinnacle");
    expect(bookBySlug("vbet")).toBeUndefined();
  });

  it("defaults alert bookmakers to exactly 1xBet, SBOBet", () => {
    expect(DEFAULT_ALERT_BOOKS).toEqual(["1xBet", "SBOBet"]);
  });
});
