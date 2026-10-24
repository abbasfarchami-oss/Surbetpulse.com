import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookLogo } from "@/components/BookLogo";
import { Icon3D } from "@/components/Icon3D";
import { bookBySlug, bookFamily, isSharp, profitPct, type Opportunity } from "@/lib/arb";
import { getIngestedFeed } from "@/lib/feed.functions";
import { sportKey, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/bookmakers_/$slug")({
  beforeLoad: ({ params }) => {
    const book = bookBySlug(params.slug);
    if (!book) throw notFound();
    return { book };
  },
  head: ({ params }) => {
    const book = bookBySlug(params.slug) ?? "Bookmaker";
    return {
      meta: [
        { title: `${book} — ArbRadar` },
        { name: "description", content: `Current odds and arbitrage opportunities for ${book} from the ArbRadar live feed.` },
        { property: "og:title", content: `${book} — ArbRadar` },
        { property: "og:description", content: `Current odds and arbitrage opportunities for ${book} from the ArbRadar live feed.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: BookmakerPage,
});

function BookmakerPage() {
  const { book } = Route.useRouteContext();
  const { t, number, percentage } = useI18n();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const feed = await getIngestedFeed();
        if (!cancelled) {
          setOpps(feed.filter((o) => o.outcomes.some((x) => x.bookmaker === book)));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    void tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [book]);

  const sharp = isSharp(book);
  const family = bookFamily(book);

  return (
    <AppShell>
      <Link to="/bookmakers" className="text-sm text-muted-foreground hover:text-foreground">← {t.backToBookmakers}</Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <BookLogo name={book} size={72} />
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{book}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {family && <span>{t.bookFamily}: {family}</span>}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sharp ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
              {sharp ? t.sharp : t.soft}
            </span>
          </div>
        </div>
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-lg font-bold">
        <Icon3D name="target" size={28} halo={false} />
        {t.bookOddsTitle}
      </h2>

      {loading || opps.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          <Icon3D name="radar" size={36} halo={false} />
          {t.waitingFeed}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {opps.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{o.event}</span>
                {o.live && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">LIVE</span>}
                <span className="text-xs text-muted-foreground">{String(t[sportKey(o.sport)])} · {o.league} · {o.market}</span>
                <span className="num ms-auto text-sm font-bold text-primary">{percentage(profitPct(o.outcomes), 2)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.outcomes.filter((x) => x.bookmaker === book).map((x) => (
                  <span key={x.label} className="num inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm">
                    {x.label} <b className="text-primary">{number(x.odds, 2)}</b>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
