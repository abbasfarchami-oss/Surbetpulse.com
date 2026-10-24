import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BetModeSetting, BookmakerNormalizer, ErrorThresholdSetting, RegionalKeywords } from "@/components/AdminTools";
import { BookPricingAdmin } from "@/components/BookPricing";
import { AppShell } from "@/components/AppShell";
import { NumField } from "@/components/NumField";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_PLANS, savePlans, usePlans, type Plan } from "@/lib/plans";
import { requireAdmin } from "@/lib/cloud.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async () => {
    try { return await requireAdmin(); }
    catch { throw redirect({ to: "/" }); }
  },
  head: () => ({
    meta: [
      { title: "Admin Settings — ArbRadar" },
      { name: "description", content: "Manage ArbRadar subscription plan slots, prices and features." },
      { property: "og:title", content: "Admin Settings — ArbRadar" },
      { property: "og:description", content: "Plan management for ArbRadar admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const { plans } = usePlans();
  const [draft, setDraft] = useState<Plan[]>(plans);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(plans), [plans]);
  const upd = (i: number, patch: Partial<Plan>) => { setSaved(false); setDraft(draft.map((p, j) => (j === i ? { ...p, ...patch } : p))); };
  const inp = "rounded-lg border border-input bg-secondary px-2 py-1.5 text-sm";
  const save = async (next: Plan[]) => {
    try { await savePlans(next); setSaved(true); }
    catch { toast.error(t.authSaveFailed); }
  };
  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold tracking-tight">{t.adminTitle}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.adminDesc}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {draft.map((p, i) => (
          <div key={p.id} className={`space-y-3 rounded-xl border bg-card p-4 ${p.active ? "border-primary/50" : "border-border opacity-80"}`}>
            <div className="flex items-center justify-between">
              <span className="num text-xs text-muted-foreground">#{i + 1}</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p.active} onChange={(e) => upd(i, { active: e.target.checked })} className="accent-primary" /> {t.active}
              </label>
            </div>
            <label className="block text-xs text-muted-foreground">{t.title}
              <input className={`${inp} mt-1 w-full text-foreground`} value={p.title} maxLength={40} onChange={(e) => upd(i, { title: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-muted-foreground">{t.price}
                <NumField className={`${inp} num mt-1 w-full text-foreground`} value={p.price} onChange={(n) => upd(i, { price: Math.max(0, n ?? 0) })} />
              </label>
              <label className="block text-xs text-muted-foreground">{t.period}
                <select className={`${inp} mt-1 w-full text-foreground`} value={p.period} onChange={(e) => upd(i, { period: e.target.value as Plan["period"] })}>
                  <option value="month">{t.month}</option><option value="quarter">{t.quarter}</option><option value="year">{t.year}</option>
                </select>
              </label>
            </div>
            <label className="block text-xs text-muted-foreground">{t.maxProfitPlan}
              <NumField className={`${inp} num mt-1 w-full text-foreground`} value={p.maxProfit}
                onChange={(n) => upd(i, { maxProfit: n })} />
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {([["live", t.fLive], ["prematch", t.fPrematch], ["dropping", t.fDrop], ["api", t.fApi]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="checkbox" checked={p[k]} onChange={(e) => upd(i, { [k]: e.target.checked })} className="accent-primary" /> {l}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => void save(draft)} className="rounded-lg px-5 py-2 font-semibold">{t.save}</Button>
        <Button variant="outline" onClick={() => void save(DEFAULT_PLANS)} className="rounded-lg px-4 py-2">{t.reset}</Button>
        {saved && <span className="text-sm text-primary">✓ {t.saved}</span>}
      </div>
      <BookPricingAdmin />
      <BetModeSetting />
      <ErrorThresholdSetting />
      <RegionalKeywords />
      <BookmakerNormalizer />
    </AppShell>
  );
}
