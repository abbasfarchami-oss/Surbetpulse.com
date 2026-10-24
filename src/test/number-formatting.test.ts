import { describe, expect, it } from "vitest";
import { createNumberFormatters, LANGS, toLatinDigits } from "@/lib/i18n";

describe("scanner locale formatting", () => {
  it("formats counts and percentages using English by default", () => {
    const f = createNumberFormatters("en");
    expect(f.number(1234)).toBe("1,234");
    expect(f.percentage(12.34)).toBe("12.34%");
    expect(f.usd(1000)).toBe("$1,000.00");
  });
  it.each(LANGS.map(l => l.code))("always uses English/Latin digits for %s, even fa", lang => {
    const f = createNumberFormatters(lang);
    expect(f.number(1234)).toBe("1,234");
    expect(f.number(2.15, 2)).toBe("2.15");
    expect(f.percentage(12.34)).toBe("12.34%");
    expect(f.number(1234)).toMatch(/^[0-9,.-]+$/);
  });
  it.each(LANGS.map(l => l.code))("keeps USD across %s and handles zero and negative values", lang => {
    const f = createNumberFormatters(lang);
    expect(f.usd(25)).toContain("$");
    expect(f.percentage(0)).not.toContain("NaN");
    expect(f.percentage(-2)).not.toContain("NaN");
  });
});

describe("toLatinDigits", () => {
  it("converts Persian digits and the Persian decimal separator", () => {
    expect(toLatinDigits("۱٫۹۵")).toBe("1.95");
    expect(toLatinDigits("۱۲۳۴")).toBe("1234");
  });
  it("converts Arabic-Indic digits", () => {
    expect(toLatinDigits("٢٫٥")).toBe("2.5");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
  it("leaves Latin input untouched", () => {
    expect(toLatinDigits("1.95")).toBe("1.95");
  });
});
