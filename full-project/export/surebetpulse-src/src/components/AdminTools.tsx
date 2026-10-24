import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BOOKMAKERS } from "@/lib/arb";
import { suggestBookmakers } from "@/lib/bookmaker-ai.functions";
import { loadCustomBooks, saveCustomBooks, setBetMode, useBetMode, type CustomBook } from "@/lib/settings";
import { DEFAULT_ERROR_THRESHOLD, DEFAULT_REGIONAL_KEYWORDS, useErrorThreshold, useRegionalKeywords, saveErrorThreshold, saveRegionalKeywords } from "@/lib/filters";
import { NumField } from "@/components/NumField";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
type BookSuggestion = { input: string; canonical: string; domain: string; duplicateOf: string | null; note: string };

export function BetModeSetting() {
  const { t } = useI18n();
  const mode = useBetMode();
  const opt = (m: "odds" | "slip", title: string) => (
    <Button variant="outline" aria-pressed={mode === m} onClick={() => void setBetMode(m).catch(() => toast.error(t.authSaveFailed))} className={`h-auto min-h-14 flex-1 whitespace-normal rounded-lg border p-4 text-start hover:bg-secondary hover:text-foreground ${m === "slip" ? "slip-pulse" : ""} ${mode === m ? "border-primary bg-primary/10" : "border-border"}`}>
      {title}
    </Button>
  );
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{t.displayMode}</h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {opt("odds", t.oddsOnly)}
        {opt("slip", t.prepareSlip)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t.manualOnly}</p>
    </section>
  );
}

/** Error threshold: arbs with profit above this % are treated as data errors and discarded. */
export function ErrorThresholdSetting() {
  const { t } = useI18n();
  const [value, setValue] = useState(DEFAULT_ERROR_THRESHOLD);
  const [saved, setSaved] = useState(false);
  const threshold = useErrorThreshold();
  useEffect(() => setValue(threshold), [threshold]);
  const save = async (n: number) => {
    try { await saveErrorThreshold(n); setValue(n); setSaved(true); }
    catch { toast.error(t.authSaveFailed); }
  };
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{t.errorThreshold}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t.errorThresholdDesc}</p>
      <div className="mt-3 flex items-center gap-3">
        <NumField className="num w-24 rounded-lg border border-input bg-secondary px-2 py-1.5 text-sm text-foreground"
          value={value} onChange={(n) => { setValue(n ?? DEFAULT_ERROR_THRESHOLD); setSaved(false); }} ariaLabel={t.errorThreshold} />
        <span className="text-sm text-muted-foreground">%</span>
        <button onClick={() => save(Math.max(1, value))}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{t.save}</button>
        <button onClick={() => save(DEFAULT_ERROR_THRESHOLD)}
          className="rounded-lg border border-border px-4 py-2">{t.reset}</button>
        {saved && <span className="text-sm text-primary">✓ {t.saved}</span>}
      </div>
    </section>
  );
}

/** Regional / Asian leagues: editable keyword list (one per line) that drives the Regional tag and sort priority. */
export function RegionalKeywords() {
  const { t } = useI18n();
  const [text, setText] = useState(() => DEFAULT_REGIONAL_KEYWORDS.join("\n"));
  const [saved, setSaved] = useState(false);
  const keywords = useRegionalKeywords();
  useEffect(() => setText(keywords.join("\n")), [keywords]);
  const save = async (raw: string) => {
    const list = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    try { await saveRegionalKeywords(list.length ? list : DEFAULT_REGIONAL_KEYWORDS); setSaved(true); }
    catch { toast.error(t.authSaveFailed); }
  };
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">{t.regionalKeywords}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t.regionalKeywordsDesc}</p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} rows={8}
        className="mt-3 w-full rounded-lg border border-input bg-secondary p-3 font-mono text-sm" dir="ltr" />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={() => save(text)} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{t.save}</button>
        <button onClick={() => { const d = DEFAULT_REGIONAL_KEYWORDS.join("\n"); setText(d); save(d); }}
          className="rounded-lg border border-border px-4 py-2">{t.reset}</button>
        {saved && <span className="text-sm text-primary">✓ {t.saved}</span>}
      </div>
    </section>
  );
}

export function BookmakerNormalizer() {
  const { t } = useI18n();
  const run = useServerFn(suggestBookmakers);
  const [text, setText] = useState("");
  const [items, setItems] = useState<BookSuggestion[]>([]);
  const [saved, setSaved] = useState<CustomBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void loadCustomBooks().then(setSaved).catch(() => setErr(t.authSaveFailed)); }, [t.authSaveFailed]);
  const go = async () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 50);
    if (!lines.length) return;
    setBusy(true); setErr(null); setItems([]);
    try {
      const r = await run({ data: { lines, known: [...BOOKMAKERS, ...saved.map((s) => s.name)] } });
      if (r.error) setErr(r.error); else setItems(r.items);
    } catch { setErr("AI request failed."); } finally { setBusy(false); }
  };
  const accept = async (s: BookSuggestion) => {
    const next = [...saved.filter((b) => b.name !== s.canonical), { name: s.canonical, domain: s.domain }];
    try { await saveCustomBooks(next); setSaved(next); } catch { setErr(t.authSaveFailed); }
  };
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold">Bookmaker names (AI check)</h2>
      <p className="mt-1 text-xs text-muted-foreground">One per line: name and address from the feed, e.g. "1x bet  1xbet-mirror.com".</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="mt-3 w-full rounded-lg border border-input bg-secondary p-3 text-sm" />
      <button onClick={go} disabled={busy} className="mt-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Checking…" : "Suggest spelling & find duplicates"}</button>
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          {items.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
              <span className="text-muted-foreground line-through">{s.input}</span><span>→</span>
              <span className="font-semibold">{s.canonical}</span><span className="text-xs text-muted-foreground">{s.domain}</span>
              {s.duplicateOf && <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">Duplicate of {s.duplicateOf}</span>}
              <span className="w-full text-xs text-muted-foreground sm:w-auto">{s.note}</span>
              {!s.duplicateOf && <button onClick={() => accept(s)} className="ms-auto rounded border border-border px-2 py-1 text-xs hover:bg-secondary">{t.save}</button>}
            </div>
          ))}
        </div>
      )}
      {saved.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Saved: {saved.map((s) => `${s.name} (${s.domain})`).join(", ")}</p>}
    </section>
  );
}
