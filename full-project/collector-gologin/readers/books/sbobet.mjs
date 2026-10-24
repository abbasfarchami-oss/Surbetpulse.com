// Standalone SBOBET reader module. Wraps the existing ../../sbobet.mjs (passive response sniffing of the sportsbook's own
// EventsQuery/OddsQuery). Needs a MANUAL login by the user in their own profile; this module never logs in by itself.
import { readSbobet } from "../../sbobet.mjs";
import { getJson } from "../_shared/http.mjs";
import { logError, writeStatus } from "../_shared/output.mjs";
export const CONFIG = { key: "sbobet", name: "SBOBet", family: "sbobet", engine: "sbobet", domain: "www.sbobet.com", mirrors: ["www.pic5678.com"],
  note: "manual login required; Finland IP blocked" };
export const meta = { ...CONFIG, mode: "sniff-after-manual-login", experimental: false };
export async function health() {
  const tried = [];
  for (const d of [CONFIG.domain, ...CONFIG.mirrors]) { const r = await getJson(`https://${d}/`); tried.push(`${d} -> ${r.status || r.error}${r.location ? " => " + r.location.slice(0, 60) : ""}`); }
  return writeStatus(CONFIG.key, { feedResponds: false, verifiedData: false, blocked: "odds API only visible after manual login; not probed", tried });
}
export async function readInPage(sboState, kws = []) {
  try { const rows = await readSbobet(sboState, kws); writeStatus(CONFIG.key, { lastRead: rows.length }); return rows; }
  catch (e) { logError(CONFIG.key, e.message); writeStatus(CONFIG.key, { lastRead: 0, error: e.message }); return []; }
}
