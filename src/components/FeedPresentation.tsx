import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

export function OpportunitySkeletons() {
  const { t } = useI18n();
  return <div role="status" aria-label={t.loadingOpportunities}>
    <span className="sr-only">{t.loadingOpportunities}</span>
    <div aria-hidden="true" className="divide-y divide-border">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="bg-card even:bg-row-alternate p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="skeleton-wave h-11 w-24 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="skeleton-wave h-5 w-3/4" />
            <Skeleton className="skeleton-wave h-3 w-full max-w-64" />
          </div>
          <Skeleton className="skeleton-wave hidden h-8 w-20 sm:block" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Skeleton className="skeleton-wave h-16" />
          <Skeleton className="skeleton-wave h-16" />
        </div>
        <Skeleton className="skeleton-wave mt-3 h-1 w-full" />
      </div>)}
    </div>
  </div>;
}

/** This is the user's odds-age window, NOT a bookmaker's guaranteed closing time. */
export function freshnessWindow(updatedAt: number, now: number, maxAge: number) {
  const lifetime = Math.max(1, maxAge);
  const age = Math.max(0, (now - updatedAt) / 1000);
  const remaining = Math.max(0, lifetime - age);
  return { remaining, ratio: remaining / lifetime, lifetime };
}

export function OpportunityLifetime({ updatedAt, now, maxAge }: { updatedAt: number; now: number; maxAge: number }) {
  const { t, number } = useI18n();
  const { remaining, ratio, lifetime } = freshnessWindow(updatedAt, now, maxAge);
  const label = `${t.freshnessRemaining}: ${number(Math.ceil(remaining))}${t.sec}`;
  return <div className="mt-3 min-w-0" title={label}>
    <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-muted-foreground">
      <span>{t.freshnessRemaining}</span>
      <span className={`num ${ratio <= 0.2 ? "text-destructive" : ratio <= 0.5 ? "text-accent" : "text-primary"}`}>{number(Math.ceil(remaining))}{t.sec}</span>
    </div>
    <progress aria-label={t.freshnessRemaining} aria-valuetext={label} max={lifetime} value={remaining}
      className={`opportunity-lifetime block h-1 w-full overflow-hidden rounded-full ${ratio <= 0.2 ? "text-destructive" : ratio <= 0.5 ? "text-accent" : "text-primary"}`} />
  </div>;
}