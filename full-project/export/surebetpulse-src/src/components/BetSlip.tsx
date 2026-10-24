import { useState } from "react";
import { BOOK_DOMAINS, splitStakes, type Outcome } from "@/lib/arb";
import { BookName } from "@/components/BookLogo";
import { Button } from "@/components/ui/button";
import { NumField } from "@/components/NumField";
import { useI18n } from "@/lib/i18n";

/** Prepares stakes per leg for manual entry on each bookmaker. Places no bets. */
export function BetSlip({ outcomes }: { outcomes: Outcome[] }) {
  const { t, number, usd, percentage } = useI18n();
  const [total, setTotal] = useState(100);
  const r = splitStakes(outcomes.map((o) => o.odds), total, 1);
  return (
    <div className="mt-3 rounded-lg border border-dashed border-primary/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{t.betSlip}</span>
        <label className="ms-auto flex items-center gap-1">$<NumField ariaLabel={t.totalStake} value={total} onChange={(n) => setTotal(Math.max(1, n ?? 0))} className="num w-24 rounded border border-input bg-secondary px-2 py-1" /></label>
      </div>
      <div className="mt-2 space-y-1.5">
        {outcomes.map((o, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded bg-secondary px-2 py-1.5">
            <BookName name={o.bookmaker} /><span className="text-muted-foreground">{o.label} @ <span className="num">{number(o.odds, 2)}</span></span>
            <span className="num ms-auto font-semibold">{usd(r.stakes[i] ?? 0, 0)}</span>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText((r.stakes[i] ?? 0).toFixed(0))} className="h-7 px-2">{t.copy}</Button>
            {BOOK_DOMAINS[o.bookmaker] && <Button asChild size="sm" className="h-7 px-2"><a href={`https://${BOOK_DOMAINS[o.bookmaker]}`} target="_blank" rel="noreferrer">{t.openBook} ↗</a></Button>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{t.payout} ≥ <span className="num">{usd(r.payout)}</span></span><span>· {t.profit} <span className="num">{usd(r.profit)} ({percentage(r.pct)})</span></span></div>
    </div>
  );
}
