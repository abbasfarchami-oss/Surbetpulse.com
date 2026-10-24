import logo1xbet from "@/assets/bookmakers/1xbet-wordmark.png";
import logoMelbet from "@/assets/bookmakers/melbet.png";
import logoBetwinner from "@/assets/bookmakers/betwinner.png";
import logo22bet from "@/assets/bookmakers/22bet.png";
import logoMegapari from "@/assets/bookmakers/megapari.png";
import logo888starz from "@/assets/bookmakers/888starz.png";
import logoFairpari from "@/assets/bookmakers/fairpari.png";
import logoWinwin from "@/assets/bookmakers/winwin.png";
import logoParipesa from "@/assets/bookmakers/paripesa.png";
import logoLinebet from "@/assets/bookmakers/linebet.png";
import logoHelabet from "@/assets/bookmakers/helabet.png";
import logoBetandyou from "@/assets/bookmakers/betandyou.png";
import logoDbBet from "@/assets/bookmakers/db-bet.png";
import logoBetlabel from "@/assets/bookmakers/betlabel.png";
import logoSpinbetter from "@/assets/bookmakers/spinbetter.png";
import logoSapphirebet from "@/assets/bookmakers/sapphirebet.png";
import logo1xbit from "@/assets/bookmakers/1xbit.png";
import logoBetpari from "@/assets/bookmakers/betpari.png";
import logoFastpari from "@/assets/bookmakers/fastpari.png";
import logoDoublebet from "@/assets/bookmakers/doublebet.png";
import logoPinnacle from "@/assets/bookmakers/pinnacle.png";
import logoSbobet from "@/assets/bookmakers/sbobet.svg";
import logoBet365 from "@/assets/bookmakers/bet365.png";
import logoBetforward from "@/assets/bookmakers/betforward.png";
import logoRitzobet from "@/assets/bookmakers/ritzobet.png";
import logoCannonbet from "@/assets/bookmakers/cannonbet.png";
import logoWilliamHill from "@/assets/bookmakers/william-hill.png";
import logoUnibet from "@/assets/bookmakers/unibet.png";
import logoBwin from "@/assets/bookmakers/bwin.png";
import logoMarathonbet from "@/assets/bookmakers/marathonbet.png";
import logoBetway from "@/assets/bookmakers/betway.png";

/** Official site icons by bookmaker slug. Books without an entry keep the initials badge. */
export const BOOK_LOGOS: Record<string, string> = {
  "1xbet": logo1xbet,
  "melbet": logoMelbet,
  "betwinner": logoBetwinner,
  "22bet": logo22bet,
  "megapari": logoMegapari,
  "888starz": logo888starz,
  "fairpari": logoFairpari,
  "winwin": logoWinwin,
  "paripesa": logoParipesa,
  "linebet": logoLinebet,
  "helabet": logoHelabet,
  "betandyou": logoBetandyou,
  "db-bet": logoDbBet,
  "betlabel": logoBetlabel,
  "spinbetter": logoSpinbetter,
  "sapphirebet": logoSapphirebet,
  "1xbit": logo1xbit,
  "betpari": logoBetpari,
  "fastpari": logoFastpari,
  "doublebet": logoDoublebet,
  "pinnacle": logoPinnacle,
  "sbobet": logoSbobet,
  "bet365": logoBet365,
  "betforward": logoBetforward,
  "ritzobet": logoRitzobet,
  "cannonbet": logoCannonbet,
  "william-hill": logoWilliamHill,
  "unibet": logoUnibet,
  "bwin": logoBwin,
  "marathonbet": logoMarathonbet,
  "betway": logoBetway,
};

/** Slugs whose logo is a wide wordmark — rendered on a wider rounded-rect plate so it stays sharp. */
export const WORDMARK_LOGOS: ReadonlySet<string> = new Set(["1xbet", "sbobet"]);
