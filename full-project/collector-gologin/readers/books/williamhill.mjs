// EXPERIMENTAL standalone William Hill reader — PASSIVE ONLY. The user opens William Hill themselves in their own anti-detect profile
// (any login done by the user by hand). This module only listens to responses the page already loads (page.on("response"))
// and saves them for format analysis. It makes no requests of its own, never logs in, never bypasses anything, never bets.
// Response format is UNKNOWN / not verified, so parse() returns [] until a real capture is analysed.
// Pairing: Abbas wants Bet365 and William Hill read as a matching pair (pairGroup "bet365-williamhill").
import { logError, writeStatus, writeCapture } from "../_shared/output.mjs";
export const CONFIG = { key: "williamhill", name: "William Hill", family: "williamhill", engine: "williamhill", domain: "sports.williamhill.com", mirrors: [],
  pairGroup: "bet365-williamhill", responseUrlFilter: /(\/api\/|\/data\/|sportsbook-api|graphql|\.json)/i, maxCaptures: 200 };
export const meta = { ...CONFIG, responseUrlFilter: String(CONFIG.responseUrlFilter), mode: "passive-sniff", experimental: true };
const state = { captured: 0, last: [] };
export function attach(page) {
  page.on("response", async (r) => {
    try { const u = r.url(); if (!CONFIG.responseUrlFilter.test(u) || state.captured >= CONFIG.maxCaptures) return;
      const body = await r.text(); state.captured++;
      writeCapture(CONFIG.key, `${Date.now()}-${state.captured}.txt`, u + "\n\n" + body.slice(0, 500000));
      state.last.push(body); if (state.last.length > 20) state.last.shift();
    } catch (e) { logError(CONFIG.key, "sniff " + e.message); }
  });
  writeStatus(CONFIG.key, { attached: true, captured: 0 });
}
export function parse(/* raw body */) { return []; } // TODO after a real capture is analysed
export async function health() {
  return writeStatus(CONFIG.key, { feedResponds: null, verifiedData: false, captured: state.captured,
    blocked: "not probed from box by design (passive only); format unknown until user captures from own profile" });
}
export async function readInPage() { const rows = state.last.flatMap((b) => parse(b)); writeStatus(CONFIG.key, { captured: state.captured, lastRead: rows.length }); return rows; }
