import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Icon3D } from "@/components/Icon3D";
import { NumField } from "@/components/NumField";
import { Button } from "@/components/ui/button";
import { COINS, type Coin } from "@/lib/payments/coins";
import type { UsdRates } from "@/lib/payments/rates";
import { getCoinRates } from "@/lib/payments/rates.functions";
import { createTopUpInvoice } from "@/lib/payments/gateway.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Top up with Crypto — ArbRadar" },
      { name: "description", content: "Top up your ArbRadar subscription wallet with USDT, BTC, ETH and more. Pick a coin, network and amount." },
      { property: "og:title", content: "Top up with Crypto — ArbRadar" },
      { property: "og:description", content: "Crypto top-up: USDT (TRC20/ERC20/BEP20), TRX, BTC, ETH, BNB, LTC, DOGE and TON." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

const STEP_KEYS = ["walletStepCoin", "walletStepNetwork", "walletStepAmount", "walletStepPay"] as const;

/** Deterministic placeholder QR pattern (NOT scannable, NOT a real address). */
function PlaceholderQr({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const next = () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return (h >>> 0) / 4294967296;
    };
    const grid: boolean[] = [];
    for (let i = 0; i < 21 * 21; i++) grid.push(next() > 0.52);
    const finder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[(oy + y) * 21 + ox + x] = edge || core;
      }
    };
    finder(0, 0); finder(14, 0); finder(0, 14);
    return grid;
  }, [seed]);
  return (
    <svg viewBox="0 0 21 21" className="block h-full w-full" role="img" aria-label="Placeholder QR code">
      <rect width="21" height="21" fill="#ffffff" />
      {cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#151a24" /> : null))}
    </svg>
  );
}

function WalletPage() {
  const { t, number, usd } = useI18n();
  const [step, setStep] = useState(0);
  const [coin, setCoin] = useState<Coin | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [rates, setRates] = useState<UsdRates | null | undefined>(undefined); // undefined = loading
  const [gatewayChecked, setGatewayChecked] = useState(false);

  const loadRates = async () => {
    setRates(undefined);
    try {
      setRates(await getCoinRates());
    } catch {
      setRates(null);
    }
  };
  useEffect(() => {
    void loadRates();
  }, []);

  // Pay step: ask the (not-yet-configured) gateway for an invoice once.
  useEffect(() => {
    if (step !== 3 || !coin || !network || !amount || gatewayChecked) return;
    setGatewayChecked(true);
    void createTopUpInvoice({ data: { coin: coin.code, network, amountUsd: amount } }).catch(() => undefined);
  }, [step, coin, network, amount, gatewayChecked]);

  const rate = coin && rates ? rates[coin.code] : undefined;
  const coinAmount = rate && amount && amount > 0 ? amount / rate : null;
  const canContinue =
    (step === 0 && coin) || (step === 1 && network) || (step === 2 && amount != null && amount > 0);

  const pickCoin = (c: Coin) => {
    setCoin(c);
    setNetwork(c.networks.length === 1 ? c.networks[0]! : null);
    setGatewayChecked(false);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-4">
        <Icon3D name="coins" size={56} />
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{t.walletTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.walletDesc}</p>
        </div>
      </div>

      {/* Step indicator */}
      <ol className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold">
        {STEP_KEYS.map((k, i) => (
          <li key={k} className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
              <span className="num">{i + 1}</span> {t[k]}
            </span>
            {i < STEP_KEYS.length - 1 && <span className="text-muted-foreground" aria-hidden="true">‹</span>}
          </li>
        ))}
      </ol>

      <div key={step} className="step-pane mt-6">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COINS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => pickCoin(c)}
                aria-pressed={coin?.code === c.code}
                data-selected={coin?.code === c.code || undefined}
                className="coin-tile group flex flex-col items-center gap-2 p-5 text-white"
                style={{
                  background: `linear-gradient(150deg, color-mix(in srgb, ${c.color} 75%, white), ${c.color} 55%, color-mix(in srgb, ${c.color} 65%, black))`,
                  boxShadow: `0 10px 26px -10px color-mix(in srgb, ${c.color} 70%, transparent)`,
                }}
              >
                <img src={c.logo} alt={c.name} width={52} height={52} className="drop-shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                <span className="font-display text-lg font-extrabold tracking-tight">{c.code}</span>
                <span className="text-xs opacity-85">{c.name}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && coin && (
          <div className="flex flex-wrap gap-3">
            {coin.networks.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                aria-pressed={network === n}
                data-selected={network === n || undefined}
                className="net-badge flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold"
              >
                <img src={coin.logo} alt="" width={22} height={22} aria-hidden="true" />
                {n}
              </button>
            ))}
          </div>
        )}

        {step === 2 && coin && (
          <div className="glass-card max-w-md rounded-2xl p-6">
            <label className="block text-sm font-semibold">{t.walletAmountUsd}</label>
            <div className="mt-2 flex items-center rounded-xl border border-input bg-background/60 px-3" dir="ltr">
              <span className="text-lg text-muted-foreground">$</span>
              <NumField
                value={amount}
                onChange={setAmount}
                ariaLabel={t.walletAmountUsd}
                placeholder="100"
                className="num w-full bg-transparent px-2 py-3 text-2xl font-bold outline-none"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-background/50 p-3">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <img src={coin.logo} alt="" width={20} height={20} aria-hidden="true" />
                {t.walletYouGet}
              </span>
              {rates === undefined ? (
                <span className="num text-sm text-muted-foreground">…</span>
              ) : rates === null || rate == null ? (
                <span className="flex items-center gap-2 text-sm text-destructive">
                  {t.walletRateUnavailable}
                  <Button variant="ghost" size="sm" onClick={() => void loadRates()} className="h-7 px-2 text-xs">{t.walletRetry}</Button>
                </span>
              ) : (
                <span className="num text-lg font-extrabold" dir="ltr">
                  {coinAmount != null ? number(coinAmount, coinAmount < 1 ? 6 : 4) : "—"} {coin.code}
                </span>
              )}
            </div>
            {rate != null && (
              <p className="num mt-2 text-xs text-muted-foreground" dir="ltr">1 {coin.code} ≈ {usd(rate, rate < 10 ? 4 : 2)}</p>
            )}
          </div>
        )}

        {step === 3 && coin && network && amount != null && (
          <div className="grid max-w-3xl gap-4 md:grid-cols-[1fr_auto]">
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-bold text-accent">
                <Icon3D name="shield" size={20} halo={false} />
                {t.walletGatewayNotice}
              </div>
              <label className="mt-5 block text-sm font-semibold">{t.walletDepositAddress}</label>
              <div className="mt-2 break-all rounded-xl border border-dashed border-destructive/60 bg-destructive/10 p-4 font-mono text-sm" dir="ltr">
                PLACEHOLDER-{coin.code}-{network}-NOT-A-REAL-ADDRESS
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-destructive">{t.walletPlaceholder}</p>
              <div className="num mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground" dir="ltr">
                <span>{number(amount, 2)} USD</span>
                {coinAmount != null && <span>≈ {number(coinAmount, coinAmount < 1 ? 6 : 4)} {coin.code}</span>}
                <span>{coin.code} · {network}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="qr-frame h-44 w-44">
                <div className="qr-frame-inner h-full w-full">
                  <PlaceholderQr seed={`${coin.code}|${network}|${amount}`} />
                </div>
              </div>
              <p className="max-w-44 text-center text-xs text-muted-foreground">{t.walletQrNote}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)}>{t.walletBack}</Button>
        )}
        {step < 3 && (
          <Button disabled={!canContinue} onClick={() => setStep(step + 1)} className="bg-primary text-primary-foreground hover:opacity-90">
            {t.walletContinue}
          </Button>
        )}
      </div>
    </AppShell>
  );
}
