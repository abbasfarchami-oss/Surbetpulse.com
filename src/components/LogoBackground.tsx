/**
 * Fixed full-viewport backdrop: a grid of bookmaker logos rendered from the
 * sprite sheet at /bg-logos/sprite.png (2048x1024, 8 cols x 4 rows, 256px cells).
 * Purely decorative: pointer-events disabled and stacked below all content.
 */

/** Sprite cell index (0-31) per bookmaker name, row-major order. */
const SPRITE_INDEX: Record<string, number> = {
  "1xBet": 0,
  "1xBit": 1,
  "22Bet": 2,
  "888Starz": 3,
  "Bet365": 4,
  "BetAndYou": 5,
  "BetForward": 6,
  "BetLabel": 7,
  "Betpari": 8,
  "Betway": 9,
  "Betwinner": 10,
  "Bwin": 11,
  "CannonBet": 12,
  "DB Bet": 13,
  "DoubleBet": 14,
  "Fairpari": 15,
  "Fastpari": 16,
  "Helabet": 17,
  "Linebet": 18,
  "Marathonbet": 19,
  "Megapari": 20,
  "Melbet": 21,
  "PariPesa": 22,
  "Pinnacle": 23,
  "Ritzobet": 24,
  "Sapphirebet": 25,
  "SBOBET": 26,
  "SpinBetter": 27,
  "Unibet": 28,
  "William Hill": 29,
  "WinWin": 30,
  "Mostbet": 31,
};

/** The 40 tiles shown in the grid, in order. */
const GRID_ORDER = [
  "1xBet", "1xBit", "22Bet", "888Starz", "Bet365", "BetAndYou", "BetForward", "BetLabel",
  "Betpari", "Betway", "Betwinner", "Bwin", "CannonBet", "DB Bet", "DoubleBet", "Fairpari",
  "Fastpari", "Helabet", "Linebet", "Marathonbet", "Megapari", "Melbet", "PariPesa", "Pinnacle",
  "Ritzobet", "Sapphirebet", "SBOBET", "SpinBetter", "Unibet", "William Hill", "WinWin", "Mostbet",
  "1xBit", "22Bet", "888Starz", "Bet365", "BetAndYou", "BetForward", "BetLabel", "William Hill",
];

export function LogoBackground() {
  return (
    <div className="logo-bg" aria-hidden="true">
      <div className="logo-bg-grid">
        {GRID_ORDER.map((name, i) => {
          const cell = SPRITE_INDEX[name] ?? 0;
          const col = cell % 8;
          const row = Math.floor(cell / 8);
          return (
            <div key={i} className="logo-bg-tile">
              <div
                className="logo-bg-img"
                style={{
                  backgroundImage: "url(/bg-logos/sprite.png)",
                  backgroundSize: "800% 400%",
                  backgroundPosition: `${(col / 7) * 100}% ${(row / 3) * 100}%`,
                }}
              />
              <div className="logo-bg-name">{name}</div>
            </div>
          );
        })}
      </div>
      <div className="logo-bg-overlay" />
    </div>
  );
}
