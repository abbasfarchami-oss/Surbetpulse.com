import type { MatchedPair } from "./matcher";

/**
 * Asian Handicap support: line normalization, side detection and grouping.
 * Canonical line format: a signed number with dot decimal and up to 2 decimals
 * (quarter lines like -0.25 / +1.25 included). Accepted inputs:
 *   "Asian Handicap -0.25", "AH -0.25", "Handicap -0,25", "0/-0.5" (split line -> average),
 *   and SBOBET-style market "Handicap" with the point carried in the outcome label ("Home -0.25").
 */

const AH_RE = /(?:asian\s*handicap|handicap|\bah\b)/i;
const TOKEN_RE = /[+-]?\d+(?:[.,]\d+)?(?:\s*\/\s*[+-]?\d+(?:[.,]\d+)?)?/;

export const isAsianHandicapMarket = (market: string) => AH_RE.test(market);

const parseNum = (s: string): number | null => {
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Parse a line token: "-0.25", "+1.25", "-0,25", or a split/quarter token "0/-0.5" (averaged -> -0.25). */
export function parseLineToken(token: string): number | null {
  const parts = token.split("/").map(parseNum);
  if (!parts.length || parts.some((n) => n === null)) return null;
  const avg = (parts as number[]).reduce((s, n) => s + n, 0) / parts.length;
  return Math.round(avg * 100) / 100;
}

/** Canonical AH line from a market name, falling back to the outcome label (SBOBET JSON point). Null when not an AH line. */
export function parseAhLine(market: string, label?: string): number | null {
  if (!isAsianHandicapMarket(market)) return null;
  const mm = market.replace(AH_RE, " ").match(TOKEN_RE);
  if (mm) return parseLineToken(mm[0]);
  if (label) {
    const lm = label.match(TOKEN_RE);
    if (lm) return parseLineToken(lm[0]);
  }
  return null;
}

export type AhSide = "home" | "away";

/** Side of an AH outcome from its label ("Home", "Away", "1", "2", "Home -0.25", ...). */
export function ahSide(label: string): AhSide | null {
  const n = label.toLowerCase().trim();
  if (/^(home|1)\b/.test(n)) return "home";
  if (/^(away|2)\b/.test(n)) return "away";
  return null;
}

/** Canonical display name, e.g. "Asian Handicap -0.25" / "Asian Handicap +1.25". */
export const ahMarketName = (line: number) => `Asian Handicap ${line > 0 ? "+" : ""}${line}`;

/**
 * Pairing key fragment for an AH quote: absolute line + side, so the opposite-sign
 * away line (+0.25) pairs consistently with other away quotes on the same line,
 * and home (-0.25) with home — never across sides.
 */
export function ahPairKey(market: string, label: string): string | null {
  const line = parseAhLine(market, label);
  if (line == null) return null;
  const side = ahSide(label) ?? label.toLowerCase().trim();
  return `ah|${Math.abs(line)}|${side}`;
}

// ---- Grouping: by event, then by line ----

export type PairLineGroup = { line: string; pairs: MatchedPair[] };
export type PairEventGroup = { event: string; lines: PairLineGroup[] };

/** Group matched pairs by event, then by AH line (non-AH pairs group under their market name). */
export function groupMatchedPairs(pairs: MatchedPair[]): PairEventGroup[] {
  const byEvent = new Map<string, Map<string, MatchedPair[]>>();
  for (const p of pairs) {
    const lineKey = p.line != null ? ahMarketName(p.line) : p.market;
    let ev = byEvent.get(p.event);
    if (!ev) { ev = new Map(); byEvent.set(p.event, ev); }
    const arr = ev.get(lineKey);
    if (arr) arr.push(p); else ev.set(lineKey, [p]);
  }
  const latest = (ps: MatchedPair[]) => Math.max(...ps.map((p) => p.updatedAt));
  return [...byEvent.entries()]
    .map(([event, lines]) => ({
      event,
      lines: [...lines.entries()]
        .map(([line, ps]) => ({ line, pairs: ps }))
        .sort((a, b) => latest(b.pairs) - latest(a.pairs)),
    }))
    .sort((a, b) => latest(b.lines.flatMap((l) => l.pairs)) - latest(a.lines.flatMap((l) => l.pairs)));
}
