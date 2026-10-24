import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookPlanBuilder } from "@/components/BookPricing";
import { TiltCard } from "@/components/TiltCard";
import { GlowIcon } from "@/components/GlowIcon";
import { Icon3D } from "@/components/Icon3D";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { FREE_PLAN, usePlans } from "@/lib/plans";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Plans & Pricing — ArbRadar" },
      { name: "description", content: "Choose an ArbRadar subscription: live, prematch, dropping odds and data feed access. Prices in USD." },
      { property: "og:title", content: "Plans & Pricing — ArbRadar" },
      { property: "og:description", content: "Subscription plans for the ArbRadar surebet scanner, priced in USD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { t, usd } = useI18n();
  const { plans, current } = usePlans();
  const per = { month: t.perMonth, quarter: t.perQuarter, year: t.perYear };
  const list = [FREE_PLAN, ...plans.filter((p) => p.active)].slice(0, 3);
  const [pid, setPid] = useState(list[1]?.id ?? "free");
  const [months, setMonths] = useState(3);
  const sel = list.find((p) => p.id === pid) ?? FREE_PLAN;
  const perMonth = sel.period === "year" ? sel.price / 12 : sel.period === "quarter" ? sel.price / 3 : sel.price;
  const disc = months >= 12 ? 0.2 : months >= 6 ? 0.1 : months >= 3 ? 0.05 : 0;
  const total = perMonth * months * (1 - disc);
  return (
    <AppShell>
      <h1 className="text-3xl font-extrabold tracking-tight">{t.plansTitle}</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p, idx) => {
          const isCur = current.id === p.id;
          const feats: [boolean, string][] = [
            [p.live, t.fLive], [p.prematch, t.fPrematch], [p.dropping, t.fDrop], [p.api, t.fApi],
          ];
          return (
            <TiltCard key={p.id} delay={idx * 400} className={`flex h-full flex-col rounded-2xl border bg-card p-5 ${isCur ? "border-primary" : "border-border"}`}>
              <GlowIcon name={(["bolt", "star", "shield"] as const)[idx % 3] ?? "bolt"} size={64} className="mb-3" />
              <div className="font-display text-xl font-bold tracking-tight">{p.title}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="num text-4xl font-extrabold">${p.price}</span>
                <span className="text-sm text-muted-foreground">{per[p.period]}</span>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                <li className="flex items-center gap-1.5"><Icon3D name="check" size={16} halo={false} /> {p.maxProfit == null ? t.unlimited : <>{t.upTo} <span className="num">{p.maxProfit}%</span></>}</li>
                {feats.map(([on, l]) => (
                  <li key={l} className={`flex items-center gap-1.5 ${on ? "" : "text-muted-foreground line-through"}`}><span className={on ? "" : "opacity-40 grayscale"}><Icon3D name={on ? "check" : "close"} size={16} halo={false} /></span> {l}</li>
                ))}
              </ul>
              <Button disabled={isCur || current.id === "admin"} onClick={() => toast.info(t.authSubscriptionPending)}
                className={`mt-5 rounded-lg px-4 py-2 font-semibold ${isCur ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                {isCur ? t.current : t.choose}
              </Button>
            </TiltCard>
          );
        })}
      </div>
      <Link to="/wallet"
        className="group mt-6 flex items-center gap-4 rounded-2xl border border-accent/50 bg-gradient-to-r from-accent/15 via-card to-primary/10 p-5 transition hover:border-accent hover:shadow-lg">
        <Icon3D name="coins" size={48} />
        <div className="min-w-0">
          <div className="font-display text-lg font-bold tracking-tight">{t.walletCta}</div>
          <div className="text-sm text-muted-foreground">{t.walletCtaDesc}</div>
        </div>
        <span className="ms-auto rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-foreground transition group-hover:scale-105">{t.walletCta}</span>
      </Link>
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">{t.planCalc}</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">{t.planLabel}
            <select value={pid} onChange={(e) => setPid(e.target.value)} className="mt-1 block rounded-lg border border-border bg-background px-3 py-2">
              {list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="min-w-48 flex-1 text-sm">{t.months}: <span className="num font-bold">{months}</span>
            <input type="range" min={1} max={12} value={months} onChange={(e) => setMonths(+e.target.value)} className="mt-2 block w-full accent-primary" />
          </label>
          <div className="text-end">
            {disc > 0 && <div className="text-xs text-primary">-{disc * 100}%</div>}
            <div className="num text-3xl font-extrabold">{usd(total)}</div>
          </div>
        </div>
      </div>
      <BookPlanBuilder />
    </AppShell>
  );
}
