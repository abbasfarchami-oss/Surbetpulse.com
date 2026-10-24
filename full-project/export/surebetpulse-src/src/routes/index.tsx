import { GlowIcon } from "@/components/GlowIcon";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GlowIconName } from "@/components/GlowIcon";
import { Icon3D, type Icon3DName } from "@/components/Icon3D";
import { BookName } from "@/components/BookLogo";
import { BetSlip } from "@/components/BetSlip";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { NumField } from "@/components/NumField";
import { Button } from "@/components/ui/button";
import { OpportunityLifetime, OpportunitySkeletons } from "@/components/FeedPresentation";
import { useBetMode } from "@/lib/settings";
import { isErrorRow, isHighEdge, isRegionalMatch, isSameFamilyArb, sortRegionalFirst, useErrorThreshold, useRegionalKeywords } from "@/lib/filters";
import { groupOpportunities, isOverUnderMarket } from "@/lib/grouping";
import { isAsianHandicapMarket } from "@/lib/asianhandicap";
import { beepAlert, speakAlert, useAlerts } from "@/lib/alerts";
import { AppShell } from "@/components/AppShell";
import {
  BOOK_FAMILIES, BOOK_GROUPS, BOOKMAKERS, MARKET_GROUPS, SPORTS,
  profitPct, splitStakes, valueEdge, type Opportunity,
} from "@/lib/arb";
import { useI18n, sportKey } from "@/lib/i18n";
import { usePlans } from "@/lib/plans";
import { useAccounts } from "@/lib/accounts";
import { getIngestedFeed } from "@/lib/feed.functions";
import { SportTabs } from "@/components/SportTabs";
import { BigOddsWidget } from "@/components/BigOddsWidget";
import { MatcherPinCard } from "@/components/MatcherPinCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ArbRadar — Surebet, Arbitrage & Value Bet Scanner" },
      { name: "description", content: "Live and prematch 2-way / 3-way surebets, value bets and dropping odds with a guaranteed-profit stake calculator." },
      { property: "og:title", content: "ArbRadar — Surebet & Value Bet Scanner" },
      { property: "og:description", content: "Live arbitrage feed, dropping odds alerts and a USD stake calculator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Scanner,
});

const pOf = (o: Opportunity) => (o.type === "surebet" ? profitPct(o.outcomes) : valueEdge(o));

function Scanner() {
  const { t, number, percentage } = useI18n();
  const betMode = useBetMode();
  const { current: plan } = usePlans();
  const { accounts } = useAccounts();
  const errThreshold = useErrorThreshold();
  const regionalKw = useRegionalKeywords();
  const [regionalOnly, setRegionalOnly] = useState(false);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [running, setRunning] = useState(true);
  const [type, setType] = useState<"all" | "surebet" | "value">("all");
  const [ways, setWays] = useState<0 | 2 | 3>(0);
  const [phase, setPhase] = useState<"all" | "live" | "prematch">("all");
  const [source, setSource] = useState<"all" | "collector" | "api">("all");
  const [sport, setSport] = useState("");
  const [mGroup, setMGroup] = useState<string | null>(null); // no chip selected = all markets
  const [minP, setMinP] = useState(0);
  const [books, setBooks] = useState<string[]>([]);
  const [required, setRequired] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [maxAge, setMaxAge] = useState(300);
  const [sound, setSound] = useState(false);
  const [notify, setNotify] = useState(false);
  const [alertAt, setAlertAt] = useState(5);
  const [calcOdds, setCalcOdds] = useState<number[]>([2.1, 2.05]);
  const [now, setNow] = useState(() => Date.now());
  const alertRef = useRef({ sound, notify, alertAt });
  alertRef.current = { sound, notify, alertAt };
  const [alerts, setAlerts] = useAlerts();
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const seen = useRef(new Set<string>());
  const receivedOnce = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let fetching = false;
    const tick = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const ext = (await getIngestedFeed()).filter(o => o.source === "collector" || o.source === "api");
        if (cancelled) return;
        const { sound, notify, alertAt } = alertRef.current;
        for (const fresh of ext) {
          const isNew = receivedOnce.current && !seen.current.has(fresh.id) && Date.now() - fresh.updatedAt <= maxAge * 1000;
          if (isNew && fresh.live && fresh.type === "surebet" && pOf(fresh) >= alertAt) {
            if (sound) beep();
            if (notify && "Notification" in window && Notification.permission === "granted")
              new Notification(`${t.liveTag} · ${percentage(pOf(fresh), 1)} · ${fresh.event}`, { body: `${fresh.sport} · ${fresh.market}` });
          }
          if (isNew) {
            const a = alertsRef.current;
            const hit = a.enabled && !a.muted ? fresh.outcomes.map((x) => x.bookmaker).find((bk) => a.books.includes(bk)) : undefined;
            if (hit) {
              beepAlert();
              if (a.speak) speakAlert(`New ${fresh.type === "surebet" ? "surebet" : "value bet"} on ${hit}, ${pOf(fresh).toFixed(1)}%`);
            }
          }
        }
        seen.current = new Set(ext.map(o => o.id));
        receivedOnce.current = true;
        setOpps(ext);
        setFeedError(false);
      } catch {
        if (!cancelled) setFeedError(true);
      } finally {
        fetching = false;
        if (!cancelled) setInitialLoading(false);
      }
    };
    void tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [running, t.liveTag, percentage, maxAge]);

  const myBooks = Object.keys(accounts);
  const list = useMemo(() => sortRegionalFirst(opps.filter((o) => {
    const p = pOf(o);
    if (isSameFamilyArb(o)) return false; // same-family rule: hide arbs whose legs are all one bookmaker family
    if (isErrorRow(o, errThreshold)) return false; // profit above the error threshold = data error, hidden
    if (regionalOnly) return isRegionalMatch(o, regionalKw); // regional quick filter: only the two safety rules above still exclude
    if (type !== "all" && o.type !== type) return false;
    if (ways && o.outcomes.length !== ways) return false;
    if (phase === "live" && !o.live) return false;
    if (phase === "prematch" && o.live) return false;
    if (source !== "all" && o.source !== source) return false;
    if (sport && o.sport !== sport) return false;
    if (mGroup && !(mGroup === "handicap" ? isAsianHandicapMarket(o.market) : MARKET_GROUPS[mGroup]?.includes(o.market))) return false;
    if (books.length && !o.outcomes.every((x) => books.includes(x.bookmaker))) return false;
    if (required && !o.outcomes.some((x) => x.bookmaker === required)) return false;
    if (onlyMine && !o.outcomes.every((x) => myBooks.includes(x.bookmaker))) return false;
    if ((now - o.updatedAt) / 1000 > maxAge) return false;
    if (p < minP) return false;
    if (!plan.live && o.live) return false;
    if (!plan.prematch && !o.live) return false;
    if (plan.maxProfit != null && p > plan.maxProfit) return false;
    return true;
  }), regionalKw),
  [opps, type, ways, phase, source, sport, mGroup, books, required, onlyMine, myBooks.join(), maxAge, now, minP, errThreshold, regionalOnly, regionalKw, plan]);

  const sure = opps.filter((o) => o.type === "surebet");
  const avg = sure.length ? sure.reduce((s, o) => s + pOf(o), 0) / sure.length : 0;
  const best = sure.length ? Math.max(...sure.map(pOf)) : 0;
  const drops = opps.filter((o) => o.outcomes.some((x) => x.prevOdds)).length;
  const toggleBooks = (bs: string[]) => {
    const allOn = bs.every((b) => books.includes(b));
    setBooks(allOn ? books.filter((b) => !bs.includes(b)) : [...new Set([...books, ...bs])]);
  };

  // One card per match: best Over/Under line is primary, other markets collapse into "More markets".
  const groups = useMemo(() => groupOpportunities(list), [list]);

  const renderOpp = (o: Opportunity) => {
    const p = pOf(o);
    const age = Math.max(0, Math.round((now - o.updatedAt) / 1000));
    const src = o.source === "collector" ? t.srcCollector : t.srcApi;
    return (
      <>
        <div className="flex flex-wrap items-start gap-3">
          <div className={`num rounded-lg px-3 py-2 text-lg font-semibold ${o.type === "surebet" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
            {percentage(p)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              {o.live && <span className="rounded bg-live px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-destructive-foreground animate-pulse">{t.liveTag}</span>}
              {isHighEdge(o) && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t.highEdge}</span>}
              {isRegionalMatch(o, regionalKw) && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{t.regionalTag}</span>}
              {o.event}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{String(t[sportKey(o.sport)] ?? o.sport)}</span>·<span>{o.league}</span>·<span className={isOverUnderMarket(o.market) ? "font-semibold text-primary" : ""}>{o.market}</span>·
              <span>{o.outcomes.length === 3 ? t.threeWay : t.twoWay}</span>·
              <span className={`num inline-flex items-center gap-1 ${age > 120 ? "text-destructive" : ""}`}><Icon3D name="stopwatch" size={14} halo={false} /> {number(age)}{t.sec}</span>·
              <span className="rounded bg-secondary px-1">{src}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCalcOdds(o.outcomes.map((x) => x.odds))} className="shrink-0 bg-transparent hover:bg-secondary hover:text-foreground">
            {t.calc}
          </Button>
        </div>
        <div className={`mt-3 grid gap-2 ${o.outcomes.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {o.outcomes.map((x, i) => (
            <div key={i} className="rounded-lg bg-secondary px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{x.label}</span><BookName name={x.bookmaker} />
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="num text-lg font-semibold">{number(x.odds, 2)}</span>
                {plan.dropping && x.prevOdds && (
                  <span className="num inline-flex items-center gap-1 text-xs text-destructive" title={t.dropping}>
                    <Icon3D name="chart-down" size={14} halo={false} /> {number(x.prevOdds, 2)} ({percentage(((x.odds - x.prevOdds) / x.prevOdds) * 100, 1)})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {betMode === "slip" && <BetSlip outcomes={o.outcomes} />}
        <OpportunityLifetime updatedAt={o.updatedAt} now={now} maxAge={maxAge} />
      </>
    );
  };

  return (
    <AppShell
      right={
        <button onClick={() => setRunning(!running)} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">
          <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-primary" : "bg-muted-foreground"}`} />
          {!running ? t.paused : initialLoading ? t.loadingOpportunities : feedError ? t.feedUnavailable : opps.length ? t.live : t.waitingFeed}
        </button>
      }
    >
      <div className="mb-6">
        <MatcherPinCard />
      </div>
      <Landing />
      <div className="mb-14">
        <BigOddsWidget />
      </div>
      <div id="scanner" className="grid scroll-mt-24 gap-6 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-center gap-4">
            <GlowIcon name="radar" size={72} />
            <h2 className="text-2xl font-extrabold md:text-3xl">{t.opportunities}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon="target" label={t.opportunities} value={opps.length} />
            <Stat icon="coins" label={t.avgProfit} value={avg} percent accent />
            <Stat icon="trophy" label={t.bestProfit} value={best} percent accent />
            <Stat icon="chart-down" label={t.dropsCount} value={drops} />
          </div>

          {/* Sport tabs */}
          <SportTabs value={sport} onChange={setSport} />
          {/* Market group tabs */}
          <Tabs small value={mGroup} onChange={(v) => setMGroup(v === mGroup ? null : v)} opts={Object.keys(MARKET_GROUPS).map((g) => [g, String(t[("mg_" + g) as keyof typeof t])] as [string, string])} />

          <div className="space-y-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Seg value={type} onChange={setType} opts={[["all", t.all], ["surebet", t.surebets], ["value", t.value]]} />
              <Seg value={ways} onChange={setWays} opts={[[0, t.all], [2, t.twoWay], [3, t.threeWay]]} />
              <Seg value={phase} onChange={setPhase} opts={[["all", t.all], ["live", t.liveTag], ["prematch", t.prematch]]} />
              <div className="ms-auto flex items-center gap-2 text-sm text-muted-foreground">
                {t.minProfit} %
                <NumIn value={minP} onChange={setMinP} label={t.minProfit} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {t.sources}:
              <Seg value={source} onChange={setSource} opts={[["all", t.all], ["collector", t.srcCollector], ["api", t.srcApi]]} />
            </div>

            <details className="group rounded-lg border border-border p-2" open>
              <summary className="cursor-pointer select-none text-sm font-semibold">
                {t.bookmakers} · {t.families} {books.length > 0 && <span className="num ms-1 text-primary">({books.length})</span>}
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip on={false} onClick={() => setBooks(BOOK_GROUPS['sharp'] ?? [])}>{t.sharp}</Chip>
                <Chip on={false} onClick={() => setBooks(BOOK_GROUPS['soft'] ?? [])}>{t.soft}</Chip>
                <Chip on={false} onClick={() => setBooks([])}>{t.clear}</Chip>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {BOOK_FAMILIES.map((f) => (
                  <div key={f.name} className="rounded-lg bg-secondary/60 p-2">
                    <button onClick={() => toggleBooks(f.books)}
                      className={`text-sm font-semibold ${f.books.every((b) => books.includes(b)) ? "text-primary" : ""}`}>
                      {f.name}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1 border-s border-border ps-2">
                      {f.books.map((b) => (
                        <Chip key={b} on={books.includes(b)} onClick={() => toggleBooks([b])}><BookName name={b} /></Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">{t.required}
                <select value={required} onChange={(e) => setRequired(e.target.value)} className="rounded-lg border border-border bg-secondary px-2 py-1 text-foreground">
                  <option value="">{t.none}</option>
                  {BOOKMAKERS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="accent-primary" />
                {t.onlyMine} <span className="num">({myBooks.length})</span>
              </label>
              <Chip on={regionalOnly} onClick={() => setRegionalOnly(!regionalOnly)}>{t.regionalLeagues}</Chip>
              <label className="flex items-center gap-2">{t.oddsAge}
                <input type="range" min={10} max={300} step={10} value={maxAge} onChange={(e) => setMaxAge(+e.target.value)} className="accent-primary" />
                <span className="num min-w-12 text-foreground">{number(maxAge)}{t.sec}</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); if (e.target.checked) beep(); }} className="accent-primary" />
                {t.sound}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={notify} onChange={async (e) => {
                  const on = e.target.checked;
                  if (on && "Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
                  setNotify(on);
                }} className="accent-primary" />
                {t.notify}
              </label>
              <span className="flex items-center gap-2">{t.above} <NumIn value={alertAt} onChange={setAlertAt} label={t.above} />%</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={alerts.enabled} onChange={(e) => setAlerts({ enabled: e.target.checked })} className="accent-primary" />
                {t.alerts}
              </label>
              <button type="button" onClick={() => setAlerts({ muted: !alerts.muted })}
                className="group flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 hover:bg-secondary">
                <Icon3D name={alerts.muted ? "close" : "check"} size={14} halo={false} />
                {alerts.muted ? t.unmute : t.mute}
              </button>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={alerts.speak} onChange={(e) => setAlerts({ speak: e.target.checked })} className="accent-primary" />
                {t.speak}
              </label>
              <details className="w-full rounded-lg border border-border p-2">
                <summary className="cursor-pointer select-none text-sm font-semibold">
                  {t.alertBooks} <span className="num ms-1 text-primary">({alerts.books.length})</span>
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {BOOKMAKERS.map((b) => (
                    <Chip key={b} on={alerts.books.includes(b)}
                      onClick={() => setAlerts({ books: alerts.books.includes(b) ? alerts.books.filter((x) => x !== b) : [...alerts.books, b] })}>
                      <BookName name={b} />
                    </Chip>
                  ))}
                </div>
              </details>
            </div>
          </div>

          {(!plan.live || plan.maxProfit != null || !plan.dropping) && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
              <span>
                {t.currentPlan}: <b>{plan.title}</b>
                {plan.maxProfit != null && <> · {t.upTo} <span className="num">{percentage(plan.maxProfit, 0)}</span></>}
                {!plan.live && <> · {t.fLive}: {t.noAccess}</>}
                {!plan.dropping && <> · {t.fDrop}: {t.noAccess}</>}
              </span>
              <Link to="/plans" className="ms-auto rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-foreground">{t.upgrade}</Link>
            </div>
          )}

          {feedError && !initialLoading && <p role="status" className="text-sm text-destructive">{t.feedUnavailable}</p>}
          <div aria-busy={initialLoading} className="overflow-hidden rounded-lg border border-border divide-y divide-border">
            {initialLoading && <OpportunitySkeletons />}
            {!initialLoading && list.length === 0 && <div className="p-10 text-center text-muted-foreground">{opps.length ? t.noResults : feedError ? t.feedUnavailable : t.waitingFeed}</div>}
            {!initialLoading && groups.map((g) => (
              <article key={g.primary.id} className={`group bg-card even:bg-row-alternate p-4 transition-colors duration-200 hover:bg-row-hover focus-within:bg-row-hover motion-reduce:transition-none ${isOverUnderMarket(g.primary.market) ? "border-s-2 border-s-primary/60" : ""}`}>
                {renderOpp(g.primary)}
                {g.others.length > 0 && (
                  <details className="mt-3 rounded-lg border border-border">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                      {t.moreMarkets} <span className="num">({number(g.others.length)})</span>
                    </summary>
                    <div className="space-y-4 border-t border-border p-3">
                      {g.others.map((o) => <div key={o.id}>{renderOpp(o)}</div>)}
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Calculator odds={calcOdds} setOdds={setCalcOdds} />
        </aside>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value, accent, percent = false }: { icon: Icon3DName; label: string; value: number; accent?: boolean; percent?: boolean }) {
  return (
    <div className="group min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
        <Icon3D name={icon} size={26} halo={false} />
        {label}
      </div>
      <div className={`num mt-1 min-h-7 text-xl font-semibold ${accent ? "text-primary" : ""}`}><AnimatedNumber value={value} percent={percent} /></div>
    </div>
  );
}

function Tabs({ value, onChange, opts, small }: { value: string | null; onChange: (v: string) => void; opts: [string, string][]; small?: boolean }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {opts.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 ${small ? "py-1.5 text-xs" : "py-2 text-sm font-semibold"} transition ${value === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Seg<T extends string | number>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="flex flex-wrap rounded-lg bg-secondary p-0.5">
      {opts.map(([v, l]) => (
        <Button key={String(v)} variant="ghost" size="sm" aria-pressed={value === v} onClick={() => onChange(v)}
          className={`h-8 rounded-md px-3 text-sm transition-colors motion-reduce:transition-none ${value === v ? "bg-selected text-selected-foreground font-semibold hover:bg-selected hover:text-selected-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>
          {l}
        </Button>
      ))}
    </div>
  );
}

function NumIn({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <NumField value={value} onChange={(n) => onChange(n ?? 0)} ariaLabel={label}
      className="num w-16 rounded-lg border border-border bg-secondary px-2 py-1 text-foreground" />
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function Calculator({ odds, setOdds }: { odds: number[]; setOdds: (o: number[]) => void }) {
  const { t, usd, number, percentage } = useI18n();
  const [total, setTotal] = useState(1000);
  const [step, setStep] = useState(1);
  const valid = odds.every((o) => o > 1) && total > 0;
  const r = valid ? splitStakes(odds, total, step) : null;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="group flex items-center gap-2 font-semibold"><Icon3D name="calc" size={26} halo={false} />{t.calculator}</div>
      <label className="mt-3 block text-xs text-muted-foreground">{t.totalStake} (USD)</label>
      <div className="mt-1 flex items-center rounded-lg border border-input bg-secondary px-3" dir="ltr">
        <span className="text-muted-foreground">$</span>
        <NumField value={total} onChange={(n) => setTotal(n ?? 0)} ariaLabel={t.totalStake} className="num w-full bg-transparent px-2 py-2 outline-none" />
      </div>
      <div className="mt-3 text-xs text-muted-foreground">{t.rounding}</div>
      <div className="mt-1">
        <Seg value={step} onChange={setStep} opts={[[0, t.noRound], [0.5, usd(0.5, 1)], [1, usd(1, 0)], [5, usd(5, 0)], [10, usd(10, 0)]]} />
      </div>
      <div className="mt-3 space-y-2">
        {odds.map((o, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <NumField value={o} ariaLabel={`${t.calc} ${number(i + 1)}`}
              onChange={(n) => setOdds(odds.map((x, j) => (j === i ? (n ?? 0) : x)))}
              className="num min-w-0 w-full rounded-lg border border-input bg-secondary px-2 py-1.5" />
            <div className="num text-sm">{r ? usd(r.stakes[i] ?? 0) : "—"}</div>
            {odds.length > 2 ? (
              <button onClick={() => setOdds(odds.filter((_, j) => j !== i))} className="group grid place-items-center rounded-full bg-destructive/15 p-1 hover:bg-destructive/25" aria-label={t.remove}><Icon3D name="close" size={12} halo={false} /></button>
            ) : <span />}
          </div>
        ))}
        {odds.length < 3 && <button onClick={() => setOdds([...odds, 3])} className="text-xs text-primary">+ {t.addOutcome}</button>}
      </div>
      {r && (
        <div className={`mt-4 space-y-1 rounded-lg p-3 text-sm ${r.profit >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
          <div className="flex flex-wrap justify-between gap-x-2"><span>{t.spent}</span><span className="num">{usd(r.spent)}</span></div>
          <div className="flex flex-wrap justify-between gap-x-2"><span>{t.payout}</span><span className="num">{usd(r.payout)}</span></div>
          <div className="flex flex-wrap justify-between gap-x-2 font-semibold">
            <span>{r.profit >= 0 ? t.guaranteed : t.notArb}</span>
            <span className={`num ${r.profit >= 0 ? "text-primary" : "text-destructive"}`}>{usd(r.profit)} ({percentage(r.pct)})</span>
          </div>
        </div>
      )}
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.start(t0); o.stop(t0 + 0.15);
    });
  } catch {}
}

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".landing .reveal"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Landing() {
  const { t } = useI18n();
  useReveal();
  const advantages: { icon: GlowIconName; title: string; desc: string }[] = [
    { icon: "radar", title: t.adv1Title, desc: t.adv1Desc },
    { icon: "star", title: t.adv2Title, desc: t.adv2Desc },
    { icon: "bolt", title: t.adv3Title, desc: t.adv3Desc },
    { icon: "shield", title: t.adv4Title, desc: t.adv4Desc },
  ];
  const steps = [
    { n: 1, title: t.how1Title, desc: t.how1Desc },
    { n: 2, title: t.how2Title, desc: t.how2Desc },
    { n: 3, title: t.how3Title, desc: t.how3Desc },
    { n: 4, title: t.how4Title, desc: t.how4Desc },
  ];
  const features: { icon: GlowIconName; title: string; desc: string }[] = [
    { icon: "bolt", title: t.feat1Title, desc: t.feat1Desc },
    { icon: "star", title: t.feat2Title, desc: t.feat2Desc },
    { icon: "radar", title: t.feat3Title, desc: t.feat3Desc },
    { icon: "shield", title: t.feat4Title, desc: t.feat4Desc },
  ];
  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
  ];
  return (
    <div className="landing space-y-20 pb-10 md:space-y-28">
      <section className="reveal in-view flex flex-col items-center gap-6 py-10 text-center md:py-16">
        <span className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          {t.promoTitle}
        </span>
        <h1 className="max-w-4xl text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          <span className="promo-text">{t.heroTitle}</span>
        </h1>
        <p className="max-w-2xl text-balance text-muted-foreground md:text-lg">{t.heroSubtitle}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/plans" className="rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:opacity-90">{t.choose}</Link>
          <a href="#scanner" className="rounded-xl border border-border px-6 py-3 font-semibold transition hover:bg-secondary">{t.navScanner}</a>
        </div>
      </section>

      <section className="reveal space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t.whyTitle}</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">{t.whyDesc}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map((a) => (
            <div key={a.title} className="group rounded-2xl border border-border bg-card p-6">
              <GlowIcon name={a.icon} size={56} />
              <h3 className="mt-4 font-bold">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="reveal space-y-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">{t.howTitle}</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="promo-text num text-4xl font-extrabold" aria-hidden="true">{s.n}</span>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="reveal space-y-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">{t.featuresTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card p-6">
              <GlowIcon name={f.icon} size={56} />
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="reveal mx-auto max-w-3xl space-y-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">{t.faqTitle}</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-border bg-card p-4 open:bg-secondary/40">
              <summary className="cursor-pointer select-none font-semibold">{f.q}</summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
