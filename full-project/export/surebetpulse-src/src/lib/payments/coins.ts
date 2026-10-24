import usdt from "@/assets/coins/usdt.svg";
import trx from "@/assets/coins/trx.svg";
import btc from "@/assets/coins/btc.svg";
import eth from "@/assets/coins/eth.svg";
import bnb from "@/assets/coins/bnb.svg";
import ltc from "@/assets/coins/ltc.svg";
import doge from "@/assets/coins/doge.svg";
import ton from "@/assets/coins/ton.svg";

/** A supported cryptocurrency: ticker, display name, brand color, official logo, deposit networks. */
export type Coin = {
  code: string;
  name: string;
  color: string;
  logo: string;
  networks: string[];
  /** CoinGecko id used by the rate provider. */
  geckoId: string;
};

export const COINS: Coin[] = [
  { code: "USDT", name: "Tether", color: "#26A17B", logo: usdt, networks: ["TRC20", "ERC20", "BEP20"], geckoId: "tether" },
  { code: "TRX", name: "TRON", color: "#EF0027", logo: trx, networks: ["TRC20"], geckoId: "tron" },
  { code: "BTC", name: "Bitcoin", color: "#F7931A", logo: btc, networks: ["Bitcoin"], geckoId: "bitcoin" },
  { code: "ETH", name: "Ethereum", color: "#627EEA", logo: eth, networks: ["ERC20"], geckoId: "ethereum" },
  { code: "BNB", name: "BNB", color: "#F3BA2F", logo: bnb, networks: ["BEP20"], geckoId: "binancecoin" },
  { code: "LTC", name: "Litecoin", color: "#BFBBBB", logo: ltc, networks: ["Litecoin"], geckoId: "litecoin" },
  { code: "DOGE", name: "Dogecoin", color: "#C3A634", logo: doge, networks: ["Dogecoin"], geckoId: "dogecoin" },
  { code: "TON", name: "Toncoin", color: "#0098EA", logo: ton, networks: ["TON"], geckoId: "the-open-network" },
];

export const coinByCode = (code: string) => COINS.find((c) => c.code === code);
