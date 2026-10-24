import { BOOK_LOGOS } from "./bookLogos";

export type Outcome = { label: string; bookmaker: string; odds: number; prevOdds?: number | undefined };
export type Source = "collector" | "api" | "demo";
export type Opportunity = {
  id: string;
  type: "surebet" | "value";
  sport: string;
  league: string;
  event: string;
  market: string;
  live?: boolean | undefined;
  startsAt: string;
  outcomes: Outcome[];
  source?: string | undefined;
  updatedAt: number;
};

/** URL slug for a bookmaker name, e.g. "William Hill" -> "william-hill". */
export const bookSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Single source of truth for every bookmaker: name, slug, brand color, family, domain, sharp/soft, optional logo. */
export type Book = { name: string; slug: string; color: string; family: string; domain: string; sharp: boolean; logo?: string | undefined };
const book = (name: string, color: string, family: string, domain: string, sharp = false): Book => {
  const slug = bookSlug(name);
  return { name, slug, color, family, domain, sharp, logo: BOOK_LOGOS[slug] };
};

export const BOOKS: Book[] = [
  // 1xBet family (head site first, mirrors/clones underneath)
  book("1xBet", "#2b7de1", "1xBet", "1xbet.com"),
  book("Melbet", "#f2b01e", "1xBet", "melbet.com"),
  book("Betwinner", "#1aa84f", "1xBet", "betwinner.com"),
  book("22Bet", "#2657a8", "1xBet", "22bet.com"),
  book("MegaPari", "#d4a017", "1xBet", "megapari.com"),
  book("888Starz", "#e0342f", "1xBet", "888starz.bet"),
  book("FairPari", "#1e6fd9", "1xBet", "fairpari.com"),
  book("WinWin", "#3a3f4b", "1xBet", "winwin.bet"),
  book("PariPesa", "#2456c4", "1xBet", "paripesa.com"),
  book("Linebet", "#1f9d4d", "1xBet", "linebet.com"),
  book("Helabet", "#e63312", "1xBet", "helabet.com"),
  book("Betandyou", "#7b1fa2", "1xBet", "betandyou.com"),
  book("DB-Bet", "#b71c1c", "1xBet", "db-bet.com"),
  book("Betlabel", "#00838f", "1xBet", "betlabel.com"),
  book("Spinbetter", "#8e24aa", "1xBet", "spinbetter.com"),
  book("Sapphirebet", "#1565c0", "1xBet", "sapphirebet.com"),
  book("1xBit", "#2e7d32", "1xBet", "1xbit.com"),
  book("Betpari", "#ef6c00", "1xBet", "betpari.com"),
  book("Fastpari", "#c62828", "1xBet", "fastpari.com"),
  book("Doublebet", "#283593", "1xBet", "doublebet.com"),
  // Pinnacle family
  book("Pinnacle", "#1c2e4a", "Pinnacle", "pinnacle.com", true),
  book("SBOBet", "#1d4f91", "Pinnacle", "sbobet.com", true),
  // Bet365 family
  book("Bet365", "#007b5b", "Bet365", "bet365.com"),
  // Regional family
  book("BetForward", "#f5a300", "Regional", "betforward.com"),
  book("RitzoBet", "#0f4c81", "Regional", "ritzobet.com"),
  book("CannonBet", "#0e7a5f", "Regional", "cannonbet.com"),
  // Europe family
  book("William Hill", "#003a70", "Europe", "williamhill.com"),
  book("Unibet", "#147b45", "Europe", "unibet.com"),
  book("bwin", "#f7c400", "Europe", "bwin.com"),
  book("Marathonbet", "#0a2a6b", "Europe", "marathonbet.com"),
  book("Betway", "#3a3f4b", "Europe", "betway.com"),
];

/** Bookmakers removed from the site (no real logo). Feed rows quoting them are dropped. */
export const REMOVED_BOOKS = ["Betfair", "Betfair Exchange", "Betongame", "ShahBet", "YekBet", "BerryBet", "Pin-Up", "Vbet"];
const REMOVED_LC = new Set(REMOVED_BOOKS.map((b) => b.toLowerCase()));
export const isRemovedBook = (name: string) => REMOVED_LC.has(name.trim().toLowerCase());

/** Bookmaker families: the head site first, mirrors/clones underneath. Derived from BOOKS. */
export const BOOK_FAMILIES: { name: string; books: string[] }[] = BOOKS.reduce<{ name: string; books: string[] }[]>((acc, b) => {
  const f = acc.find((x) => x.name === b.family);
  if (f) f.books.push(b.name); else acc.push({ name: b.family, books: [b.name] });
  return acc;
}, []);
/** Official domains, used to show each bookmaker's logo. */
export const BOOK_DOMAINS: Record<string, string> = Object.fromEntries(BOOKS.map((b) => [b.name, b.domain]));
export const BOOKMAKERS = BOOKS.map((b) => b.name);
export const BOOK_GROUPS: Record<string, string[]> = {
  sharp: BOOKS.filter((b) => b.sharp).map((b) => b.name),
  soft: BOOKS.filter((b) => !b.sharp).map((b) => b.name),
};

export const bookByName = (name: string) => BOOKS.find((b) => b.name === name);
export const bookBySlug = (slug: string) => BOOKS.find((b) => b.slug === slug)?.name;
export const bookFamily = (name: string) => bookByName(name)?.family;
export const isSharp = (name: string) => bookByName(name)?.sharp ?? false;

export const SPORTS = ["Football", "Basketball", "Tennis", "Volleyball", "Ice Hockey", "Esports"];
export const MARKET_GROUPS: Record<string, string[]> = {
  winner: ["1X2", "Winner"],
  totals: ["Total"],
  handicap: ["Asian Handicap"],
  cards: ["Cards"],
  corners: ["Corners"],
};
export const MARKETS = Object.values(MARKET_GROUPS).flat();

export const margin = (o: Outcome[]) => o.reduce((s, x) => s + 1 / x.odds, 0);
export const profitPct = (o: Outcome[]) => (1 / margin(o) - 1) * 100;

/** Stake split so every outcome returns the same payout; optional rounding step in USD. */
export function splitStakes(odds: number[], total: number, step = 0) {
  const m = odds.reduce((s, x) => s + 1 / x, 0);
  let stakes = odds.map((x) => total / x / m);
  if (step > 0) stakes = stakes.map((s) => Math.max(step, Math.round(s / step) * step));
  const spent = stakes.reduce((a, b) => a + b, 0);
  const returns = stakes.map((s, i) => s * odds[i]!);
  const payout = Math.min(...returns);
  return { stakes, returns, spent, payout, profit: payout - spent, pct: (payout / spent - 1) * 100 };
}

const TEAMS: Record<string, string[]> = {
  Football: ["Arsenal", "Chelsea", "Barcelona", "Real Madrid", "Bayern", "Dortmund", "Galatasaray", "Fenerbahçe", "Persepolis", "Esteghlal", "Inter", "Milan"],
  Tennis: ["Alcaraz", "Sinner", "Djokovic", "Medvedev", "Zverev", "Rune", "Fritz", "Ruud"],
  Basketball: ["Lakers", "Celtics", "Warriors", "Bucks", "Nuggets", "Heat", "Suns", "Knicks"],
  Volleyball: ["Iran", "Italy", "Poland", "Brazil", "Japan", "USA", "Türkiye", "France"],
  "Ice Hockey": ["Rangers", "Bruins", "Oilers", "Maple Leafs", "Panthers", "Avalanche"],
  Esports: ["NAVI", "FaZe", "Vitality", "G2", "Team Spirit", "Liquid"],
};
const LEAGUES: Record<string, string[]> = {
  Football: ["Premier League", "La Liga", "Süper Lig", "Serie A", "Bundesliga", "Persian Gulf Pro League"],
  Tennis: ["ATP Masters", "WTA 1000"],
  Basketball: ["NBA", "EuroLeague"],
  Volleyball: ["VNL", "SuperLega"],
  "Ice Hockey": ["NHL"],
  Esports: ["CS2 Major", "Dota 2 TI"],
};
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function randomOpportunity(): Opportunity {
  const sport = pick(SPORTS);
  const [a, b] = [...TEAMS[sport]!].sort(() => Math.random() - 0.5);
  const three = (sport === "Football" || sport === "Ice Hockey") && Math.random() > 0.5;
  const isSure = Math.random() > 0.3;
  const live = Math.random() > 0.55;
  const mk = three
    ? "1X2"
    : pick(sport === "Football" ? ["Asian Handicap", "Total", "Corners", "Cards", "Winner"] : ["Winner", "Asian Handicap", "Total"]);
  const labels = three
    ? ["1", "X", "2"]
    : mk === "Total" ? ["Over 2.5", "Under 2.5"] : mk === "Corners" ? ["Over 9.5", "Under 9.5"] : mk === "Cards" ? ["Over 4.5", "Under 4.5"]
    : mk === "Asian Handicap" ? ["H1 -0.5", "H2 +0.5"] : ["1", "2"];
  const probs = three ? [0.45, 0.28, 0.27].map((p) => p + (Math.random() - 0.5) * 0.1) : [0.5 + (Math.random() - 0.5) * 0.3];
  if (!three) probs.push(1 - probs[0]!);
  const sum = probs.reduce((s, x) => s + x, 0);
  const edge = live && Math.random() > 0.8 ? 0.08 + Math.random() * 0.15 : 0.003 + Math.random() * 0.05;
  const target = isSure ? 1 / (1 + edge) : 1.02 + Math.random() * 0.03;
  const books = [...BOOKMAKERS].sort(() => Math.random() - 0.5);
  const outcomes = probs.map((p, i) => {
    const odds = r2(1 / ((p / sum) * target));
    const drop = Math.random() > 0.6;
    return { label: labels[i]!, bookmaker: books[i]!, odds, prevOdds: drop ? r2(odds * (1.04 + Math.random() * 0.12)) : undefined };
  });
  return {
    id: Math.random().toString(36).slice(2, 10),
    type: isSure ? "surebet" : "value",
    sport, league: pick(LEAGUES[sport]!), event: `${a} – ${b}`, market: mk, live,
    startsAt: new Date(Date.now() + (live ? -Math.random() * 3600000 : Math.random() * 86400000 * 2)).toISOString(),
    outcomes, source: "demo",
    updatedAt: Date.now() - Math.floor(Math.random() * 240000),
  };
}

export function valueEdge(o: Opportunity) {
  const m = margin(o.outcomes);
  return Math.max(...o.outcomes.map((x) => (x.odds * (1 / x.odds / m) * 1.04 - 1) * 100));
}
