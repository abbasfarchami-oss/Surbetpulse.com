import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BookLogo } from "@/components/BookLogo";
import { Icon3D } from "@/components/Icon3D";
import { NumField } from "@/components/NumField";
import type { Opportunity } from "@/lib/arb";
import { getIngestedFeed } from "@/lib/feed.functions";
import { useI18n } from "@/lib/i18n";
import {
  MATCHER_BOOK_A, MATCHER_BOOK_B, MATCHER_DEFAULTS,
  clampDelay, exceedsThreshold, matchPairs, useMatcherSettings,
  type MatchedPair,
} from "@/lib/matcher";
import { groupPairsByMatch } from "@/lib/grouping";

const TOP_N = 3;

/**
 * Pinned "SBOBet × 1xBet" card at the very top of the homepage.
 * Reuses the matcher logic and the SAME shared settings (localStorage) as /matcher.
 * Real feed data only — empty state while no pairs are matched.
 */
export function MatcherPinCard() {
  const { t, number } = useI18n();
  const [settings, setSettings] = useMatcherSettings();
  const [pairs, setPairs] = useState<MatchedPair[]>([]);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let cancelled = false;
    let fetching = false;
    const tick = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const feed: Opportunity[] = await getIngestedFeed();
        if (cancelled) return;
        setPairs(matchPairs(feed.filter((o) => o.source === "collector" || o.source === "api")));
      } catch { /* keep last snapshot */ }
      finally {
        fetching = false;
        if (!cancelled) setLoading(false);
      }
    };
    void tick();
    const id = setInterval(tick, Math.max(1, settings.delaySec) * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [settings.delaySec]);

  // One card per match: best Over/Under pair primary, other markets collapsed.
  const top = groupPairsByMatch(pairs).slice(0, TOP_N);

  return (
    <section aria-label={t.matcherTitle}
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,hsl(var(--primary)/0.14),transparent_60%)]" />
      <div className="relative flex flex-wrap items-center gap-3 p-4 pb-0">
        <span className="flex items-center gap-2">
          <BookLogo name={MATCHER_BOOK_A} size={44} />
          <span className="text-lg font-extrabold text-primary">×</span>
          <BookLogo name={MATCHER_BOOK_B} size={44} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight">{t.matcherPinTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.matcherDesc}</p>
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t.matcherDelay}
            <NumField value={settings.delaySec}
              ariaLabel={t.matcherDelay}
              onChange={(n) => setSettings({ delaySec: clampDelay(n ?? MATCHER_DEFAULTS.delaySec) })}
              className="num w-16 rounded-lg border border-border bg-secondary px-2 py-1 text-foreground" />
            <span className="num">{t.sec}</span>
          </label>
          <Link to="/matcher"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.6)] transition-transform hover:scale-[1.03]">
            {t.matcherOpen}
            <span aria-hidden className="rtl:rotate-180">→</span>
          </Link>
        </div>
      </div>

      <div className="relative p-4">
        {loading || top.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            <Icon3D name="radar" size={32} halo={false} />
            {t.waitingFeed}
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-3">
            {top.map((g) => {
              const p = g.primary;
              const hit = p.surebet || exceedsThreshold(p, settings.threshold, settings.mode);
              return (
                <li key={p.key}
                  className={`rounded-xl border p-3 transition-colors ${hit ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/40"}`}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold">{p.event}</span>
                    {p.live && <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">{t.liveTag}</span>}
                    {p.surebet && <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{t.matcherSurebet}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.market} · {p.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[{ book: MATCHER_BOOK_A, o: p.a }, { book: MATCHER_BOOK_B, o: p.b }].map(({ book, o }) => (
                      <div key={book} className="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1.5">
                        <BookLogo name={book} size={20} />
                        <span className="num ms-auto text-base font-bold">{number(o.odds, 2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={`num mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${hit ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    <Icon3D name="chart-down" size={12} halo={false} />
                    {t.matcherDiff}: {number(p.diffAbs, 2)} ({number(p.diffPct, 1)}%)
                  </div>
                  {g.others.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                        {t.moreMarkets} <span className="num">({number(g.others.length)})</span>
                      </summary>
                      <ul className="mt-1.5 space-y-1">
                        {g.others.map((q) => (
                          <li key={q.key} className="num flex items-center justify-between gap-2 rounded bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
                            <span className="truncate">{q.market} · {q.label}</span>
                            <span className="shrink-0">{number(q.a.odds, 2)} / {number(q.b.odds, 2)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
