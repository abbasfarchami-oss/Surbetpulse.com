import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookName } from "@/components/BookLogo";
import { AppShell } from "@/components/AppShell";
import { BOOK_FAMILIES } from "@/lib/arb";
import { toLatinDigits, useI18n } from "@/lib/i18n";
import { transferBalance, useAccounts } from "@/lib/accounts";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "My Bookmaker Accounts — ArbRadar" },
      { name: "description", content: "Choose the bookmaker accounts you bet with so the scanner shows only opportunities you can place." },
      { property: "og:title", content: "My Bookmaker Accounts — ArbRadar" },
      { property: "og:description", content: "Manage your personal bookmaker list in ArbRadar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const { t } = useI18n();
  const { accounts, save } = useAccounts();
  const [form, setForm] = useState<Record<string, { username: string; balance: string }>>({});
  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold tracking-tight">{t.accountsTitle}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.accountsDesc}</p>
      <p className="mt-1 text-xs text-accent">{t.demoNote}</p>
      <TransferBox />
      <div className="mt-6 space-y-6">
        {BOOK_FAMILIES.map((f) => (
          <section key={f.name}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{f.name}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {f.books.map((b) => {
                const acc = accounts[b];
                const fv = form[b] ?? { username: "", balance: "" };
                return (
                  <div key={b} className={`rounded-xl border bg-card p-4 ${acc ? "border-primary/50" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold"><BookName name={b} size={20} /></span>
                      {acc && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t.connected}</span>}
                    </div>
                    {acc ? (
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{acc.username} · <span className="num">${acc.balance.toFixed(2)}</span></span>
                        <button onClick={() => { const n = { ...accounts }; delete n[b]; save(n); }} className="text-xs text-destructive">{t.disconnect}</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <input placeholder={t.username} maxLength={60} value={fv.username}
                          onChange={(e) => setForm({ ...form, [b]: { ...fv, username: e.target.value } })}
                          className="min-w-0 flex-1 rounded-lg border border-input bg-secondary px-2 py-1 text-sm" />
                        <input placeholder="$" type="text" inputMode="decimal" dir="ltr" value={fv.balance}
                          onChange={(e) => setForm({ ...form, [b]: { ...fv, balance: toLatinDigits(e.target.value) } })}
                          className="num w-20 rounded-lg border border-input bg-secondary px-2 py-1 text-sm" />
                        <button onClick={() => save({ ...accounts, [b]: { username: fv.username.trim() || "—", balance: Math.max(0, +fv.balance || 0) } })}
                          className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">{t.connect}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

type Transfer = { from: string; to: string; amount: number; at: number };
const HIST = "transfers_v1";

function TransferBox() {
  const { t, usd } = useI18n();
  const { accounts, save } = useAccounts();
  const names = Object.keys(accounts);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hist, setHist] = useState<Transfer[]>([]);
  useEffect(() => { try { setHist(JSON.parse(localStorage.getItem(HIST) || "[]")); } catch { setHist([]); } }, []);
  const fmt = (n: number) => usd(n);
  const sel = "min-w-0 flex-1 rounded-lg border border-input bg-secondary px-2 py-2 text-sm";
  if (names.length < 2) return <p className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t.trNeed}</p>;
  const submit = () => {
    const n = transferBalance(accounts, from, to, +amount);
    if (!n) return setMsg({ ok: false, text: t.trInvalid });
    save(n);
    const h = [{ from, to, amount: +amount, at: Date.now() }, ...hist].slice(0, 10);
    setHist(h); localStorage.setItem(HIST, JSON.stringify(h));
    setAmount(""); setMsg({ ok: true, text: t.trDone });
  };
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t.trTitle}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <select aria-label={t.trFrom} value={from} onChange={(e) => setFrom(e.target.value)} className={sel}>
          <option value="">{t.trFrom}</option>
          {names.map((b) => <option key={b} value={b}>{b} — {fmt(accounts[b]!.balance)}</option>)}
        </select>
        <span className="self-center text-muted-foreground" aria-hidden="true">→</span>
        <select aria-label={t.trTo} value={to} onChange={(e) => setTo(e.target.value)} className={sel}>
          <option value="">{t.trTo}</option>
          {names.filter((b) => b !== from).map((b) => <option key={b} value={b}>{b} — {fmt(accounts[b]!.balance)}</option>)}
        </select>
        <input aria-label={t.trAmount} placeholder={t.trAmount} type="text" inputMode="decimal" dir="ltr" value={amount}
          onChange={(e) => setAmount(toLatinDigits(e.target.value))} className="num w-32 rounded-lg border border-input bg-secondary px-2 py-2 text-sm" />
        <button onClick={submit} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">{t.trSubmit}</button>
      </div>
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      {hist.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-muted-foreground">{t.trHistory}</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {hist.map((h) => <li key={h.at}>{h.from} → {h.to}: <span className="num font-semibold">{fmt(h.amount)}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
