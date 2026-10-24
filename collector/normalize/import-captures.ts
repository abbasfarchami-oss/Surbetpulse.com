// Merges collector capture JSONL files into samples.csv (appends, de-duplicated) and writes alias-candidates.json
// for HUMAN REVIEW. Never edits aliases.json. Usage: bun import-captures.ts <capture-dir-or-files...>
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanName, matchEvents, isShortForm } from "./normalize";

type Row = { bookmaker: string; home: string; away: string; league?: string; kickoff?: string | null; rawId?: unknown };
const files = process.argv.slice(2).flatMap(p => statSync(p).isDirectory() ? readdirSync(p).filter(f => /^capture-.*\.jsonl$/.test(f)).map(f => join(p, f)) : [p]);
const rows: Row[] = [];
for (const f of files) readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (!l.trim()) return; try { rows.push(JSON.parse(l)); } catch (e) { console.error(`bad line ${f}:${i + 1}`); } });

const SAMPLES = join(import.meta.dir, "samples.csv");
const have = new Set(existsSync(SAMPLES) ? readFileSync(SAMPLES, "utf8").split("\n").map(l => l.split(",").slice(1, 3).join("|")) : []);
const q = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
let added = 0;
for (const r of rows) for (const n of [r.home, r.away]) {
  const k = `${r.bookmaker}|${n}`; if (have.has(k)) continue; have.add(k); added++;
  appendFileSync(SAMPLES, [`real:capture`, r.bookmaker, n, cleanName(n).key, `league=${r.league ?? ""} id=${r.rawId ?? ""}`].map(x => q(String(x))).join(",") + "\n");
}
// Candidate pairs: different bookmakers, kickoff within 15 min, one team equal after clean-up, other team differs.
const cands = new Map<string, { a: string; b: string; books: string; count: number; example: string; shortForm: boolean }>();
const byTime = rows.filter(r => r.kickoff).map(r => ({ ...r, t: Date.parse(r.kickoff!) })).sort((x, y) => x.t - y.t);
for (let i = 0; i < byTime.length; i++) for (let j = i + 1; j < byTime.length && byTime[j].t - byTime[i].t <= 15 * 60000; j++) {
  const A = byTime[i], B = byTime[j]; if (A.bookmaker === B.bookmaker) continue;
  const d = matchEvents({ book: A.bookmaker, home: A.home, away: A.away, kickoff: A.t, league: A.league }, { book: B.bookmaker, home: B.home, away: B.away, kickoff: B.t, league: B.league }, { toleranceMin: 15, threshold: 0.8, log: undefined });
  if (d.match) continue;
  const pairs: [string, string][] = [[A.home, B.home], [A.away, B.away]], sw: [string, string][] = [[A.home, B.away], [A.away, B.home]];
  for (const P of [pairs, sw]) {
    const eq = P.map(([x, y]) => cleanName(x).key === cleanName(y).key);
    if (eq[0] !== eq[1]) { const [x, y] = P[eq[0] ? 1 : 0]; const k = [cleanName(x).key, cleanName(y).key].sort().join(" <> ");
      const c = cands.get(k) ?? { a: x, b: y, books: `${A.bookmaker}/${B.bookmaker}`, count: 0, example: `${A.home} - ${A.away} | ${B.home} - ${B.away}`, shortForm: isShortForm(x, y) };
      c.count++; cands.set(k, c); }
  }
}
const out = [...cands.values()].sort((x, y) => y.count - x.count);
writeFileSync(join(import.meta.dir, "alias-candidates.json"), JSON.stringify({ note: "FOR REVIEW ONLY - not applied. Copy approved pairs into aliases.json by hand.", generatedAt: new Date().toISOString(), candidates: out }, null, 2));
console.log(`read ${rows.length} rows from ${files.length} file(s); added ${added} names to samples.csv; ${out.length} alias candidates -> alias-candidates.json`);
