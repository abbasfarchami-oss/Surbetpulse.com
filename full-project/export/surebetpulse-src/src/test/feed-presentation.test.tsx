import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { freshnessWindow, OpportunityLifetime, OpportunitySkeletons } from "@/components/FeedPresentation";

describe("feed loading and freshness", () => {
  it("renders wave placeholders with an accessible loading state", () => {
    const { container } = render(<I18nProvider><OpportunitySkeletons /></I18nProvider>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading opportunities");
    expect(container.querySelectorAll(".skeleton-wave")).toHaveLength(28);
  });
  it("counts down against the chosen age limit and resets on fresh odds", () => {
    expect(freshnessWindow(1000, 31000, 60)).toEqual({ remaining: 30, ratio: 0.5, lifetime: 60 });
    expect(freshnessWindow(31000, 31000, 60).ratio).toBe(1);
    expect(freshnessWindow(1000, 61000, 60).remaining).toBe(0);
    expect(freshnessWindow(1000, 71000, 60).remaining).toBe(0);
    expect(freshnessWindow(32000, 31000, 60).ratio).toBe(1);
  });
  it("updates the visible countdown and urgency state", () => {
    const { rerender } = render(<I18nProvider><OpportunityLifetime updatedAt={1000} now={11000} maxAge={60} /></I18nProvider>);
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "50");
    rerender(<I18nProvider><OpportunityLifetime updatedAt={1000} now={51000} maxAge={60} /></I18nProvider>);
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "10");
    expect(screen.getByRole("progressbar")).toHaveClass("text-destructive");
  });
});