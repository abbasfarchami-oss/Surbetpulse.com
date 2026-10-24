import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookLogo } from "@/components/BookLogo";
import { Icon3D } from "@/components/Icon3D";
import { getBigOdds } from "@/lib/feed.functions";
import { formatFoundAt, formatReturnPct, type BigOddsEntry } from "@/lib/bigodds-core";
import { useI18n } from "@/lib/i18n";

/** Homepage widget: top 5 of today's biggest odds from the real feed. */
export function BigOddsWidget() {
  const { t, lang, number } = useI18n();
  const [rows, setRows] = useState<BigOddsEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let fetching = false;
    const tick = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const data = await getBigOdds();
        if (!cancelled) setRows(data);
      } catch {
        /* keep last snapshot */
      } finally {
        fetching = false;
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const top = (rows ?? []).slice(0, 5);

  return (
    <section className="reveal space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Icon3D name="trophy" size={44} />
        <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{t.bigOddsWidgetTitle}</h2>
        <Link to="/big-odds" className="ms-auto rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20">
          {t.bigOddsSeeAll}
        </Link>
      </div>
      {rows === null || top.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Icon3D name="radar" size={28} halo={false} />
          {t.waitingFeed}
        </div>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {top.map((r, i) => (
            <li key={r.key} className="group rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
              <div className="flex items-center gap-2">
                <span className="num text-lg font-extrabold text-primary">#{i + 1}</span>
                <BookLogo name={r.bookmaker} size={26} />
                <span className="truncate text-xs text-muted-foreground">{r.bookmaker}</span>
              </div>
              <div className="mt-2 truncate text-sm font-semibold" title={r.match}>{r.match}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.market} · {r.outcome}</div>
              <div className="num mt-2 flex items-baseline gap-1.5" dir="ltr">
                <span className="text-xl font-extrabold">{number(r.odds, 2)}</span>
                <span className="text-xs font-bold text-primary">{formatReturnPct(r.odds)}</span>
              </div>
              <div className="num mt-1 text-[11px] text-muted-foreground" dir="ltr">{formatFoundAt(r.foundAt, lang)}</div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
