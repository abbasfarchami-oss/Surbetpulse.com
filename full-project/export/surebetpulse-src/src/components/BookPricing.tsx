import { useEffect, useState } from "react";
import { BOOKMAKERS } from "@/lib/arb";
import { DEFAULT_PRICING, monthlyTotal, savePricing, saveSelection, useBookPricing } from "@/lib/bookpricing";
import { TiltCard } from "@/components/TiltCard";
import { NumField } from "@/components/NumField";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BookPlanBuilder() {
  const { t } = useI18n();
  const { pricing, selected } = useBookPricing();
  const toggle = (b: string) => saveSelection(selected.includes(b) ? selected.filter((x) => x !== b) : [...selected, b]);
  const extras = BOOKMAKERS.filter((b) => !pricing.included.includes(b));
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t.bmTitle}</h2>
      <div className="mt-3 flex items-baseline justify-between"><span>{t.bmBase}</span><span className="num font-bold">${pricing.base}</span></div>
      <p className="mt-2 text-sm text-muted-foreground">{t.bmIncluded}: {pricing.included.join(", ")}</p>
      <h3 className="mt-4 text-sm font-semibold">{t.bmExtras}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {extras.map((b, i) => (
          <TiltCard key={b} max={14} delay={(i % 6) * 300} className="rounded-lg">
          <label className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${selected.includes(b) ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="checkbox" checked={selected.includes(b)} onChange={() => toggle(b)} className="accent-primary" />
            <span className="flex-1">{b}</span><span className="num text-muted-foreground">+${pricing.prices[b] ?? 0}</span>
          </label>
          </TiltCard>
        ))}
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
        <span className="font-semibold">{t.bmTotal}</span>
        <span className="num text-3xl font-extrabold">${monthlyTotal(pricing, selected).toFixed(2)}</span>
      </div>
    </section>
  );
}

export function BookPricingAdmin() {
  const { t } = useI18n();
  const { pricing } = useBookPricing();
  const [d, setD] = useState(pricing);
  useEffect(() => setD(pricing), [pricing]);
  const inp = "num w-20 rounded-lg border border-input bg-secondary px-2 py-1 text-sm";
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{t.bmAdmin}</h2>
      <label className="mt-3 flex items-center gap-2 text-sm">{t.bmBasePrice}
        <NumField className={inp} value={d.base} onChange={(n) => setD({ ...d, base: Math.max(0, n ?? 0) })} />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {BOOKMAKERS.map((b) => (
          <div key={b} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
            <span className="flex-1">{b}</span>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-primary" checked={d.included.includes(b)}
              onChange={(e) => setD({ ...d, included: e.target.checked ? [...d.included, b] : d.included.filter((x) => x !== b) })} />{t.bmDefault}</label>
            <NumField ariaLabel={`${b} ${t.bmSitePrice}`} className={inp} value={d.prices[b] ?? 0}
              onChange={(n) => setD({ ...d, prices: { ...d.prices, [b]: Math.max(0, n ?? 0) } })} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-3">
        <Button onClick={() => void savePricing(d).catch(() => toast.error(t.authSaveFailed))} className="rounded-lg px-5 py-2 font-semibold">{t.save}</Button>
        <Button variant="outline" onClick={() => void savePricing(DEFAULT_PRICING).catch(() => toast.error(t.authSaveFailed))} className="rounded-lg px-4 py-2">{t.reset}</Button>
      </div>
    </section>
  );
}
