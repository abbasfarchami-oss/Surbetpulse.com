import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookLogo } from "@/components/BookLogo";
import { Icon3D } from "@/components/Icon3D";
import { Button } from "@/components/ui/button";
import type { Opportunity } from "@/lib/arb";
import { getIngestedFeed } from "@/lib/feed.functions";
import { useI18n } from "@/lib/i18n";
import { beepAlert, speakAlert, useAlerts } from "@/lib/alerts";
import {
  MATCHER_BOOK_A, MATCHER_BOOK_B, MATCHER_DEFAULTS,
  alertMessage, clampDelay, exceedsThreshold, matchPairs, shouldAlert, useMatcherSettings,
  type MatchedPair,
} from "@/lib/matcher";
import { NumField } from "@/components/NumField";
import { groupPairsByMatch, isOverUnderMarket } from "@/lib/grouping";

export const Route = createFileRoute("/matcher")({
  head: () => ({
    meta: [
      { title: "SBOBet ↔ 1xBet Matcher — ArbRadar" },
      { name: "description", content: "Live SBOBet vs 1xBet odds matcher: paired quotes side by side, difference highlights and audible surebet alerts." },
      { property: "og:title", content: "SBOBet ↔ 1xBet Matcher — ArbRadar" },
      { property: "og:description", content: "Live SBOBet vs 1xBet odds matcher with difference highlights and audible alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatcherPage,
});

function MatcherPage() {
  const { t, number } = useI18n();
  const [settings, setSettings] = useMatcherSettings();
  const [alerts] = useAlerts();
  const [pairs, setPairs] = useState<MatchedPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "ah">("all");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const lastAlert = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    let fetching = false;
    const tick = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const feed: Opportunity[] = await getIngestedFeed();
        if (cancelled) return;
        const next = matchPairs(feed.filter((o) => o.source === "collector" || o.source === "api"));
        const s = settingsRef.current;
        const a = alertsRef.current;
        if (a.enabled && !a.muted) {
          for (const p of next) {
            if ((p.surebet || exceedsThreshold(p, s.threshold, s.mode)) && shouldAlert(lastAlert.current, p.key, Date.now())) {
              beepAlert();
              if (a.speak) speakAlert(alertMessage(p));
            }
          }
        }
        setPairs(next);
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

  const shown = tab === "ah" ? pairs.filter((p) => p.line != null) : pairs;

  // One card per match: best Over/Under pair primary, other markets collapsed.
  const renderPair = (p: MatchedPair, primary: boolean) => {
    const hit = p.surebet || exceedsThreshold(p, settings.threshold, settings.mode);
    return (
      <div key={p.key} className={`rounded-2xl border p-4 ${hit ? "border-primary/50 bg-primary/5" : "border-border bg-card"} ${primary && isOverUnderMarket(p.market) ? "ring-1 ring-primary/40" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          {p.live && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">{t.liveTag}</span>}
          <span className="text-xs text-muted-foreground">{p.league} · <span className={`num ${isOverUnderMarket(p.market) ? "font-semibold text-primary" : ""}`}>{p.market}</span> · {p.label}</span>
          <span className={`num ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold ${hit ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
            <Icon3D name="chart-down" size={14} halo={false} />
            {t.matcherDiff}: {number(p.diffAbs, 2)} ({number(p.diffPct, 1)}%)
          </span>
          {p.surebet && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{t.matcherSurebet}</span>}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[{ book: MATCHER_BOOK_A, o: p.a }, { book: MATCHER_BOOK_B, o: p.b }].map(({ book, o }) => (
            <div key={book} className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2">
              <BookLogo name={book} size={28} />
              <span className="text-xs text-muted-foreground">{book}</span>
              <span className="num ms-auto text-lg font-semibold">{number(o.odds, 2)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-4">
        <Icon3D name="bolt" size={56} />
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{t.matcherTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.matcherDesc}</p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <BookLogo name={MATCHER_BOOK_A} size={40} />
          <span className="font-extrabold text-muted-foreground">↔</span>
          <BookLogo name={MATCHER_BOOK_B} size={40} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          {t.matcherDelay}
          <NumField value={settings.delaySec}
            ariaLabel={t.matcherDelay}
            onChange={(n) => setSettings({ delaySec: clampDelay(n ?? MATCHER_DEFAULTS.delaySec) })}
            className="num w-16 rounded-lg border border-border bg-secondary px-2 py-1 text-foreground" />
          <span className="num">{t.sec}</span>
        </label>
        <label className="flex items-center gap-2">
          {t.matcherThreshold}
          <NumField value={settings.threshold}
            ariaLabel={t.matcherThreshold}
            onChange={(n) => setSettings({ threshold: Math.max(0, n ?? 0) })}
            className="num w-20 rounded-lg border border-border bg-secondary px-2 py-1 text-foreground" />
        </label>
        <div className="flex rounded-lg bg-secondary p-0.5">
          {(["abs", "pct"] as const).map((m) => (
            <Button key={m} variant="ghost" size="sm" aria-pressed={settings.mode === m} onClick={() => setSettings({ mode: m })}
              className={`h-8 rounded-md px-3 text-sm ${settings.mode === m ? "bg-selected text-selected-foreground font-semibold hover:bg-selected hover:text-selected-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>
              {m === "abs" ? t.matcherAbs : t.matcherPct}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
        {([["all", t.all], ["ah", t.matcherAh]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {loading || shown.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          <Icon3D name="radar" size={36} halo={false} />
          {t.waitingFeed}
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {groupPairsByMatch(shown).map((g) => (
            <section key={g.event}>
              <h2 className="text-base font-bold">{g.event}</h2>
              <div className="mt-2 space-y-3">
                {renderPair(g.primary, true)}
                {g.others.length > 0 && (
                  <details className="rounded-2xl border border-border bg-card">
                    <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                      {t.moreMarkets} <span className="num">({number(g.others.length)})</span>
                    </summary>
                    <div className="space-y-3 border-t border-border p-3">
                      {g.others.map((p) => renderPair(p, false))}
                    </div>
                  </details>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
