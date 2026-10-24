import { useEffect, useState } from "react";

/** Audible alert settings for new opportunities involving chosen bookmakers. */
export type AlertSettings = { enabled: boolean; muted: boolean; speak: boolean; books: string[] };
export const DEFAULT_ALERT_BOOKS = ["1xBet", "SBOBet"];
const DEFAULTS: AlertSettings = { enabled: true, muted: false, speak: true, books: DEFAULT_ALERT_BOOKS };
const KEY = "arbradar_alerts_v1", EVT = "alerts-changed";

export function loadAlerts(): AlertSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AlertSettings>;
      return { ...DEFAULTS, ...p, books: Array.isArray(p.books) ? p.books.filter((b) => typeof b === "string") : DEFAULT_ALERT_BOOKS };
    }
  } catch { /* ignore */ }
  return DEFAULTS;
}

export function saveAlerts(next: AlertSettings) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVT));
}

export function useAlerts(): [AlertSettings, (patch: Partial<AlertSettings>) => void] {
  const [s, setS] = useState<AlertSettings>(DEFAULTS);
  useEffect(() => {
    const sync = () => setS(loadAlerts());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return [s, (patch) => saveAlerts({ ...loadAlerts(), ...patch })];
}

/** Short two-tone chime for a fresh opportunity. */
export function beepAlert() {
  try {
    const ctx = new AudioContext();
    [660, 990, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.14, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
      o.start(t0); o.stop(t0 + 0.12);
    });
  } catch { /* ignore */ }
}

/** Spoken announcement, e.g. "New surebet on 1xBet, 2.4%". */
export function speakAlert(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
