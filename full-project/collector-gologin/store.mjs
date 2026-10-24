// ArbRadar live cache: SQLite store, written each collector round. All timestamps UTC ISO-8601.
// Opt-in via config.STORE_ENABLED (default true). Fail-soft: errors never stop the collector.
import fs from "fs"; import path from "path";
let db = null, dir = null;
export async function openStore(C = {}) {
  if (C.STORE_ENABLED === false || process.env.STORE_DISABLED) return null;
  dir = process.env.ARBRADAR_DATA || C.STORE_DIR || "/root/arbradar-data";
  try {
    fs.mkdirSync(path.join(dir, "big-odds"), { recursive: true });
    const { default: Database } = await import("better-sqlite3");
    db = new Database(path.join(dir, "arbradar.db")); db.pragma("journal_mode = WAL");
    db.exec(`CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY, sport TEXT, league TEXT, home TEXT, away TEXT, live INTEGER, starts_at TEXT, first_seen TEXT, last_seen TEXT);
      CREATE TABLE IF NOT EXISTS odds_snapshots(id INTEGER PRIMARY KEY, ts TEXT, game_id TEXT, bookmaker TEXT, market TEXT, line REAL, selection TEXT, price REAL);
      CREATE INDEX IF NOT EXISTS ix_odds_game_ts ON odds_snapshots(game_id, ts);
      CREATE TABLE IF NOT EXISTS opportunities(id INTEGER PRIMARY KEY, ts TEXT, opp_id TEXT, event TEXT, league TEXT, market TEXT, edge_pct REAL, high_edge INTEGER, outcomes_json TEXT);
      CREATE TABLE IF NOT EXISTS big_odds(id INTEGER PRIMARY KEY, ts TEXT, game_id TEXT, event TEXT, league TEXT, bookmaker TEXT, market TEXT, selection TEXT, price REAL);`);
    return db;
  } catch (e) { console.error("[store] disabled:", e.message); db = null; return null; }
}
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
export function writeRound(all, opps, C = {}) {
  if (!db) return;
  try {
    const ts = new Date().toISOString(), BIG = C.bigOddsMin ?? 10, big = [];
    const g = db.prepare(`INSERT INTO games VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen, live=excluded.live`);
    const o = db.prepare(`INSERT INTO odds_snapshots(ts,game_id,bookmaker,market,line,selection,price) VALUES(?,?,?,?,?,?,?)`);
    const op = db.prepare(`INSERT INTO opportunities(ts,opp_id,event,league,market,edge_pct,high_edge,outcomes_json) VALUES(?,?,?,?,?,?,?,?)`);
    const b = db.prepare(`INSERT INTO big_odds(ts,game_id,event,league,bookmaker,market,selection,price) VALUES(?,?,?,?,?,?,?,?)`);
    db.transaction(() => {
      for (const { book, rows } of all) for (const r of rows) {
        const id = `${norm(r.home)}|${norm(r.away)}|${r.live ? 1 : 0}`;
        g.run(id, String(r.sport ?? ""), String(r.league ?? ""), r.home, r.away, r.live ? 1 : 0, new Date((r.start || 0) * 1000).toISOString(), ts, ts);
        const mk = { ...(r.mk || {}) }; if (r.o && Object.keys(r.o).length) mk["1X2"] = r.o;
        for (const [m, sel] of Object.entries(mk)) {
          const [mt, ln] = m.split(":"); const line = ln === undefined ? null : +ln;
          for (const [s, p] of Object.entries(sel)) { if (!(p > 1)) continue;
            o.run(ts, id, book, mt, line, s, +p);
            if (p >= BIG) { b.run(ts, id, `${r.home} vs ${r.away}`, String(r.league ?? ""), book, m, s, +p);
              big.push({ ts, game_id: id, event: `${r.home} vs ${r.away}`, league: r.league, bookmaker: book, market: m, selection: s, price: +p }); } }
        }
      }
      for (const x of opps) { const inv = x.outcomes.reduce((s, y) => s + 1 / y.odds, 0);
        op.run(ts, x.id, x.event, x.league, x.market, +((1 / inv - 1) * 100).toFixed(3), x.highEdge ? 1 : 0, JSON.stringify(x.outcomes)); }
    })();
    if (big.length) fs.appendFileSync(path.join(dir, "big-odds", `big-odds-${ts.slice(0, 10)}.jsonl`), big.map((x) => JSON.stringify(x)).join("\n") + "\n");
  } catch (e) { console.error("[store] write error:", e.message); }
}
