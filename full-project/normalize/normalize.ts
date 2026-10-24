// LOG-ONLY team-name normalization. Never mutates input data; only returns/logs decisions.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALIASES: Record<string, string[]> = JSON.parse(readFileSync(join(import.meta.dir ?? __dirname, "aliases.json"), "utf8"));
const aliasMap = new Map<string, string>();
for (const [canon, list] of Object.entries(ALIASES)) { aliasMap.set(canon, canon); for (const a of list) aliasMap.set(a, canon); }

// Cyrillic/Greek homoglyphs seen in real feeds (e.g. Mostbet "Leicester Сity").
const HOMOGLYPHS: Record<string, string> = { "а":"a","в":"b","с":"c","е":"e","н":"h","к":"k","м":"m","о":"o","р":"p","т":"t","у":"y","х":"x","і":"i" };
const TRANSLIT: [RegExp, string][] = [[/\bdynamo\b/g,"dinamo"],[/\bmuenchen\b/g,"munchen"],[/\bmunich\b/g,"munchen"],[/\bst\b/g,"saint"],[/\butd\b/g,"united"]];
const NOISE = new Set(["fc","cf","sc","fk","ac","afc","sk","cd","club","clube","sv","the"]);

export type Markers = { women: boolean; youth: string | null; reserves: boolean };
export type Clean = { key: string; markers: Markers };

export function cleanName(raw: string): Clean {
  let s = raw.toLowerCase().replace(/[\u0400-\u04ff]/g, c => HOMOGLYPHS[c] ?? c);
  s = s.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ø/g,"o").replace(/ß/g,"ss").replace(/ł/g,"l");
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const markers: Markers = { women: false, youth: null, reserves: false };
  const out: string[] = [];
  for (const t of s.split(/\s+/)) {
    if (/^(w|women|womens|ladies|fem|femenino|feminine|frauen)$/.test(t)) { markers.women = true; continue; }
    const y = t.match(/^u(\d{2})$/); if (y) { markers.youth = "u" + y[1]; continue; }
    if (/^(ii|b|reserves|res|2)$/.test(t) && out.length) { markers.reserves = true; continue; }
    if (NOISE.has(t)) continue;
    out.push(t);
  }
  let key = out.join(" ");
  for (const [r, v] of TRANSLIT) key = key.replace(r, v);
  key = aliasLookup(key);
  return { key, markers };
}
function aliasLookup(k: string): string {
  if (aliasMap.has(k)) return aliasMap.get(k)!;
  for (const [a, c] of aliasMap) { let n = a; for (const [r, v] of TRANSLIT) n = n.replace(r, v); if (n === k) return c; }
  return k;
}
function sameMarkers(a: Markers, b: Markers) { return a.women === b.women && a.youth === b.youth && a.reserves === b.reserves; }

function isSubset(a: string, b: string): boolean {
  if (a === b) return false;
  const A = a.split(" "), B = new Set(b.split(" ")), A2 = new Set(A);
  return A.every(x => B.has(x)) || [...B].every(x => A2.has(x));
}
function tokenSim(a: string, b: string): number {
  if (a === b) return 1;
  const A = new Set(a.split(" ")), B = new Set(b.split(" "));
  const inter = [...A].filter(x => B.has(x)).length;
  if ([...A].every(x => B.has(x)) || [...B].every(x => A.has(x))) return 0.85; // subset e.g. "leicester" vs "leicester city"
  return inter / new Set([...A, ...B]).size;
}
export function teamScore(a: string, b: string): number {
  const x = cleanName(a), y = cleanName(b);
  if (!sameMarkers(x.markers, y.markers)) return 0;
  return tokenSim(x.key, y.key);
}

/** true when either name is only a shorter/subset form of the other (e.g. "Leicester" vs "Leicester City"). */
export function isShortForm(a: string, b: string): boolean {
  const x = cleanName(a), y = cleanName(b);
  return sameMarkers(x.markers, y.markers) && isSubset(x.key, y.key);
}
function leagueMatches(a?: string, b?: string): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const x = cleanName(a).key, y = cleanName(b).key;
  return x.length > 0 && (x === y || isSubset(x, y));
}

export type Ev = { book: string; home: string; away: string; kickoff: number /*ms UTC*/; league?: string };
export type Decision = { match: boolean; swapped: boolean; confidence: number; reason: string; a: Ev; b: Ev };

export function matchEvents(a: Ev, b: Ev, opts = { toleranceMin: 15, threshold: 0.8, log: undefined as string | undefined }): Decision {
  const dt = Math.abs(a.kickoff - b.kickoff) / 60000;
  let d: Decision;
  if (dt > opts.toleranceMin) d = { match: false, swapped: false, confidence: 0, reason: `kickoff diff ${dt}min`, a, b };
  else {
    const straight = Math.min(teamScore(a.home, b.home), teamScore(a.away, b.away));
    const swap = Math.min(teamScore(a.home, b.away), teamScore(a.away, b.home));
    const swapped = swap > straight;
    let conf = Math.max(straight, swap);
    const lg = a.league && b.league ? tokenSim(cleanName(a.league).key, cleanName(b.league).key) : null;
    if (lg !== null && lg < 0.3) conf *= 0.8;
    conf *= 1 - Math.min(dt, opts.toleranceMin) / (opts.toleranceMin * 10);
    conf = Math.round(conf * 100) / 100;
    const pairs = swapped ? [[a.home, b.away], [a.away, b.home]] : [[a.home, b.home], [a.away, b.away]];
    const short = pairs.some(([x, y]) => isShortForm(x, y));
    let match = conf >= opts.threshold, reason = match ? (swapped ? "match, HOME/AWAY SWAPPED - flag" : "match") : "names below threshold";
    if (short && Math.max(straight, swap) >= opts.threshold && !leagueMatches(a.league, b.league)) { match = false; reason = "near-miss: short-form name needs matching non-empty league"; }
    else if (match && short) reason += " (short-form name, league confirmed)";
    d = { match, swapped: match && swapped, confidence: conf, reason, a, b };
  }
  if (opts.log) appendFileSync(opts.log, JSON.stringify({ ts: new Date().toISOString(), mode: "log-only", ...d }) + "\n");
  return d;
}
