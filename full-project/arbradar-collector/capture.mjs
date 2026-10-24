// Capture-only mode (CAPTURE_ONLY=1): records raw team names / league / kickoff / bookmaker / raw event id
// to a local JSONL file. Sends NOTHING to any webhook. Never logs in, never bets. Errors are logged, not swallowed.
import fs from "node:fs";
const DIR = new URL("./captures/", import.meta.url);
fs.mkdirSync(DIR, { recursive: true });
const day = () => new Date().toISOString().slice(0, 10);
const errLog = (book, where, e) => {
  const line = JSON.stringify({ at: new Date().toISOString(), book, where, error: String(e?.message || e) });
  fs.appendFileSync(new URL(`errors-${day()}.jsonl`, DIR), line + "\n"); console.log("[capture ERROR]", book, where, e?.message || e);
};
export function writeRows(book, rows) {
  const f = new URL(`capture-${day()}.jsonl`, DIR), at = new Date().toISOString();
  fs.appendFileSync(f, rows.map((r) => JSON.stringify({ capturedAt: at, bookmaker: book, ...r })).join("\n") + (rows.length ? "\n" : ""));
  return rows.length;
}
// 1xBet family (1xBet, Melbet, ...): same public JSON feed the page itself uses.
export async function cap1x(book, page, live) {
  const path = (live ? "LiveFeed" : "LineFeed") + `/Get1x2_VZip?count=${live ? 200 : 300}&mode=4&getEmpty=true&partner=1`;
  const r = await page.evaluate(async (path) => {
    try { const res = await fetch(`/${path}`); if (!res.ok) return { err: `HTTP ${res.status}` };
      const j = await res.json(); return { rows: (j.Value || []).map((e) => ({ rawId: e.I ?? e.CI ?? null, sport: e.SE || e.SN || "", league: e.L || "", home: e.O1, away: e.O2, kickoff: e.S ? new Date(e.S * 1000).toISOString() : null })) };
    } catch (e) { return { err: String(e) }; }
  }, path);
  if (r.err) { errLog(book, path, r.err); return []; }
  return r.rows.filter((x) => x.home && x.away).map((x) => ({ ...x, live }));
}
// Mostbet: public line list endpoint, called from inside the opened Mostbet profile page.
export async function capMostbet(page) {
  const out = [];
  for (let of = 0; of < 500; of += 100) {
    const r = await page.evaluate(async (of) => {
      try { const res = await fetch(`/api/v3/user/line/list?t[]=2&lc[]=1&l=100&of=${of}&lng=en`, { headers: { accept: "application/json" } });
        if (!res.ok) return { err: `HTTP ${res.status}` }; return { j: await res.json() }; } catch (e) { return { err: String(e) }; }
    }, of);
    if (r.err) { errLog("Mostbet", `line/list of=${of}`, r.err); break; }
    let n = 0;
    const walk = (x, league) => { if (!x || typeof x !== "object") return;
      if (x.match?.team1?.title && x.match?.team2?.title) { n++; out.push({ rawId: x.match.id ?? x.id ?? null, sport: "soccer", league: league || "",
        home: x.match.team1.title, away: x.match.team2.title, kickoff: x.match.begin_at ? new Date(x.match.begin_at * 1000).toISOString() : null, live: false }); return; }
      const t = typeof x.title === "string" && !x.alias ? x.title : league; for (const v of Object.values(x)) walk(v, t); };
    walk(r.j, "");
    if (!n) break;
  }
  return out;
}
// SBOBET: PASSIVE only. Abbas logs in by hand inside the Dolphin "sbobet" profile; we just read the
// event lists the sportsbook page itself loads. The collector never types credentials.
export function sniffSbobet(page) {
  const events = new Map();
  page.on("response", async (r) => {
    if (!/speedysurfcdn\.net\/api/.test(r.url())) return;
    try {
      const j = await r.json();
      const walk = (o) => { if (!o || typeof o !== "object") return;
        const id = o.eventId ?? o.id, home = o.homeTeamName ?? o.homeTeam?.name ?? o.homeTeam, away = o.awayTeamName ?? o.awayTeam?.name ?? o.awayTeam;
        if (id && typeof home === "string" && typeof away === "string") {
          const k = Date.parse(o.kickoffTime ?? o.startTime ?? o.eventDate ?? "");
          events.set(String(id), { rawId: String(id), sport: "Football", league: o.tournament?.name ?? o.tournamentName ?? o.leagueName ?? "", home, away, kickoff: isNaN(k) ? null : new Date(k).toISOString(), live: !!(o.isLive ?? o.live) }); }
        for (const v of Object.values(o)) walk(v); };
      walk(j);
    } catch (e) { errLog("SBOBET", "response parse", e); }
  });
  return { drain() { const a = [...events.values()]; events.clear(); return a; } };
}
export { errLog };
