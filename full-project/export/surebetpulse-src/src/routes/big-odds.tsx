import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookLogo } from "@/components/BookLogo";
import { Icon3D } from "@/components/Icon3D";
import { getBigOdds } from "@/lib/feed.functions";
import { formatFoundAt, formatReturnPct, type BigOddsEntry } from "@/lib/bigodds-core";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/big-odds")({
  head: () => ({
    meta: [
      { title: "Big Odds of the Day — ArbRadar" },
      { name: "description", content: "The highest odds seen today across the live feed, ranked and reset every midnight (UTC)." },
      { property: "og:title", content: "Big Odds of the Day — ArbRadar" },
      { property: "og:description", content: "Daily ranking of the highest bookmaker odds from the real live feed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BigOddsPage,
});

type SortKey = "foundAt" | "odds" | "peak";

function BigOddsPage() {
  const { t, lang, number } = useI18n();
  const [rows, setRows] = useState<BigOddsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("odds");
  const [asc, setAsc] = useState(false);
  const [sport, setSport] = useState("");
  const [book, setBook] = useState("");
  const [flash, setFlash] = useState<ReadonlySet<string>>(new Set());
  const prevUpdated = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    let fetching = false;
    const tick = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const data = await getBigOdds();
        if (cancelled) return;
        const changed = new Set<string>();
        const hadSnapshot = prevUpdated.current.size > 0;
        for (const r of data) {
          const prev = prevUpdated.current.get(r.key);
          if (hadSnapshot && prev !== r.updatedAt) changed.add(r.key);
          prevUpdated.current.set(r.key, r.updatedAt);
        }
        if (changed.size) {
          setFlash(changed);
          setTimeout(() => setFlash(new Set()), 1800);
        }
        setRows(data);
      } catch {
        /* keep last snapshot */
      } finally {
        fetching = false;
        if (!cancelled) setLoading(false);
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Rank by the default odds ranking (server order: odds desc, ties by earlier foundAt).
  const rankOf = new Map(rows.map((r, i) => [r.key, i + 1]));
  const sports = [...new Set(rows.map((r) => r.sport))];
  const books = [...new Set(rows.map((r) => r.bookmaker))];
  const filtered = rows.filter((r) => (!sport || r.sport === sport) && (!book || r.bookmaker === book));
  const sorted = [...filtered].sort((a, b) => {
    const v = sortKey === "foundAt" ? a.foundAt - b.foundAt : sortKey === "odds" ? a.odds - b.odds : a.peakOdds - b.peakOdds;
    return (asc ? v : -v) || a.foundAt - b.foundAt;
  });

  // FLIP: animate rows to their new positions when the ranking changes.
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const prevTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const [key, el] of rowEls.current) {
      const top = el.getBoundingClientRect().top;
      const prev = prevTops.current.get(key);
      if (prev !== undefined && Math.abs(prev - top) > 2 && !reduce) {
        el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "none" }], {
          duration: 340,
          easing: "cubic-bezier(.2,.7,.3,1)",
        });
      }
      prevTops.current.set(key, top);
    }
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(false);
    }
  };
  const sortMark = (k: SortKey) => (sortKey === k ? (asc ? " ▲" : " ▼") : "");

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-4">
        <Icon3D name="trophy" size={56} />
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{t.bigOddsTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.bigOddsDesc}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          {t.boSport}
          <select value={sport} onChange={(e) => setSport(e.target.value)} className="rounded-lg border border-border bg-secondary px-2 py-1 text-foreground">
            <option value="">{t.all}</option>
            {sports.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted-foreground">
          {t.boBookmaker}
          <select value={book} onChange={(e) => setBook(e.target.value)} className="rounded-lg border border-border bg-secondary px-2 py-1 text-foreground">
            <option value="">{t.all}</option>
            {books.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
      </div>

      {loading || sorted.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          <Icon3D name="radar" size={36} halo={false} />
          {t.waitingFeed}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-start font-semibold">
                  <button type="button" onClick={() => toggleSort("foundAt")} className="font-semibold hover:text-foreground">
                    {t.boFoundAt}{sortMark("foundAt")}
                  </button>
                </th>
                <th className="px-2 py-2.5 text-start font-semibold">{t.boRank}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t.boSport}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t.boMatch}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t.boMarket}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t.boOutcome}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t.boBookmaker}</th>
                <th className="px-3 py-2.5 text-end font-semibold">
                  <button type="button" onClick={() => toggleSort("odds")} className="font-semibold hover:text-foreground">
                    {t.boOdds}{sortMark("odds")}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-end font-semibold">
                  <button type="button" onClick={() => toggleSort("peak")} className="font-semibold hover:text-foreground">
                    {t.boPeak}{sortMark("peak")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.key}
                  ref={(el) => {
                    if (el) rowEls.current.set(r.key, el);
                    else rowEls.current.delete(r.key);
                  }}
                  className={`border-b border-border/50 last:border-0 hover:bg-row-hover ${flash.has(r.key) ? "row-flash" : ""}`}
                >
                  <td className="num whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground" dir="ltr">{formatFoundAt(r.foundAt, lang)}</td>
                  <td className="num px-2 py-2.5 font-bold text-primary">{rankOf.get(r.key)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{r.sport}</td>
                  <td className="max-w-56 truncate px-3 py-2.5 font-medium">{r.match}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.market}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{r.outcome}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="inline-flex items-center gap-2"><BookLogo name={r.bookmaker} size={24} />{r.bookmaker}</span>
                  </td>
                  <td className="num whitespace-nowrap px-3 py-2.5 text-end" dir="ltr">
                    <span className="text-base font-extrabold">{number(r.odds, 2)}</span>
                    <span className="ms-1.5 text-xs text-primary">{formatReturnPct(r.odds)}</span>
                  </td>
                  <td className="num whitespace-nowrap px-3 py-2.5 text-end text-muted-foreground" dir="ltr">{number(r.peakOdds, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
