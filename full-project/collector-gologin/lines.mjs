// Pure parsers for Asian handicap / totals lines. Key = "AH:<home line>" (quarter lines kept, e.g. -0.25, +1.75).
export const normLine = (x) => { const v = Math.round((+x || 0) * 4) / 4; return Object.is(v, -0) ? 0 : v; };
// 1xBet family: G=2 T=7 home (P = home handicap), T=8 away (P = away handicap => home line = -P). G=17 T=9 over / T=10 under.
// Accepts a flat E array (Get1x2_VZip) or GameZip's GE groups ([{G, E:[[...],[...]]}]).
export function parse1xLines(E = [], GE = []) {
  const flat = [...E, ...GE.flatMap((g) => (g.E || []).flat().map((x) => ({ G: g.G, ...x })))], mk = {};
  for (const x of flat) {
    if (x.G === 2 && (x.T === 7 || x.T === 8)) { const hl = normLine(x.T === 7 ? x.P : -(x.P || 0)); (mk["AH:" + hl] ||= {})[x.T === 7 ? "h" : "a"] = x.C; }
    else if (x.G === 17 && (x.T === 9 || x.T === 10)) { (mk["OU:" + normLine(x.P)] ||= {})[x.T === 9 ? "o" : "u"] = x.C; }
  }
  return mk;
}
// SBOBet: every Handicap record; point is the home handicap (sign flippable via handicapSign until verified on live data).
export function parseSboLines(records = [], sign = 1) {
  const mk = {};
  for (const x of records) {
    const p = Object.fromEntries((x.prices || []).map((y) => [y.option, +y.price]));
    if (x.marketType === "Handicap" && p.h && p.a) mk["AH:" + normLine(sign * (+x.point || 0))] = { h: p.h, a: p.a };
    else if (x.marketType === "OverUnder" && p.o && p.u) mk["OU:" + normLine(x.point)] = { o: p.o, u: p.u };
  }
  return mk;
}
// 1xBet new frontend feed (service-api/main-line-feed|main-live-feed/v3/games1x2): one game object.
// Groups: 1 = 1X2 (types 1/2/3); 2 = Handicap (7 home P=home line, 8 away P=away line); 2854 = Asian Handicap
// incl. quarter lines (3829 home, 3830 away); 17 = Total (9 over, 10 under); 99 = Asian Total (3827 over, 3828 under).
// Missing "parameter" means 0. eventGroups + centralBlockEventGroups (the latter carries extra lines).
const AH_T = { 7: "h", 8: "a", 3829: "h", 3830: "a" }, OU_T = { 9: "o", 10: "u", 3827: "o", 3828: "u" };
export function parse1xV3(g) {
  const o = {}, mk = {};
  for (const grp of [...(g.eventGroups || []), ...(g.centralBlockEventGroups || [])])
    for (const x of (grp.events || []).flat()) {
      const p = +(x.parameter || 0), c = +x.cf; if (!(c > 1)) continue;
      if (grp.groupId === 1 && [1, 2, 3].includes(x.type)) o[x.type] = c;
      else if ((grp.groupId === 2 || grp.groupId === 2854) && AH_T[x.type]) {
        const side = AH_T[x.type], k = "AH:" + normLine(side === "h" ? p : -p); const m = (mk[k] ||= {}); m[side] = Math.max(m[side] || 0, c); }
      else if ((grp.groupId === 17 || grp.groupId === 99) && OU_T[x.type]) {
        const side = OU_T[x.type], k = "OU:" + normLine(p); const m = (mk[k] ||= {}); m[side] = Math.max(m[side] || 0, c); }
    }
  return { sport: g.sport?.name || "Football", league: g.liga?.name || "", home: g.opponent1?.fullName || g.opponent1?.opps?.[0]?.name,
    away: g.opponent2?.fullName || g.opponent2?.opps?.[0]?.name, start: g.startTs || 0, id: g.id, o, mk };
}
